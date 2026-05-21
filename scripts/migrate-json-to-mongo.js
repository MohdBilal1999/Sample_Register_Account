/**
 * One-time script: copy users from data/app.json into MongoDB.
 * Run: node scripts/migrate-json-to-mongo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

async function main() {
  await db.init();
  const users = await db.listUsers();
  console.log(`MongoDB now has ${users.length} user(s):`);
  users.forEach((u) => console.log(`  - ${u.name} <${u.email}> ${u.mobile}`));
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  console.error('Check MONGODB_URI in api/.env and firewall on port 27017.');
  process.exit(1);
});
