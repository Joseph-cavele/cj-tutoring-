// Promotes an existing account to administrator.
// Run with: npm run make:admin -- someone@example.com
//
// This is the one thing that cannot be done from inside the app, by design:
// a self-service route to admin would be a privilege-escalation hole. Once one
// admin exists, every other account is manageable at /admin/users.
//
// For the solo-tutor setup this platform is built around, you want
// `npm run make:owner` instead - the tutor who owns the business already has
// full access, and a separate admin account is one more thing to secure.
//
// Talks to the collection directly rather than importing src/models, whose
// `@/` path aliases a plain node process cannot resolve.

import mongoose from 'mongoose';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const email = process.argv[2]?.toLowerCase().trim();

if (!email) {
  console.error(`${RED}✖ No email given${RESET}`);
  console.error(`${DIM}  Usage: npm run make:admin -- someone@example.com${RESET}`);
  process.exit(1);
}

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

const users = db.collection('users');
const user = await users.findOne({ email });

if (!user) {
  console.error(`${RED}✖ No account with that email${RESET}`);

  const total = await users.countDocuments();

  if (total === 0) {
    console.error(`${DIM}  There are no accounts at all yet. Register at /register first.${RESET}`);
  } else {
    // Helps with the common case: a typo, or signing up with a different address.
    const recent = await users
      .find({}, { projection: { email: 1, role: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    console.error(`${DIM}  Most recent accounts:${RESET}`);
    for (const row of recent) {
      console.error(`${DIM}    ${row.email} (${row.role})${RESET}`);
    }
  }

  await mongoose.connection.close();
  process.exit(1);
}

if (user.role === 'admin' && user.isActive) {
  console.log(`${GREEN}✔ ${email} is already an active administrator${RESET}`);
  await mongoose.connection.close();
  process.exit(0);
}

await users.updateOne(
  { _id: user._id },
  {
    $set: {
      role: 'admin',
      // Registration creates every account as a pending application that
      // cannot sign in. Promoting must clear both, or the new admin is still
      // sitting in the approval queue and still locked out.
      approvalStatus: 'approved',
      isActive: true,
      updatedAt: new Date(),
    },
  }
);

console.log(`${GREEN}✔ ${email} is now an administrator${RESET} ${DIM}(was: ${user.role})${RESET}`);
console.log(`${DIM}  Sign in and open /admin/users to manage everyone else.${RESET}`);

if (user.role !== 'admin') {
  console.log(
    `${DIM}  Note: their previous ${user.role} profile is kept, so any bookings or` +
      `\n  results attached to it stay readable.${RESET}`
  );
}

await mongoose.connection.close();
process.exit(0);
