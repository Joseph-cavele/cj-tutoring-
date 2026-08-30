// One-off migration: fold the `admin` role into `tutor`.
//
// The platform used to have four roles, with `admin` separate from `tutor`.
// It now has three, because CJ Private Tutoring is run by one person who both
// teaches and owns the business - so `tutor` IS the administrator role.
//
// Any account still carrying role `admin` would be locked out after that
// change: the session callback reads the role back from the database, `admin`
// is no longer in ROLES, and no route grants it anything. This script moves
// those accounts across.
//
// For each admin account it:
//   1. sets role to `tutor`
//   2. creates the Tutor profile the role needs, if one is missing, verified
//      and active so the owner is immediately bookable
//   3. leaves approvalStatus, password and every other field alone
//
// Safe to run more than once: an account already migrated simply is not found
// the second time.
//
// Run with: npm run migrate:admin-to-tutor
// Add --dry-run to see what it would do without writing anything.
//
// Talks to the collections directly rather than importing src/models, whose
// `@/` path aliases a plain node process cannot resolve.

import mongoose from 'mongoose';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const dryRun = process.argv.includes('--dry-run');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(`${RED}✖ MONGODB_URI is not set${RESET} — add it to .env.local`);
  process.exit(1);
}

await mongoose.connect(uri);

const db = mongoose.connection.db;
const users = db.collection('users');
const tutors = db.collection('tutors');

const admins = await users.find({ role: 'admin' }).toArray();

if (admins.length === 0) {
  console.log(`${GREEN}✔ Nothing to do${RESET} — no accounts are using the admin role.`);
  await mongoose.disconnect();
  process.exit(0);
}

console.log(
  `${YELLOW}Found ${admins.length} admin account${admins.length === 1 ? '' : 's'}${RESET}`
);

for (const admin of admins) {
  const hasProfile = await tutors.findOne({ user: admin._id });

  console.log(`\n  ${admin.email}`);
  console.log(`${DIM}    role          admin -> tutor${RESET}`);
  console.log(
    `${DIM}    tutor profile ${hasProfile ? 'already exists, left alone' : 'will be created (verified, active)'}${RESET}`
  );

  if (dryRun) continue;

  await users.updateOne({ _id: admin._id }, { $set: { role: 'tutor' } });

  if (!hasProfile) {
    const now = new Date();

    await tutors.insertOne({
      user: admin._id,
      subjects: [],
      isVerified: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

if (dryRun) {
  console.log(`\n${YELLOW}Dry run — nothing was written.${RESET}`);
  console.log(`${DIM}  Run again without --dry-run to apply.${RESET}`);
} else {
  console.log(`\n${GREEN}✔ Migrated ${admins.length} account${admins.length === 1 ? '' : 's'} to tutor${RESET}`);
  console.log(`${DIM}  They must sign in again: existing sessions carry the old role.${RESET}`);
}

await mongoose.disconnect();
