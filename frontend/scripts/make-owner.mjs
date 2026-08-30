// Creates or repairs the owner account for a solo-tutor setup.
// Run with: npm run make:owner -- you@example.com
//
// The tutor who owns CJ Private Tutoring is the one account that cannot be
// created from inside the app, by design: registration produces a `pending`
// application, and only an existing owner can accept one. That is a chicken
// and egg the first time, and a lockout if the owner's own account is ever
// left pending - this script is the way out of both.
//
// It makes the named account:
//   role            tutor      - the owner role; there is no separate admin
//   approvalStatus  approved   - so it is not sitting in its own queue
//   isActive        true       - so it can actually sign in
//   Tutor profile   verified   - so the tutor is bookable
//
// The password is read from the OWNER_PASSWORD environment variable, never an
// argument, so it does not end up in your shell history. It is only used when
// the account does not exist yet, or when you pass --set-password to change
// an existing one. An existing password is otherwise left alone.
//
// Talks to the collections directly rather than importing src/models, whose
// `@/` path aliases a plain node process cannot resolve.

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const SALT_ROUNDS = 12;

const args = process.argv.slice(2);
const setPassword = args.includes('--set-password');
const email = args.find((arg) => !arg.startsWith('--'))?.toLowerCase().trim();

if (!email) {
  console.error(`${RED}✖ No email given${RESET}`);
  console.error(`${DIM}  Usage: npm run make:owner -- you@example.com${RESET}`);
  console.error(`${DIM}  Set a password too: OWNER_PASSWORD=... npm run make:owner -- you@example.com${RESET}`);
  process.exit(1);
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(`${RED}✖ MONGODB_URI is not set${RESET} — add it to .env.local`);
  process.exit(1);
}

const password = process.env.OWNER_PASSWORD;

// Mirrors the rules in src/validations/auth.ts, so a password set here is one
// the login form would also have accepted.
function passwordProblem(value) {
  if (!value || value.length < 8) return 'at least 8 characters';
  if (!/[a-z]/.test(value)) return 'a lowercase letter';
  if (!/[A-Z]/.test(value)) return 'an uppercase letter';
  if (!/[0-9]/.test(value)) return 'a number';
  return null;
}

await mongoose.connect(uri);

const db = mongoose.connection.db;

if (!db) {
  console.error(`${RED}✖ Connected but no database was selected${RESET}`);
  process.exit(1);
}

const users = db.collection('users');
const tutors = db.collection('tutors');

const now = new Date();
const existing = await users.findOne({ email });

/* ---------------------------------------------------------------- *
 * No account yet: create one, which needs a password.
 * ---------------------------------------------------------------- */

if (!existing) {
  if (!password) {
    console.error(`${RED}✖ No account with that email, and no OWNER_PASSWORD to create one${RESET}`);
    console.error(
      `${DIM}  Create it with:${RESET}\n` +
        `${DIM}    OWNER_PASSWORD='your-password' npm run make:owner -- ${email}${RESET}`
    );
    await mongoose.connection.close();
    process.exit(1);
  }

  const problem = passwordProblem(password);

  if (problem) {
    console.error(`${RED}✖ OWNER_PASSWORD needs ${problem}${RESET}`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const { insertedId } = await users.insertOne({
    name: 'CJ Private Tutoring',
    email,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    role: 'tutor',
    approvalStatus: 'approved',
    approvedAt: now,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await tutors.insertOne({
    user: insertedId,
    subjects: [],
    grades: [],
    teachingModes: ['online'],
    isActive: true,
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`${GREEN}✔ Created ${email} as the owner${RESET}`);
  console.log(`${DIM}  Sign in at /login, then set your name, rate and subjects at /tutor/profile.${RESET}`);

  await mongoose.connection.close();
  process.exit(0);
}

/* ---------------------------------------------------------------- *
 * Account exists: make sure it is an approved, active tutor.
 * ---------------------------------------------------------------- */

const changes = {
  role: 'tutor',
  approvalStatus: 'approved',
  approvedAt: existing.approvedAt ?? now,
  isActive: true,
  updatedAt: now,
};

if (setPassword) {
  const problem = passwordProblem(password);

  if (problem) {
    console.error(`${RED}✖ --set-password needs OWNER_PASSWORD with ${problem}${RESET}`);
    await mongoose.connection.close();
    process.exit(1);
  }

  changes.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
}

await users.updateOne({ _id: existing._id }, { $set: changes });

// The Tutor profile is what makes them bookable and what /tutor/profile edits.
// upsert, because an account promoted from another role has never had one.
await tutors.updateOne(
  { user: existing._id },
  {
    $set: { isVerified: true, isActive: true, updatedAt: now },
    $setOnInsert: {
      user: existing._id,
      subjects: [],
      grades: [],
      teachingModes: ['online'],
      createdAt: now,
    },
  },
  { upsert: true }
);

const was = [
  existing.role !== 'tutor' ? `role ${existing.role}` : null,
  existing.approvalStatus && existing.approvalStatus !== 'approved'
    ? `${existing.approvalStatus} application`
    : null,
  existing.isActive === false ? 'unable to sign in' : null,
].filter(Boolean);

console.log(`${GREEN}✔ ${email} is now the owner${RESET}`);

if (was.length > 0) {
  console.log(`${DIM}  Was: ${was.join(', ')}${RESET}`);
}

if (setPassword) {
  console.log(`${DIM}  Password changed.${RESET}`);
} else if (!existing.passwordHash) {
  console.log(
    `${YELLOW}  ! This account has no password, so it still cannot sign in.${RESET}\n` +
      `${DIM}    Set one: OWNER_PASSWORD='...' npm run make:owner -- ${email} --set-password${RESET}`
  );
}

console.log(`${DIM}  Sign in at /login and you land on /tutor/dashboard.${RESET}`);

await mongoose.connection.close();
process.exit(0);
