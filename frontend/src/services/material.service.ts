import { connectDB } from '@/lib/mongodb';
import { Grade, StudyMaterial, Subject, Topic } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { studentProfileFor } from '@/lib/booking/access';
import { destroyResource, getResource } from '@/lib/cloudinary';
import type { CreateMaterialInput } from '@/validations/material';
import { isStaff } from '@/lib/auth/roles';

export class MaterialError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'MaterialError';
  }
}

export type MaterialView = {
  materialId: string;
  title: string;
  description: string;
  gradeName: string;
  subjectName: string;
  topicName: string;
  url: string;
  fileName: string;
  fileType: string;
  bytes: number;
  isPublished: boolean;
  downloads: number;
  uploadedByName: string;
  createdAt: string;
};

const RELATIONS = [
  { path: 'grade', select: 'name level' },
  { path: 'subject', select: 'name' },
  { path: 'topic', select: 'name' },
  { path: 'uploadedBy', select: 'name' },
];

type PopulatedMaterial = {
  _id: { toString(): string };
  title: string;
  description?: string;
  grade?: { name?: string } | null;
  subject?: { name?: string } | null;
  topic?: { name?: string } | null;
  file: { url: string; publicId: string; fileName?: string; fileType?: string; bytes?: number };
  isPublished: boolean;
  downloads: number;
  uploadedBy?: { name?: string } | null;
  createdAt: Date;
};

function toView(material: PopulatedMaterial): MaterialView {
  return {
    materialId: material._id.toString(),
    title: material.title,
    description: material.description ?? '',
    gradeName: material.grade?.name ?? 'Grade',
    subjectName: material.subject?.name ?? 'Subject',
    topicName: material.topic?.name ?? 'General',
    url: material.file.url,
    fileName: material.file.fileName ?? material.title,
    fileType: material.file.fileType ?? '',
    bytes: material.file.bytes ?? 0,
    isPublished: material.isPublished,
    downloads: material.downloads,
    uploadedByName: material.uploadedBy?.name ?? 'Tutor',
    createdAt: material.createdAt.toISOString(),
  };
}

/**
 * Finds or creates the Topic for a grade and subject.
 *
 * Tutors type a topic name rather than picking from a managed list, because
 * requiring an admin to pre-create every topic would mean nobody could upload
 * anything on day one. Matched case-insensitively so "Calculus" and "calculus"
 * do not become two topics.
 */
async function resolveTopic(params: {
  topicName?: string;
  gradeId: string;
  subjectId: string;
}) {
  if (!params.topicName?.trim()) return undefined;

  const name = params.topicName.trim();

  const existing = await Topic.findOne({
    grade: params.gradeId,
    subject: params.subjectId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).select('_id');

  if (existing) return existing._id;

  const created = await Topic.create({
    name,
    grade: params.gradeId,
    subject: params.subjectId,
  });

  return created._id;
}

/**
 * Records an uploaded file as a study material.
 *
 * The browser uploaded straight to Cloudinary, so what it reports back is a
 * claim. `getResource` checks with Cloudinary that the file exists and sits
 * inside our own materials folder before anything is stored - otherwise a
 * caller could point a material at any URL they liked. Only the URL and
 * public_id are kept; no binary ever goes into Mongo (CLAUDE.md section 16).
 */
export async function createMaterial(user: SessionUser, input: CreateMaterialInput) {
  await connectDB();

  const [grade, subject] = await Promise.all([
    Grade.findById(input.gradeId).select('_id').lean(),
    Subject.findById(input.subjectId).select('_id').lean(),
  ]);

  if (!grade) throw new MaterialError('That grade was not found', 404);
  if (!subject) throw new MaterialError('That subject was not found', 404);

  const resource = await getResource(input.publicId, input.resourceType);

  if (!resource) {
    throw new MaterialError(
      'That upload could not be verified. Please try uploading the file again.',
      400
    );
  }

  const topicId = await resolveTopic({
    topicName: input.topicName,
    gradeId: input.gradeId,
    subjectId: input.subjectId,
  });

  const material = await StudyMaterial.create({
    title: input.title,
    description: input.description || undefined,
    grade: grade._id,
    subject: subject._id,
    topic: topicId,
    file: {
      // Taken from Cloudinary's answer, not from the request body.
      url: resource.url,
      publicId: resource.publicId,
      fileName: input.fileName || input.title,
      fileType: resource.format || resource.resourceType,
      bytes: resource.bytes,
    },
    uploadedBy: user.id,
    isPublished: input.isPublished,
  });

  return { materialId: material._id.toString() };
}

/** Everything this tutor has uploaded. Admins see all. */
export async function listMaterialsForTutor(user: SessionUser): Promise<MaterialView[]> {
  await connectDB();

  const filter = isStaff(user.role) ? {} : { uploadedBy: user.id };

  const materials = await StudyMaterial.find(filter)
    .populate(RELATIONS)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return (materials as unknown as PopulatedMaterial[]).map(toView);
}

/**
 * Published materials for the signed-in student's own grade.
 *
 * The grade comes from their student record, not the request, so a student
 * cannot read another grade's papers by changing a query parameter.
 */
export async function listMaterialsForStudent(
  user: SessionUser,
  filter: { subjectId?: string; topicId?: string } = {}
): Promise<MaterialView[]> {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) return [];

  const materials = await StudyMaterial.find({
    grade: student.grade,
    isPublished: true,
    ...(filter.subjectId ? { subject: filter.subjectId } : {}),
    ...(filter.topicId ? { topic: filter.topicId } : {}),
  })
    .populate(RELATIONS)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return (materials as unknown as PopulatedMaterial[]).map(toView);
}

/** Publishes or withdraws a material the caller owns. */
export async function setMaterialPublished(
  user: SessionUser,
  input: { materialId: string; isPublished: boolean }
) {
  await connectDB();

  const filter =
    isStaff(user.role)
      ? { _id: input.materialId }
      : { _id: input.materialId, uploadedBy: user.id };

  const material = await StudyMaterial.findOneAndUpdate(
    filter,
    { $set: { isPublished: input.isPublished } },
    { new: true }
  );

  if (!material) throw new MaterialError('That material was not found', 404);

  return { materialId: material._id.toString(), isPublished: material.isPublished };
}

/** Deletes a material and the file behind it. */
export async function deleteMaterial(user: SessionUser, materialId: string) {
  await connectDB();

  const filter =
    isStaff(user.role)
      ? { _id: materialId }
      : { _id: materialId, uploadedBy: user.id };

  const material = await StudyMaterial.findOne(filter).select('file');

  if (!material) throw new MaterialError('That material was not found', 404);

  // The record goes first: an orphaned Cloudinary file costs storage, but a
  // record pointing at a deleted file is a broken link for every student.
  await StudyMaterial.deleteOne({ _id: material._id });
  await destroyResource(material.file.publicId, material.file.fileType ?? 'image');

  return { deleted: true };
}

/** Counts a download. Best effort - a failed count must not block the file. */
export async function recordDownload(materialId: string) {
  await connectDB();
  await StudyMaterial.updateOne({ _id: materialId }, { $inc: { downloads: 1 } });
}

/** Subjects and topics that actually have material, for the browse filters. */
export async function getMaterialFilters(user: SessionUser) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) return { subjects: [], topics: [] };

  const materials = await StudyMaterial.find({
    grade: student.grade,
    isPublished: true,
  })
    .populate([
      { path: 'subject', select: 'name' },
      { path: 'topic', select: 'name' },
    ])
    .select('subject topic')
    .lean();

  type FilterRow = {
    subject?: { _id: { toString(): string }; name?: string } | null;
    topic?: { _id: { toString(): string }; name?: string } | null;
  };

  const subjects = new Map<string, string>();
  const topics = new Map<string, { id: string; name: string; subjectId: string }>();

  for (const material of materials as unknown as FilterRow[]) {
    const subjectId = material.subject?._id.toString();
    if (subjectId) subjects.set(subjectId, material.subject?.name ?? 'Subject');

    const topicId = material.topic?._id.toString();
    if (topicId && subjectId) {
      topics.set(topicId, {
        id: topicId,
        name: material.topic?.name ?? 'Topic',
        subjectId,
      });
    }
  }

  return {
    subjects: [...subjects.entries()]
      .map(([id, name]) => ({ subjectId: id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    topics: [...topics.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
