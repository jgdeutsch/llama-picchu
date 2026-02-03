// Database Initialization Script for Llama Picchu MUD
import path from 'path';
import fs from 'fs';
import { initializeDatabase, closeDatabase } from '../server/database';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║           Llama Picchu MUD - Database Initialization          ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
console.log('Initializing database tables...');
initializeDatabase();

console.log('');
console.log('Database initialization complete!');
console.log(`Database location: ${path.join(dataDir, 'llama-mud.db')}`);
console.log('');
console.log('Next steps:');
console.log('  1. Run "npm run db:seed" to populate initial world data');
console.log('  2. Run "npm run dev" to start the server');
console.log('');

closeDatabase();
