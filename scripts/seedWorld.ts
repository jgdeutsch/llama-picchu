// World Seeding Script for Llama Picchu MUD
import { initializeDatabase, getDatabase, closeDatabase } from '../server/database';
import { roomTemplates } from '../server/data/rooms';
import { itemTemplates } from '../server/data/items';
import { npcTemplates } from '../server/data/npcs';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║             Llama Picchu MUD - World Seeding                  ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// Initialize database (creates tables if needed)
initializeDatabase();
const db = getDatabase();

// Clear existing world data
console.log('Clearing existing world data...');
db.exec('DELETE FROM room_items');
db.exec('DELETE FROM room_npcs');

// Seed room items
console.log('Seeding room items...');
let itemCount = 0;

for (const room of roomTemplates) {
  for (const itemSpawn of room.defaultItems) {
    db.prepare(`
      INSERT INTO room_items (room_id, item_template_id, quantity)
      VALUES (?, ?, ?)
    `).run(room.id, itemSpawn.itemTemplateId, itemSpawn.quantity);
    itemCount++;
  }
}

console.log(`  Spawned ${itemCount} items across ${roomTemplates.length} rooms`);

// Seed NPCs
console.log('Seeding NPCs...');
let npcCount = 0;

for (const room of roomTemplates) {
  for (const npcSpawn of room.defaultNpcs) {
    const template = npcTemplates.find((t) => t.id === npcSpawn.npcTemplateId);
    if (template) {
      db.prepare(`
        INSERT INTO room_npcs (room_id, npc_template_id, hp_current, mana_current)
        VALUES (?, ?, ?, ?)
      `).run(room.id, npcSpawn.npcTemplateId, template.maxHp, template.maxMana);
      npcCount++;
    }
  }
}

console.log(`  Spawned ${npcCount} NPCs`);

// Summary
console.log('');
console.log('World seeding complete!');
console.log('');
console.log('Summary:');
console.log(`  Rooms:  ${roomTemplates.length}`);
console.log(`  Items:  ${itemTemplates.length} templates, ${itemCount} instances`);
console.log(`  NPCs:   ${npcTemplates.length} templates, ${npcCount} instances`);
console.log('');

// List rooms by area
const areas = new Map<string, string[]>();
for (const room of roomTemplates) {
  const roomList = areas.get(room.area) || [];
  roomList.push(room.name);
  areas.set(room.area, roomList);
}

console.log('Rooms by area:');
for (const [area, rooms] of areas) {
  console.log(`  ${area}: ${rooms.length} rooms`);
  for (const room of rooms) {
    console.log(`    - ${room}`);
  }
}

console.log('');
console.log('Run "npm run dev" to start the server!');
console.log('');

closeDatabase();
