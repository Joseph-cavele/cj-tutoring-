// Standalone MongoDB Atlas connectivity check.
// Run with: npm run db:check
import mongoose from 'mongoose';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const uri = process.env.MONGODB_URI;

if (!uri || uri === 'your_mongodb_connection_string') {
  console.error(`${RED}✖ MONGODB_URI is not set${RESET} — add your Atlas connection string to .env.local`);
  process.exit(1);
}

// Never print credentials, only the host and database being targeted.
// Parsed by hand rather than with `new URL`, which rejects the comma-separated
// multi-host form of a non-SRV Atlas seed list.
function describe(connectionString) {
  const withoutScheme = connectionString.replace(/^mongodb(\+srv)?:\/\//, '');
  const afterCredentials = withoutScheme.slice(withoutScheme.indexOf('@') + 1);
  const [hostPart, rest = ''] = afterCredentials.split(/\/(.*)/s);
  const hosts = hostPart.split(',');
  const db = rest.split('?')[0] || '(default: test)';
  const shown = hosts.length > 1 ? `${hosts[0]} (+${hosts.length - 1} more)` : hosts[0];
  return `${shown} → ${db}`;
}

console.log(`${DIM}Connecting to ${describe(uri)}...${RESET}`);

try {
  const instance = await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });

  const admin = instance.connection.db.admin();
  await admin.command({ ping: 1 });

  const collections = await instance.connection.db.listCollections().toArray();

  console.log(`${GREEN}✔ Connected${RESET} → ${instance.connection.host}/${instance.connection.name}`);
  console.log(`${DIM}Collections (${collections.length}): ${collections.map((c) => c.name).join(', ') || 'none yet'}${RESET}`);

  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error(`${RED}✖ Connection failed:${RESET} ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
