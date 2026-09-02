// Seeds the two payment plans and the per-mode lesson rates.
// Run with: npm run seed:plans
//
// Pricing is database driven (CLAUDE.md section 5), so the figures in the
// brief have to reach the database rather than the code:
//
//   Pay per lesson   online R200/hour      in person R300/hour
//   Monthly          online R800/month     in person R1 200/month
//                    4 x 1-hour lessons, valid 30 days
//
// Idempotent. Prices are versioned rather than overwritten - Package.price is
// a history, and past invoices stay accurate only if an old entry is left
// alone - so re-running with a changed figure appends a new entry that takes
// effect now, and re-running with the same figure changes nothing.
//
// Talks to the collections directly rather than importing src/models, whose
// `@/` path aliases a plain node process cannot resolve.

import mongoose from 'mongoose';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const HOURLY_RATES = { online: 200, in_person: 300 };

const MONTHLY_PLANS = [
  {
    slug: 'monthly-online',
    name: 'Monthly Online',
    description: 'Four one-hour online lessons a month.',
    mode: 'online',
    amount: 800,
  },
  {
    slug: 'monthly-in-person',
    name: 'Monthly In Person',
    description: 'Four one-hour in-person lessons a month.',
    mode: 'in_person',
    amount: 1200,
  },
];

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

const packages = db.collection('packages');
const tutors = db.collection('tutors');
const now = new Date();

/* ------------------------------ Monthly plans ----------------------------- */

for (const plan of MONTHLY_PLANS) {
  const existing = await packages.findOne({ slug: plan.slug });

  if (!existing) {
    await packages.insertOne({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      mode: plan.mode,
      category: 'monthly',
      sessionsIncluded: 4,
      sessionDurationMinutes: 60,
      validityDays: 30,
      features: [
        { label: '4 × 1-hour lessons', included: true },
        { label: 'Valid for 30 days', included: true },
        { label: 'Unused lessons expire', included: false },
      ],
      price: [{ amount: plan.amount, currency: 'ZAR', effectiveFrom: now }],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`${GREEN}✔ Created ${plan.name}${RESET} ${DIM}R${plan.amount}/month${RESET}`);
    continue;
  }

  // The newest entry already in force is what a checkout would charge today.
  const current = [...(existing.price ?? [])]
    .filter((entry) => new Date(entry.effectiveFrom).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];

  if (current && current.amount === plan.amount && current.currency === 'ZAR') {
    console.log(`${DIM}— ${plan.name} already at R${plan.amount}${RESET}`);
    continue;
  }

  await packages.updateOne(
    { slug: plan.slug },
    {
      $push: { price: { amount: plan.amount, currency: 'ZAR', effectiveFrom: now } },
      $set: {
        isActive: true,
        category: 'monthly',
        mode: plan.mode,
        sessionsIncluded: 4,
        sessionDurationMinutes: 60,
        validityDays: 30,
        updatedAt: now,
      },
    }
  );

  console.log(
    `${GREEN}✔ ${plan.name}${RESET} ${DIM}R${current?.amount ?? '?'} → R${plan.amount}${RESET}`
  );
}

/* ------------------------------ Lesson rates ------------------------------ */

const result = await tutors.updateMany(
  {},
  {
    $set: {
      'hourlyRates.online': HOURLY_RATES.online,
      'hourlyRates.in_person': HOURLY_RATES.in_person,
      updatedAt: now,
    },
  }
);

console.log(
  `${GREEN}✔ Lesson rates${RESET} ${DIM}R${HOURLY_RATES.online} online, R${HOURLY_RATES.in_person} in person — ${result.modifiedCount} tutor(s)${RESET}`
);

if (result.matchedCount === 0) {
  console.log(`${YELLOW}! No tutors yet. Run this again once one exists.${RESET}`);
}

console.log(`\n${DIM}Students can now choose a plan at /student/payments.${RESET}`);

await mongoose.connection.close();
