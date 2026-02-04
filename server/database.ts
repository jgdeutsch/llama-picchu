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

      -- Vitals (Start somewhat hungry/thirsty - you've traveled far to reach Gamehenge)
      hunger INTEGER DEFAULT 50,
      thirst INTEGER DEFAULT 50,

      -- State (Start with nothing - you must earn your place in this world)
      gold INTEGER DEFAULT 0,
      current_room TEXT DEFAULT 'village_square',
      is_resting INTEGER DEFAULT 0,
      is_fighting INTEGER DEFAULT 0,

      -- Implementor status (game admins)
      is_implementor INTEGER DEFAULT 0,

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

  // ============================================
  // FROBARK: NPC LIFE SYSTEM TABLES
  // NPCs have state, tasks, schedules - they're living beings
  // ============================================

  // NPC State - tracks current activity, location, mood for each spawned NPC
  // This is the "living" state that makes NPCs feel alive
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_state (
      npc_instance_id INTEGER PRIMARY KEY,
      npc_template_id INTEGER NOT NULL,
      current_room TEXT NOT NULL,
      current_task TEXT,                    -- 'farming', 'cooking', 'patrolling', 'resting', 'socializing', etc.
      task_progress INTEGER DEFAULT 0,      -- 0-100 percent complete
      task_target TEXT,                     -- What they're working on (e.g., 'wheat field', 'dinner preparation')
      current_purpose TEXT,                 -- AI-generated reason for being in current room (e.g., "picking up bread for dinner")
      energy INTEGER DEFAULT 100,           -- Affects behavior, 0-100
      mood TEXT DEFAULT 'neutral',          -- 'happy', 'sad', 'angry', 'worried', 'content', 'tired'
      home_room TEXT,                       -- Where they sleep/live
      work_room TEXT,                       -- Where they primarily work
      schedule_json TEXT,                   -- JSON daily schedule
      last_player_nearby DATETIME,          -- When a player was last close enough to activate this NPC
      last_task_tick DATETIME,              -- When task progress was last calculated
      is_active INTEGER DEFAULT 0,          -- Whether NPC is currently "ticking" (player nearby)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (npc_instance_id) REFERENCES room_npcs(id) ON DELETE CASCADE
    )
  `);

  // Add current_purpose column if it doesn't exist (migration for existing DBs)
  try {
    database.exec(`ALTER TABLE npc_state ADD COLUMN current_purpose TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // NPC Tasks - active and queued tasks NPCs are working on
  // Players can see these and HELP with them
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_instance_id INTEGER NOT NULL,
      task_type TEXT NOT NULL,              -- 'farm', 'build', 'patrol', 'craft', 'cook', 'clean', 'tend_animals', 'deliver'
      description TEXT,                     -- Human-readable description
      location TEXT NOT NULL,               -- Room where task takes place
      started_at DATETIME,
      estimated_ticks INTEGER DEFAULT 100,  -- How many ticks to complete
      progress INTEGER DEFAULT 0,           -- Current progress (0-100)
      resources_needed TEXT DEFAULT '[]',   -- JSON: items needed
      resources_gathered TEXT DEFAULT '[]', -- JSON: items collected so far
      status TEXT DEFAULT 'pending',        -- 'pending', 'active', 'paused', 'completed', 'failed'
      help_accepted INTEGER DEFAULT 1,      -- Can players help with this?
      helper_player_ids TEXT DEFAULT '[]',  -- JSON: players who helped
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (npc_instance_id) REFERENCES room_npcs(id) ON DELETE CASCADE
    )
  `);

  // NPC Long-term Memories - separate from npc_memory (which is about player relationships)
  // These are memories of events, observations, gossip - things NPCs reference in conversation
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,              -- Template ID (personality persists)
      player_id INTEGER,                    -- If memory involves a specific player
      type TEXT NOT NULL,                   -- 'interaction', 'event', 'observation', 'gossip', 'significant'
      content TEXT NOT NULL,                -- The memory itself
      importance INTEGER DEFAULT 5,         -- 1-10, higher = more memorable, less likely to decay
      emotional_valence INTEGER DEFAULT 0,  -- -5 to +5, negative = bad memory
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decayed_at DATETIME,                  -- When memory was compacted/faded (NULL = still fresh)
      referenced_count INTEGER DEFAULT 0    -- Times NPC mentioned this memory
    )
  `);

  // NPC Response Cache - avoid hitting Gemini for similar conversations
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_response_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      context_hash TEXT NOT NULL,           -- Hash of key context (mood, task, trust level)
      player_message_normalized TEXT,       -- Lowercase, cleaned input
      response TEXT NOT NULL,               -- Generated response
      times_used INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(npc_id, context_hash, player_message_normalized)
    )
  `);

  // ============================================
  // FROBARK: SOCIAL CAPITAL SYSTEM
  // Relationships matter more than combat stats
  // ============================================

  // Social Capital - per-player relationship with each NPC
  database.exec(`
    CREATE TABLE IF NOT EXISTS social_capital (
      player_id INTEGER NOT NULL,
      npc_id INTEGER NOT NULL,              -- Template ID
      capital INTEGER DEFAULT 0,            -- Can go negative (-100 to +100)
      trust_level TEXT DEFAULT 'stranger',  -- 'hostile', 'unfriendly', 'stranger', 'acquaintance', 'friend', 'trusted', 'family'
      times_helped INTEGER DEFAULT 0,
      times_wronged INTEGER DEFAULT 0,
      gifts_given TEXT DEFAULT '[]',        -- JSON: items gifted
      secrets_shared TEXT DEFAULT '[]',     -- JSON: secrets NPC told this player
      last_interaction DATETIME,
      first_meeting DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, npc_id)
    )
  `);

  // Faction Standing - broader reputation with groups
  database.exec(`
    CREATE TABLE IF NOT EXISTS faction_standing (
      player_id INTEGER NOT NULL,
      faction TEXT NOT NULL,                -- 'lizards', 'prussia', 'resistance', 'forest', 'merchants'
      standing INTEGER DEFAULT 0,           -- -100 to 100
      rank TEXT DEFAULT 'unknown',          -- 'enemy', 'suspicious', 'unknown', 'known', 'respected', 'honored', 'champion'
      PRIMARY KEY (player_id, faction)
    )
  `);

  // NPC Gossip - NPCs talk about players
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_gossip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_npc_id INTEGER NOT NULL,       -- Who started the gossip
      about_player_id INTEGER NOT NULL,     -- Who it's about
      gossip_type TEXT,                     -- 'helpful', 'rude', 'generous', 'thief', 'hero', 'villain', 'strange'
      content TEXT,                         -- The actual gossip text
      spread_to TEXT DEFAULT '[]',          -- JSON: NPC IDs who heard this
      credibility INTEGER DEFAULT 50,       -- How believable (0-100)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME                   -- When gossip becomes old news
    )
  `);

  // ============================================
  // FROBARK: NPC-TO-NPC SOCIAL SYSTEM
  // NPCs have relationships with each other, gossip, keep journals
  // ============================================

  // NPC-to-NPC Relationships - how NPCs feel about each other
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_relationships (
      npc_id INTEGER NOT NULL,              -- The NPC who has this opinion
      target_npc_id INTEGER NOT NULL,       -- The NPC they have an opinion about
      relationship_type TEXT DEFAULT 'acquaintance', -- 'stranger', 'acquaintance', 'friend', 'close_friend', 'rival', 'enemy', 'lover', 'family'
      affinity INTEGER DEFAULT 0,           -- -100 to 100
      trust INTEGER DEFAULT 50,             -- 0-100
      last_interaction DATETIME,
      notes TEXT,                           -- Brief note about why they feel this way
      PRIMARY KEY (npc_id, target_npc_id)
    )
  `);

  // NPC Journals - personal diaries that players can find
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,              -- Template ID
      entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      content TEXT NOT NULL,                -- The journal entry (kept brief)
      entry_type TEXT DEFAULT 'daily',      -- 'daily', 'event', 'relationship', 'secret', 'dream'
      mentions_player_id INTEGER,           -- If entry is about a player
      mentions_npc_id INTEGER,              -- If entry is about another NPC
      importance INTEGER DEFAULT 5,         -- 1-10, how significant
      is_secret INTEGER DEFAULT 0           -- If 1, harder to find
    )
  `);

  // NPC Gossip Channel - NPCs gossiping with each other (not about players)
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_npc_gossip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      speaker_npc_id INTEGER NOT NULL,      -- Who said it
      listener_npc_id INTEGER NOT NULL,     -- Who heard it
      about_npc_id INTEGER,                 -- About which NPC (NULL if about world event)
      about_player_id INTEGER,              -- About which player (NULL if about NPC/event)
      gossip_content TEXT NOT NULL,         -- What was said
      gossip_type TEXT,                     -- 'rumor', 'observation', 'opinion', 'news', 'secret'
      belief_change INTEGER DEFAULT 0,      -- How much this changed listener's opinion
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // NPC Interests & Personality Traits (for richer interactions)
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_interests (
      npc_id INTEGER NOT NULL,
      interest TEXT NOT NULL,               -- 'farming', 'music', 'politics', 'gossip', 'philosophy', 'romance', 'wealth'
      intensity INTEGER DEFAULT 5,          -- 1-10, how much they care
      PRIMARY KEY (npc_id, interest)
    )
  `);

  // Protected Names - names that cannot be used by players
  database.exec(`
    CREATE TABLE IF NOT EXISTS protected_names (
      name TEXT PRIMARY KEY COLLATE NOCASE,
      reason TEXT                           -- 'implementor', 'npc', 'reserved'
    )
  `);

  // ============================================
  // FROBARK: ECONOMY & JOBS SYSTEM
  // Players start with nothing, must work their way up
  // ============================================

  // Jobs - available work in Gamehenge
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employer_npc_id INTEGER,              -- NPC who offers this job (NULL = general work)
      location TEXT NOT NULL,               -- Room ID
      description TEXT,
      pay_per_task INTEGER,                 -- Gold per completed task
      skill_required TEXT,                  -- 'farming', 'smithing', 'cooking', etc. (NULL = unskilled)
      skill_min_level INTEGER DEFAULT 0,
      reputation_required INTEGER DEFAULT 0, -- Min social capital with employer
      tasks_available INTEGER DEFAULT -1,   -- -1 = unlimited
      is_active INTEGER DEFAULT 1
    )
  `);

  // Player Employment - tracks current/past jobs
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_employment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      hired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tasks_completed INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      standing TEXT DEFAULT 'new',          -- 'new', 'reliable', 'valued', 'essential', 'fired'
      fired_at DATETIME,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);

  // Properties - housing and ownership
  database.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      room_id TEXT NOT NULL,
      property_type TEXT,                   -- 'bed', 'room', 'house', 'shop', 'land'
      owner_player_id INTEGER,              -- NULL = available
      purchase_price INTEGER,
      rent_weekly INTEGER,
      storage_capacity INTEGER DEFAULT 10,
      purchased_at DATETIME,
      rent_paid_until DATETIME
    )
  `);

  // Player Tools - Minecraft-style tool requirements
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_tools (
      player_id INTEGER NOT NULL,
      tool_type TEXT NOT NULL,              -- 'shovel', 'axe', 'pickaxe', 'hammer', 'hoe', 'fishing_rod'
      quality TEXT DEFAULT 'basic',         -- 'basic', 'good', 'excellent', 'master'
      durability INTEGER DEFAULT 100,       -- Decreases with use
      equipped INTEGER DEFAULT 0,
      PRIMARY KEY (player_id, tool_type)
    )
  `);

  // ============================================
  // FROBARK: BUILDING & CREATIVE SYSTEMS
  // ============================================

  // Building Plots - land players can build on
  database.exec(`
    CREATE TABLE IF NOT EXISTS building_plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      plot_number INTEGER,
      width INTEGER DEFAULT 15,
      height INTEGER DEFAULT 10,
      owner_player_id INTEGER,
      purchase_price INTEGER DEFAULT 100,
      purchased_at DATETIME
    )
  `);

  // Built Structures - what players have built
  database.exec(`
    CREATE TABLE IF NOT EXISTS built_structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      structure_type TEXT,                  -- 'wall', 'door', 'window', 'furniture', 'container'
      material TEXT,                        -- 'wood', 'stone', 'thatch', 'metal'
      ascii_char TEXT,                      -- Single character for display
      durability INTEGER DEFAULT 100,
      builder_player_id INTEGER,
      built_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES building_plots(id) ON DELETE CASCADE
    )
  `);

  // Player Books - written content
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,                         -- The actual text
      published INTEGER DEFAULT 0,          -- 0 = draft, 1 = published
      copies_sold INTEGER DEFAULT 0,
      location_room TEXT,                   -- Where a copy can be found
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Artwork - ASCII art created by players
  database.exec(`
    CREATE TABLE IF NOT EXISTS artwork (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      ascii_art TEXT,                       -- The art itself
      width INTEGER,
      height INTEGER,
      displayed_room TEXT,                  -- Where it's displayed
      owner_id INTEGER,                     -- Current owner (might be different from artist)
      for_sale INTEGER DEFAULT 0,
      price INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Compositions - music
  database.exec(`
    CREATE TABLE IF NOT EXISTS compositions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      composer_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      notation TEXT,                        -- Some representation of the music
      instrument TEXT DEFAULT 'voice',
      times_performed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (composer_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // Player Creative Work In Progress - temporary storage for unfinished works
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_creative_wip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,                    -- 'book', 'artwork', 'composition'
      title TEXT NOT NULL,
      content TEXT,                          -- Work content (JSON for books, ASCII for art, notation for music)
      width INTEGER,                         -- For artwork
      height INTEGER,                        -- For artwork
      instrument TEXT,                       -- For compositions
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  // ============================================
  // FROBARK: RESOURCE GATHERING
  // ============================================

  // Terrain Resources - what can be found in different locations
  database.exec(`
    CREATE TABLE IF NOT EXISTS terrain_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      resource_type TEXT,                   -- 'dirt', 'clay', 'stone', 'ore', 'gem', 'artifact', 'roots'
      quantity INTEGER DEFAULT 10,          -- How much is left
      discovered INTEGER DEFAULT 0,         -- Has anyone found this spot?
      respawn_hours INTEGER DEFAULT 24,     -- How long to regenerate
      last_harvested DATETIME
    )
  `);

  // Crafting Recipes
  database.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_item TEXT NOT NULL,
      result_quantity INTEGER DEFAULT 1,
      ingredients TEXT NOT NULL,            -- JSON: [{"item": "wood", "qty": 2}, ...]
      tool_required TEXT,                   -- 'workbench', 'forge', 'loom', NULL = no tool
      skill_required TEXT,                  -- 'smithing', 'tailoring', etc.
      skill_level INTEGER DEFAULT 0,
      craft_time_ticks INTEGER DEFAULT 1
    )
  `);

  // NPC Wants/Needs - what NPCs desire from players
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_wants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_template_id INTEGER NOT NULL,
      want_type TEXT NOT NULL,              -- 'item', 'service', 'information', 'craft'
      item_id INTEGER,                      -- Item template ID if want_type is 'item'
      description TEXT NOT NULL,            -- Human-readable description
      dialogue_hint TEXT,                   -- What NPC says when asked about it
      quantity_needed INTEGER DEFAULT 1,    -- How many items needed
      importance INTEGER DEFAULT 5,         -- 1-10, affects NPC enthusiasm
      reward_type TEXT DEFAULT 'gold',      -- 'gold', 'item', 'service', 'reputation'
      reward_amount INTEGER DEFAULT 10,     -- Gold amount or reputation boost
      reward_item_id INTEGER,               -- Item template ID if reward is item
      reward_description TEXT,              -- "I'll make you a fine shirt"
      is_repeatable INTEGER DEFAULT 1,      -- Can player fulfill multiple times?
      cooldown_hours INTEGER DEFAULT 24,    -- Hours before same player can fulfill again
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Track fulfillments of NPC wants
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_want_fulfillments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      want_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      fulfilled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      quantity_given INTEGER DEFAULT 1,
      FOREIGN KEY (want_id) REFERENCES npc_wants(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
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

    -- FROBARK indexes
    CREATE INDEX IF NOT EXISTS idx_npc_state_room ON npc_state(current_room);
    CREATE INDEX IF NOT EXISTS idx_npc_tasks_npc ON npc_tasks(npc_instance_id);
    CREATE INDEX IF NOT EXISTS idx_npc_tasks_status ON npc_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON npc_memories(npc_id);
    CREATE INDEX IF NOT EXISTS idx_social_capital_player ON social_capital(player_id);
    CREATE INDEX IF NOT EXISTS idx_social_capital_npc ON social_capital(npc_id);
    CREATE INDEX IF NOT EXISTS idx_faction_standing_player ON faction_standing(player_id);
    CREATE INDEX IF NOT EXISTS idx_npc_gossip_player ON npc_gossip(about_player_id);
    CREATE INDEX IF NOT EXISTS idx_player_employment_player ON player_employment(player_id);
    CREATE INDEX IF NOT EXISTS idx_terrain_resources_room ON terrain_resources(room_id);

    -- NPC-to-NPC social system indexes
    CREATE INDEX IF NOT EXISTS idx_npc_relationships_npc ON npc_relationships(npc_id);
    CREATE INDEX IF NOT EXISTS idx_npc_relationships_target ON npc_relationships(target_npc_id);
    CREATE INDEX IF NOT EXISTS idx_npc_journals_npc ON npc_journals(npc_id);
    CREATE INDEX IF NOT EXISTS idx_npc_journals_date ON npc_journals(entry_date);
    CREATE INDEX IF NOT EXISTS idx_npc_npc_gossip_speaker ON npc_npc_gossip(speaker_npc_id);
    CREATE INDEX IF NOT EXISTS idx_npc_npc_gossip_listener ON npc_npc_gossip(listener_npc_id);

    -- NPC wants system indexes
    CREATE INDEX IF NOT EXISTS idx_npc_wants_npc ON npc_wants(npc_template_id);
    CREATE INDEX IF NOT EXISTS idx_npc_wants_active ON npc_wants(is_active);
    CREATE INDEX IF NOT EXISTS idx_npc_want_fulfillments_want ON npc_want_fulfillments(want_id);
    CREATE INDEX IF NOT EXISTS idx_npc_want_fulfillments_player ON npc_want_fulfillments(player_id);
  `);

  // Seed protected names
  database.exec(`
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Opus', 'implementor');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Sprig', 'implementor');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Wilson', 'npc');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Icculus', 'npc');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Tela', 'npc');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Forbin', 'npc');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Rutherford', 'npc');
    INSERT OR IGNORE INTO protected_names (name, reason) VALUES ('Fee', 'npc');
  `);

  console.log('FROBARK database initialized successfully');
}

// Create implementor accounts (run once at setup)
export async function createImplementorAccounts(): Promise<{ opus: string; sprig: string }> {
  const db = getDatabase();
  const crypto = require('crypto');
  const bcrypt = require('bcrypt');

  // Generate secure passwords
  const opusPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
  const sprigPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);

  // Use bcrypt to match the login validation
  const opusHash = await bcrypt.hash(opusPassword, 10);
  const sprigHash = await bcrypt.hash(sprigPassword, 10);

  // Check if accounts already exist
  const existingOpus = db.prepare(`SELECT id FROM accounts WHERE username = 'Opus'`).get() as { id: number } | undefined;
  const existingSprig = db.prepare(`SELECT id FROM accounts WHERE username = 'Sprig'`).get() as { id: number } | undefined;

  if (existingOpus) {
    // Update existing Opus password
    db.prepare(`UPDATE accounts SET password_hash = ? WHERE username = 'Opus'`).run(opusHash);
    console.log('Reset password for implementor: Opus');
  } else {
    // Create Opus account and player
    const opusResult = db.prepare(`
      INSERT INTO accounts (username, password_hash, email, is_admin)
      VALUES ('Opus', ?, 'opus@frobark.com', 1)
    `).run(opusHash);

    db.prepare(`
      INSERT INTO players (
        account_id, name, class_id,
        str, dex, con, int, wis, cha,
        hp, max_hp, mana, max_mana, stamina, max_stamina,
        gold, is_implementor
      ) VALUES (?, 'Opus', 1, 20, 20, 20, 20, 20, 20, 999, 999, 999, 999, 999, 999, 999999, 1)
    `).run(opusResult.lastInsertRowid);

    console.log('Created implementor account: Opus');
  }

  if (existingSprig) {
    // Update existing Sprig password
    db.prepare(`UPDATE accounts SET password_hash = ? WHERE username = 'Sprig'`).run(sprigHash);
    console.log('Reset password for implementor: Sprig');
  } else {
    // Create Sprig account and player
    const sprigResult = db.prepare(`
      INSERT INTO accounts (username, password_hash, email, is_admin)
      VALUES ('Sprig', ?, 'sprig@frobark.com', 1)
    `).run(sprigHash);

    db.prepare(`
      INSERT INTO players (
        account_id, name, class_id,
        str, dex, con, int, wis, cha,
        hp, max_hp, mana, max_mana, stamina, max_stamina,
        gold, is_implementor
      ) VALUES (?, 'Sprig', 1, 20, 20, 20, 20, 20, 20, 999, 999, 999, 999, 999, 999, 999999, 1)
    `).run(sprigResult.lastInsertRowid);

    console.log('Created implementor account: Sprig');
  }

  return { opus: opusPassword, sprig: sprigPassword };
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
    db.prepare(`
      SELECT
        id,
        room_id as roomId,
        npc_template_id as npcTemplateId,
        hp_current as currentHp,
        mana_current as currentMana,
        combat_target as combatTarget,
        respawn_at as respawnAt
      FROM room_npcs
      WHERE room_id = ? AND respawn_at IS NULL
    `),

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
