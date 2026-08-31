// Creates a tutor account with passwordSet: false and generates a one-time 2-hour setup token.
// Usage: node --env-file=.env.local scripts/create-tutor.mjs "CJ Private Tutoring" tutor@cjprivatetutoring.co.za

import mongoose from 'mongoose';
import crypto from 'node:crypto';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const name = args[0] || 'CJ Private Tutoring';
const email = args[1]?.toLowerCase().trim();

if (!email) {
  console.error(`${RED}✖ No email provided${RESET}`);
  console.error(`${DIM}  Usage: node --env-file=.env.local scripts/create-tutor.mjs "Name" email@cjprivatetutoring.co.za${RESET}`);
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error(`${RED}✖ MONGODB_URI is not set in .env.local${RESET}`);
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

if (!db) {
  console.error(`${RED}✖ Database connection failed${RESET}`);
  process.exit(1);
}

const users = db.collection('users');
const tutors = db.collection('tutors');
const passwordTokens = db.collection('passwordtokens');

const existing = await users.findOne({ email });
const now = new Date();
const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

const plainToken = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

let userId;

if (!existing) {
  const result = await users.insertOne({
    name,
    email,
    role: 'tutor',
    passwordSet: false,
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  userId = result.insertedId;

  await tutors.insertOne({
    user: userId,
    subjects: [],
    grades: [],
    teachingModes: ['online'],
    isActive: true,
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`${GREEN}✔ Created tutor user ${email} (passwordSet: false, isActive: true)${RESET}`);
} else {
  userId = existing._id;
  await users.updateOne(
    { _id: userId },
    {
      $set: {
        role: 'tutor',
        passwordSet: false,
        isActive: true,
        approvalStatus: 'approved',
        updatedAt: now,
      },
    }
  );
  console.log(`${YELLOW}✔ Updated existing user ${email} to tutor role${RESET}`);
}

await passwordTokens.deleteMany({ user: userId, purpose: 'setup' });
await passwordTokens.insertOne({
  user: userId,
  tokenHash,
  purpose: 'setup',
  expiresAt,
  usedAt: null,
  createdAt: now,
  updatedAt: now,
});

const origin = process.env.NEXTAUTH_URL || 'https://cjprivatetutoring.co.za';
const setupLink = `${origin.replace(/\/$/, '')}/create-password?token=${encodeURIComponent(plainToken)}`;

console.log(`\n${CYAN}======================================================${RESET}`);
console.log(`${GREEN}✔ One-time 2-Hour Password Setup Link Generated:${RESET}`);
console.log(`${CYAN}${setupLink}${RESET}`);
console.log(`${DIM}  Token Hash (stored in DB): ${tokenHash}${RESET}`);
console.log(`${DIM}  Expires At: ${expiresAt.toISOString()} (in 2 hours)${RESET}`);
console.log(`${CYAN}======================================================\n${RESET}`);

await mongoose.connection.close();
process.exit(0);
