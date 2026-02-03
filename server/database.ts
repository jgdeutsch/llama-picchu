// Database module for Llama Picchu MUD
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'llama-mud.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function initializeDatabase(): void {
  const database = getDatabase();

  // Accounts table
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_admin INTEGER DEFAULT 0
    )
  `);

  // Players table
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL COLLATE NOCASE,
      class_id INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,

      -- Stats
      str INTEGER NOT NULL,
      dex INTEGER NOT NULL,
      con INTEGER NOT NULL,
      int INTEGER NOT NULL,
      wis INTEGER NOT NULL,
      cha INTEGER NOT NULL,

      -- Resources
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      mana INTEGER NOT NULL,
      max_mana INTEGER NOT NULL,
      stamina INTEGER NOT NULL,
      max_stamina INTEGER NOT NULL,

      -- Vitals
      hunger INTEGER DEFAULT 100,
      thirst INTEGER DEFAULT 100,

      -- State
      gold INTEGER DEFAULT 100,
      current_room TEXT DEFAULT 'plaza',
      is_resting INTEGER DEFAULT 0,
      is_fighting INTEGER DEFAULT 0,

      -- Timestamps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,

      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Player equipment
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_equipment (
      player_id INTEGER PRIMARY KEY,
      head INTEGER,
      neck INTEGER,
      body INTEGER,
      back INTEGER,
      legs INTEGER,
      feet INTEGER,
      hands INTEGER,
      main_hand INTEGER,
      off_hand INTEGER,
      ring1 INTEGER,
      ring2 INTEGER,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Player inventory
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      item_template_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Player skills
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_skills (
      player_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      proficiency INTEGER DEFAULT 0,
      PRIMARY KEY (player_id, skill_id),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Player quests
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_quests (
      player_id INTEGER NOT NULL,
      quest_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      progress_json TEXT DEFAULT '{}',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      PRIMARY KEY (player_id, quest_id),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Room items (items on ground)
  database.exec(`
    CREATE TABLE IF NOT EXISTS room_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      item_template_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      respawn_at DATETIME
    )
  `);

  // Room NPCs (spawned NPCs)
  database.exec(`
    CREATE TABLE IF NOT EXISTS room_npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      npc_template_id INTEGER NOT NULL,
      hp_current INTEGER NOT NULL,
      mana_current INTEGER DEFAULT 0,
      combat_target INTEGER,
      respawn_at DATETIME,
      last_action DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Player cooldowns for skills
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_cooldowns (
      player_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      ready_at DATETIME NOT NULL,
      PRIMARY KEY (player_id, skill_id),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Chat log (optional, for persistence)
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      player_id INTEGER,
      player_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // NPC Memory - stores NPC opinions and memories about players (persists across deaths)
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_template_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      disposition INTEGER DEFAULT 50,
      interaction_count INTEGER DEFAULT 0,
      positive_interactions INTEGER DEFAULT 0,
      negative_interactions INTEGER DEFAULT 0,
      last_interaction DATETIME,
      last_rudeness DATETIME,
      memories TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(npc_template_id, player_id)
    )
  `);

  // Create indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_account ON players(account_id);
    CREATE INDEX IF NOT EXISTS idx_players_room ON players(current_room);
    CREATE INDEX IF NOT EXISTS idx_inventory_player ON player_inventory(player_id);
    CREATE INDEX IF NOT EXISTS idx_room_items_room ON room_items(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_npcs_room ON room_npcs(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_log_created ON chat_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_npc_memory_npc ON npc_memory(npc_template_id);
    CREATE INDEX IF NOT EXISTS idx_npc_memory_player ON npc_memory(player_id);
  `);

  console.log('Database initialized successfully');
}

// Account queries
export const accountQueries = {
  create: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO accounts (username, password_hash, email)
      VALUES (?, ?, ?)
    `),

  findByUsername: (db: Database.Database) =>
    db.prepare(`SELECT * FROM accounts WHERE username = ?`),

  findById: (db: Database.Database) =>
    db.prepare(`SELECT * FROM accounts WHERE id = ?`),

  updateLastLogin: (db: Database.Database) =>
    db.prepare(`UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?`),
};

// Player queries
export const playerQueries = {
  create: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO players (
        account_id, name, class_id,
        str, dex, con, int, wis, cha,
        hp, max_hp, mana, max_mana, stamina, max_stamina
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

  findById: (db: Database.Database) =>
    db.prepare(`SELECT * FROM players WHERE id = ?`),

  findByName: (db: Database.Database) =>
    db.prepare(`SELECT * FROM players WHERE name = ?`),

  findByAccountId: (db: Database.Database) =>
    db.prepare(`SELECT * FROM players WHERE account_id = ?`),

  updateRoom: (db: Database.Database) =>
    db.prepare(`UPDATE players SET current_room = ? WHERE id = ?`),

  updateResources: (db: Database.Database) =>
    db.prepare(`
      UPDATE players SET hp = ?, mana = ?, stamina = ?, hunger = ?, thirst = ?
      WHERE id = ?
    `),

  updateStats: (db: Database.Database) =>
    db.prepare(`
      UPDATE players SET str = ?, dex = ?, con = ?, int = ?, wis = ?, cha = ?
      WHERE id = ?
    `),

  updateExperience: (db: Database.Database) =>
    db.prepare(`UPDATE players SET experience = ?, level = ? WHERE id = ?`),

  updateGold: (db: Database.Database) =>
    db.prepare(`UPDATE players SET gold = ? WHERE id = ?`),

  updateCombatState: (db: Database.Database) =>
    db.prepare(`UPDATE players SET is_fighting = ? WHERE id = ?`),

  updateRestState: (db: Database.Database) =>
    db.prepare(`UPDATE players SET is_resting = ? WHERE id = ?`),

  getPlayersInRoom: (db: Database.Database) =>
    db.prepare(`SELECT id, name, level, class_id FROM players WHERE current_room = ?`),

  updateLastLogin: (db: Database.Database) =>
    db.prepare(`UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = ?`),
};

// Equipment queries
export const equipmentQueries = {
  create: (db: Database.Database) =>
    db.prepare(`INSERT INTO player_equipment (player_id) VALUES (?)`),

  get: (db: Database.Database) =>
    db.prepare(`SELECT * FROM player_equipment WHERE player_id = ?`),

  updateSlot: (db: Database.Database, slot: string) =>
    db.prepare(`UPDATE player_equipment SET ${slot} = ? WHERE player_id = ?`),
};

// Inventory queries
export const inventoryQueries = {
  getAll: (db: Database.Database) =>
    db.prepare(`SELECT * FROM player_inventory WHERE player_id = ?`),

  addItem: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO player_inventory (player_id, item_template_id, quantity)
      VALUES (?, ?, ?)
    `),

  updateQuantity: (db: Database.Database) =>
    db.prepare(`UPDATE player_inventory SET quantity = ? WHERE id = ?`),

  removeItem: (db: Database.Database) =>
    db.prepare(`DELETE FROM player_inventory WHERE id = ?`),

  findItem: (db: Database.Database) =>
    db.prepare(`
      SELECT * FROM player_inventory
      WHERE player_id = ? AND item_template_id = ?
    `),
};

// Skill queries
export const skillQueries = {
  getAll: (db: Database.Database) =>
    db.prepare(`SELECT * FROM player_skills WHERE player_id = ?`),

  addOrUpdate: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO player_skills (player_id, skill_id, proficiency)
      VALUES (?, ?, ?)
      ON CONFLICT (player_id, skill_id) DO UPDATE SET proficiency = ?
    `),
};

// Quest queries
export const questQueries = {
  getAll: (db: Database.Database) =>
    db.prepare(`SELECT * FROM player_quests WHERE player_id = ?`),

  getActive: (db: Database.Database) =>
    db.prepare(`SELECT * FROM player_quests WHERE player_id = ? AND status = 'active'`),

  addQuest: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO player_quests (player_id, quest_id, status)
      VALUES (?, ?, 'active')
    `),

  updateProgress: (db: Database.Database) =>
    db.prepare(`
      UPDATE player_quests SET progress_json = ? WHERE player_id = ? AND quest_id = ?
    `),

  completeQuest: (db: Database.Database) =>
    db.prepare(`
      UPDATE player_quests
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE player_id = ? AND quest_id = ?
    `),
};

// Room item queries
export const roomItemQueries = {
  getByRoom: (db: Database.Database) =>
    db.prepare(`SELECT * FROM room_items WHERE room_id = ?`),

  addItem: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO room_items (room_id, item_template_id, quantity)
      VALUES (?, ?, ?)
    `),

  removeItem: (db: Database.Database) =>
    db.prepare(`DELETE FROM room_items WHERE id = ?`),

  updateQuantity: (db: Database.Database) =>
    db.prepare(`UPDATE room_items SET quantity = ? WHERE id = ?`),
};

// Room NPC queries
export const roomNpcQueries = {
  getByRoom: (db: Database.Database) =>
    db.prepare(`SELECT * FROM room_npcs WHERE room_id = ? AND respawn_at IS NULL`),

  spawn: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO room_npcs (room_id, npc_template_id, hp_current, mana_current)
      VALUES (?, ?, ?, ?)
    `),

  updateHp: (db: Database.Database) =>
    db.prepare(`UPDATE room_npcs SET hp_current = ? WHERE id = ?`),

  setCombatTarget: (db: Database.Database) =>
    db.prepare(`UPDATE room_npcs SET combat_target = ? WHERE id = ?`),

  markDead: (db: Database.Database) =>
    db.prepare(`
      UPDATE room_npcs
      SET hp_current = 0, combat_target = NULL, respawn_at = datetime('now', '+' || ? || ' seconds')
      WHERE id = ?
    `),

  getRespawnable: (db: Database.Database) =>
    db.prepare(`SELECT * FROM room_npcs WHERE respawn_at IS NOT NULL AND respawn_at <= CURRENT_TIMESTAMP`),

  respawn: (db: Database.Database) =>
    db.prepare(`UPDATE room_npcs SET hp_current = ?, respawn_at = NULL WHERE id = ?`),
};

// NPC Memory queries - for persistent NPC opinions about players
export const npcMemoryQueries = {
  get: (db: Database.Database) =>
    db.prepare(`SELECT * FROM npc_memory WHERE npc_template_id = ? AND player_id = ?`),

  getOrCreate: (db: Database.Database) =>
    db.prepare(`
      INSERT INTO npc_memory (npc_template_id, player_id, disposition)
      VALUES (?, ?, 50)
      ON CONFLICT (npc_template_id, player_id) DO UPDATE SET
        npc_template_id = npc_template_id
      RETURNING *
    `),

  updateDisposition: (db: Database.Database) =>
    db.prepare(`
      UPDATE npc_memory
      SET disposition = MAX(0, MIN(100, disposition + ?)),
          last_interaction = CURRENT_TIMESTAMP
      WHERE npc_template_id = ? AND player_id = ?
    `),

  recordInteraction: (db: Database.Database) =>
    db.prepare(`
      UPDATE npc_memory
      SET interaction_count = interaction_count + 1,
          positive_interactions = positive_interactions + ?,
          negative_interactions = negative_interactions + ?,
          last_interaction = CURRENT_TIMESTAMP,
          last_rudeness = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE last_rudeness END
      WHERE npc_template_id = ? AND player_id = ?
    `),

  addMemory: (db: Database.Database) =>
    db.prepare(`UPDATE npc_memory SET memories = ? WHERE npc_template_id = ? AND player_id = ?`),

  // Forgiveness - slowly restore disposition over time
  applyForgiveness: (db: Database.Database) =>
    db.prepare(`
      UPDATE npc_memory
      SET disposition = MIN(50, disposition + 1)
      WHERE disposition < 50
        AND last_rudeness IS NOT NULL
        AND last_rudeness < datetime('now', '-1 hour')
    `),

  getAllForPlayer: (db: Database.Database) =>
    db.prepare(`SELECT * FROM npc_memory WHERE player_id = ?`),
};
