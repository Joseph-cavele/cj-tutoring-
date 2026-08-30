// Replaces the old attendance index so booking-based lessons can be attended.
// Run with: npm run migrate:attendance
//
// Attendance used to require a `class`, and carried a plain unique index on
// { class, student }. Lessons are now Bookings, so the model allows either -
// but a plain unique index treats every row whose `class` is null as a
// duplicate of every other, which would reject the second booking record ever
// written for a student.
//
// Mongoose creates missing indexes but will not alter one that already exists
// with different options, so the old index has to be dropped here. Both
// replacements are partial: each applies only to rows where its field is
// actually set.
//
// Safe to run more than once, and it touches no documents.

import mongoose from 'mongoose';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const OLD_INDEX = 'class_1_student_1';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(`${RED}✖ MONGODB_URI is not set${RESET} — add it to .env.local`);
  process.exit(1);
}

await mongoose.connect(uri);

const db = mongoose.connection.db;

if (!db) {
  console.error(`${RED}✖ Connected but no database was selected${RESET}`);
  process.exit(1);
}

const attendance = db.collection('attendance');

const existing = await attendance.indexes();
const old = existing.find((index) => index.name === OLD_INDEX);

// The old one is the one WITHOUT a partial filter. If it already has one, a
// previous run replaced it and there is nothing to do.
if (old && !old.partialFilterExpression) {
  await attendance.dropIndex(OLD_INDEX);
  console.log(`${GREEN}✔ Dropped the old ${OLD_INDEX} index${RESET}`);
} else if (old) {
  console.log(`${DIM}• ${OLD_INDEX} is already partial; nothing to drop${RESET}`);
} else {
  console.log(`${DIM}• No ${OLD_INDEX} index found; nothing to drop${RESET}`);
}

await attendance.createIndex(
  { class: 1, student: 1 },
  { unique: true, partialFilterExpression: { class: { $type: 'objectId' } } }
);

await attendance.createIndex(
  { booking: 1, student: 1 },
  { unique: true, partialFilterExpression: { booking: { $type: 'objectId' } } }
);

console.log(`${GREEN}✔ Partial unique indexes are in place${RESET}`);
console.log(`${DIM}  class+student for group classes, booking+student for lessons.${RESET}`);

await mongoose.connection.close();
process.exit(0);
