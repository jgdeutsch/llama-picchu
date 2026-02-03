// Create Implementor Accounts for FROBARK
// Run with: npx tsx scripts/createImplementors.ts

import { initializeDatabase, createImplementorAccounts, getDatabase } from '../server/database';

console.log('Initializing FROBARK database...');
initializeDatabase();

console.log('Creating implementor accounts...');
const passwords = createImplementorAccounts();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FROBARK IMPLEMENTOR ACCOUNTS CREATED');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('  Username: Opus');
console.log(`  Password: ${passwords.opus}`);
console.log('');
console.log('  Username: Sprig');
console.log(`  Password: ${passwords.sprig}`);
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  SAVE THESE PASSWORDS - They cannot be recovered!');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Verify the accounts were created
const db = getDatabase();
const opus = db.prepare(`SELECT id, name, is_implementor FROM players WHERE name = 'Opus'`).get();
const sprig = db.prepare(`SELECT id, name, is_implementor FROM players WHERE name = 'Sprig'`).get();

console.log('Verification:');
console.log('  Opus:', opus);
console.log('  Sprig:', sprig);
