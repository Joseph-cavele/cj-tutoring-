import mongoose from 'mongoose';

import { GRADES, SUBJECTS } from './src/lib/curriculum.ts';

/**
 * Seeds the grades and subjects the platform needs to function.
 *
 * Run with: npm run db:seed
 *
 * Deliberately does NOT import from `src/models` or `src/lib/mongodb`. Those
 * modules use `@/` path aliases, which Node resolves through tsconfig only
 * inside Next's bundler - a plain `node` process cannot follow them. So this
 * talks to the collections directly rather than dragging the whole model layer
 * into a standalone script. `src/lib/curriculum.ts` is safe because it imports
 * nothing.
 */

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is not set. Add it to .env.local');
  process.exit(1);
}

await mongoose.connect(uri);

const db = mongoose.connection.db;

if (!db) {
  console.error('Connected but no database was selected. Add a database name to MONGODB_URI.');
  process.exit(1);
}

const now = new Date();

/* ---------------------------------------------------------------- *
 * Grades
 * ---------------------------------------------------------------- */

const grades = db.collection('grades');

// Unique on level, matching the model, so a re-run cannot duplicate.
await grades.createIndex({ level: 1 }, { unique: true });
await grades.createIndex({ name: 1 }, { unique: true });

for (const level of GRADES) {
  await grades.updateOne(
    { level },
    {
      // $setOnInsert only: a re-run must not undo an admin's edits.
      $setOnInsert: {
        name: `Grade ${level}`,
        level,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

const gradeDocs = await grades.find().sort({ level: 1 }).toArray();

/* ---------------------------------------------------------------- *
 * Subjects
 * ---------------------------------------------------------------- */

const subjects = db.collection('subjects');

await subjects.createIndex({ slug: 1 }, { unique: true });

/** School subjects, tied to the grades that actually offer them. */
for (const subject of Object.values(SUBJECTS)) {
  const gradeIds = gradeDocs
    .filter((grade) => (subject.grades as readonly number[]).includes(grade.level))
    .map((grade) => grade._id);

  await subjects.updateOne(
    { slug: subject.slug },
    {
      // Grade links are kept in step on every run, because they follow the
      // curriculum rather than an admin's preference.
      $set: { grades: gradeIds, updatedAt: now },
      $setOnInsert: {
        name: subject.name,
        slug: subject.slug,
        description: subject.blurb,
        defaultDurationMinutes: 60,
        isActive: true,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

/**
 * Subjects that are not tied to a school grade.
 *
 * $setOnInsert throughout, so renaming or deactivating one through
 * /tutor/subjects is not undone the next time this runs.
 */
const EXTRA_SUBJECTS = [
  {
    slug: 'programming',
    name: 'Programming',
    description: 'Python, Java and problem solving, from first principles.',
  },
  {
    slug: 'engineering-mathematics',
    name: 'Engineering Mathematics',
    description: 'Calculus, linear algebra and differential equations.',
  },
  {
    slug: 'engineering-science',
    name: 'Engineering Science',
    description: 'Statics, dynamics, thermodynamics and electrical principles.',
  },
];

for (const subject of EXTRA_SUBJECTS) {
  await subjects.updateOne(
    { slug: subject.slug },
    {
      $setOnInsert: {
        name: subject.name,
        slug: subject.slug,
        description: subject.description,
        grades: [],
        defaultDurationMinutes: 60,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

/* ---------------------------------------------------------------- *
 * Report
 * ---------------------------------------------------------------- */

const finalGrades = await grades.find().sort({ level: 1 }).toArray();
const finalSubjects = await subjects.find().sort({ name: 1 }).toArray();

console.log(`\ngrades (${finalGrades.length}):`, finalGrades.map((g) => g.name).join(', '));
console.log(
  `subjects (${finalSubjects.length}):`,
  finalSubjects.map((s) => `${s.name}${s.isActive ? '' : ' (inactive)'}`).join(', ')
);

// The owner is the one account that cannot be made from inside the app:
// registration only ever produces a pending student or parent.
const owners = await db
  .collection('users')
  .countDocuments({ role: 'tutor', isActive: true });

if (owners === 0) {
  console.log(
    '\nNo tutor account exists yet. Create the owner with:' +
      '\n  OWNER_PASSWORD=... npm run make:owner -- you@example.com' +
      '\n  Everything else is manageable in the app once you sign in.'
  );
}

await mongoose.connection.close();
process.exit(0);
