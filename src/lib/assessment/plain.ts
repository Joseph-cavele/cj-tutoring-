/**
 * Question options and rubric entries, flattened to plain values.
 *
 * Both are declared as inline arrays on the Question schema, so Mongoose gives
 * every entry its own _id, and lean() hands those back as ObjectId instances.
 * A Server Component may only pass plain objects to a Client Component, so one
 * of these reaching a prop fails at render with "Only plain objects can be
 * passed to Client Components ... Objects with toJSON methods are not
 * supported".
 *
 * Every read path that puts a question in front of someone needs this: the
 * tutor reviewing a test, the student sitting one, and the tutor marking it.
 *
 * Each entry is rebuilt field by field rather than having _id deleted, so
 * anything the schema grows later stays out of the view until it is
 * deliberately added. These entries are values, not records anything refers
 * to, so nothing needs their id.
 *
 * Deliberately free of Mongoose and of any model import, so it can be used
 * from a service without dragging a schema along.
 */

export type OptionView = { key: string; text: string };
export type RubricView = { marks: number; criterion: string };

export function toOptionViews(
  options: readonly { key?: string; text?: string }[] | undefined | null
): OptionView[] {
  return (options ?? []).map((option) => ({
    key: option.key ?? '',
    text: option.text ?? '',
  }));
}

export function toRubricViews(
  rubric: readonly { marks?: number; criterion?: string }[] | undefined | null
): RubricView[] {
  return (rubric ?? []).map((entry) => ({
    marks: entry.marks ?? 0,
    criterion: entry.criterion ?? '',
  }));
}
