// Player Manager for Llama Picchu MUD
import bcrypt from 'bcrypt';
import {
  getDatabase,
  accountQueries,
  playerQueries,
  equipmentQueries,
  inventoryQueries,
  skillQueries,
} from '../database';
import { connectionManager } from './connectionManager';
import { classDefinitions } from '../data/classes';
import { itemTemplates } from '../data/items';
import { XP_FORMULA, MAX_LEVEL } from '../../shared/types/combat';
import type { Player, PlayerStats, PlayerEquipment, Account, ClassDefinition } from '../../shared/types/player';
import type { InventoryItem, ServerMessage } from '../../shared/types/websocket';

const SALT_ROUNDS = 10;

class PlayerManager {
  // Account management
  async createAccount(username: string, password: string, email: string): Promise<{ success: boolean; error?: string; accountId?: number }> {
    const db = getDatabase();

    // Check if username exists
    const existingUser = accountQueries.findByUsername(db).get(username);
    if (existingUser) {
      return { success: false, error: 'Username already taken.' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const result = accountQueries.create(db).run(username, passwordHash, email);
      return { success: true, accountId: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating account:', error);
      return { success: false, error: 'Failed to create account.' };
    }
  }

  async loginAccount(username: string, password: string): Promise<{ success: boolean; error?: string; account?: unknown }> {
    const db = getDatabase();

    const account = accountQueries.findByUsername(db).get(username) as {
      id: number;
      username: string;
      password_hash: string;
    } | undefined;

    if (!account) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const passwordMatch = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatch) {
      return { success: false, error: 'Invalid username or password.' };
    }

    // Update last login
    accountQueries.updateLastLogin(db).run(account.id);

    return { success: true, account };
  }

  // Character creation
  createCharacter(
    accountId: number,
    name: string,
    classId: number,
    stats: PlayerStats
  ): { success: boolean; error?: string; playerId?: number } {
    const db = getDatabase();

    // Validate name
    if (name.length < 3 || name.length > 20) {
      return { success: false, error: 'Name must be 3-20 characters.' };
    }

    if (!/^[a-zA-Z]+$/.test(name)) {
      return { success: false, error: 'Name must contain only letters.' };
    }

    // Check if name exists
    const existingPlayer = playerQueries.findByName(db).get(name);
    if (existingPlayer) {
      return { success: false, error: 'Character name already taken.' };
    }

    // Get class definition
    const classDef = classDefinitions.find((c) => c.id === classId);
    if (!classDef) {
      return { success: false, error: 'Invalid class.' };
    }

    // Calculate starting resources based on class
    const maxHp = classDef.baseHp + (stats.con * 2);
    const maxMana = classDef.baseMana + (stats.wis * 2) + (stats.int);
    const maxStamina = classDef.baseStamina + (stats.con) + (stats.str);

    try {
      const result = playerQueries.create(db).run(
        accountId,
        name,
        classId,
        stats.str,
        stats.dex,
        stats.con,
        stats.int,
        stats.wis,
        stats.cha,
        maxHp,   // hp
        maxHp,   // max_hp
        maxMana, // mana
        maxMana, // max_mana
        maxStamina, // stamina
        maxStamina  // max_stamina
      );

      const playerId = result.lastInsertRowid as number;

      // Create equipment slots
      equipmentQueries.create(db).run(playerId);

      // Grant starting skills
      for (const skillSlug of classDef.startingSkills) {
        // Skills will be added when skill data is loaded
      }

      // FROBARK: Give starter items - you arrive with almost nothing
      // Just the clothes on your back and your last bit of food
      const starterItems = [
        { itemId: 200, quantity: 1 }, // Worn Traveler's Tunic
        { itemId: 201, quantity: 1 }, // Tattered Traveling Boots
        { itemId: 202, quantity: 1 }, // Empty Waterskin
        { itemId: 203, quantity: 1 }, // Stale Bread Crust (one meal)
      ];

      for (const item of starterItems) {
        try {
          inventoryQueries.addItem(db).run(playerId, item.itemId, item.quantity);
        } catch (err) {
          console.log(`[PlayerManager] Could not add starter item ${item.itemId}:`, err);
        }
      }

      return { success: true, playerId };
    } catch (error) {
      console.error('Error creating character:', error);
      return { success: false, error: 'Failed to create character.' };
    }
  }

  // Get characters for an account
  getCharacters(accountId: number): unknown[] {
    const db = getDatabase();
    return playerQueries.findByAccountId(db).all(accountId);
  }

  // Get player by ID
  getPlayer(playerId: number): unknown {
    const db = getDatabase();
    return playerQueries.findById(db).get(playerId);
  }

  // Get player by name
  getPlayerByName(name: string): unknown {
    const db = getDatabase();
    return playerQueries.findByName(db).get(name);
  }

  // Update player login time
  updatePlayerLogin(playerId: number): void {
    const db = getDatabase();
    playerQueries.updateLastLogin(db).run(playerId);
  }

  // Get player inventory
  getInventory(playerId: number): InventoryItem[] {
    const db = getDatabase();
    const rawItems = inventoryQueries.getAll(db).all(playerId) as {
      id: number;
      item_template_id: number;
      quantity: number;
    }[];

    return rawItems.map((item) => {
      const template = itemTemplates.find((t) => t.id === item.item_template_id);
      return {
        id: item.id,
        templateId: item.item_template_id,
        name: template?.name || 'Unknown Item',
        quantity: item.quantity,
        equipped: false, // Will be updated when checking equipment
      };
    });
  }

  // Add item to inventory
  addItemToInventory(playerId: number, itemTemplateId: number, quantity: number = 1): { success: boolean; error?: string } {
    const db = getDatabase();
    const template = itemTemplates.find((t) => t.id === itemTemplateId);

    if (!template) {
      return { success: false, error: 'Invalid item.' };
    }

    // Check if stackable and already have some
    if (template.stackable) {
      const existing = inventoryQueries.findItem(db).get(playerId, itemTemplateId) as {
        id: number;
        quantity: number;
      } | undefined;

      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantity, template.maxStack);
        inventoryQueries.updateQuantity(db).run(newQuantity, existing.id);
        return { success: true };
      }
    }

    // Add new item
    inventoryQueries.addItem(db).run(playerId, itemTemplateId, quantity);
    return { success: true };
  }

  // Remove item from inventory
  removeItemFromInventory(playerId: number, itemId: number, quantity: number = 1): { success: boolean; error?: string } {
    const db = getDatabase();
    const items = inventoryQueries.getAll(db).all(playerId) as {
      id: number;
      quantity: number;
    }[];

    const item = items.find((i) => i.id === itemId);
    if (!item) {
      return { success: false, error: 'Item not found in inventory.' };
    }

    if (item.quantity <= quantity) {
      inventoryQueries.removeItem(db).run(itemId);
    } else {
      inventoryQueries.updateQuantity(db).run(item.quantity - quantity, itemId);
    }

    return { success: true };
  }

  // Find item in inventory by keyword
  findItemInInventory(playerId: number, keyword: string): { id: number; templateId: number; quantity: number } | null {
    const db = getDatabase();
    const items = inventoryQueries.getAll(db).all(playerId) as {
      id: number;
      item_template_id: number;
      quantity: number;
    }[];

    for (const item of items) {
      const template = itemTemplates.find((t) => t.id === item.item_template_id);
      if (template) {
        const lowerKeyword = keyword.toLowerCase();
        if (
          template.name.toLowerCase().includes(lowerKeyword) ||
          template.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
        ) {
          return { id: item.id, templateId: item.item_template_id, quantity: item.quantity };
        }
      }
    }

    return null;
  }

  // Get player equipment
  getEquipment(playerId: number): PlayerEquipment {
    const db = getDatabase();
    const equipment = equipmentQueries.get(db).get(playerId) as {
      head: number | null;
      neck: number | null;
      body: number | null;
      back: number | null;
      legs: number | null;
      feet: number | null;
      hands: number | null;
      main_hand: number | null;
      off_hand: number | null;
      ring1: number | null;
      ring2: number | null;
    } | undefined;

    if (!equipment) {
      return {
        head: null,
        neck: null,
        body: null,
        back: null,
        legs: null,
        feet: null,
        hands: null,
        mainHand: null,
        offHand: null,
        ring1: null,
        ring2: null,
      };
    }

    return {
      head: equipment.head,
      neck: equipment.neck,
      body: equipment.body,
      back: equipment.back,
      legs: equipment.legs,
      feet: equipment.feet,
      hands: equipment.hands,
      mainHand: equipment.main_hand,
      offHand: equipment.off_hand,
      ring1: equipment.ring1,
      ring2: equipment.ring2,
    };
  }

  // Equip item
  equipItem(playerId: number, inventoryItemId: number): { success: boolean; error?: string; slot?: string } {
    const db = getDatabase();

    // Get the item from inventory
    const items = inventoryQueries.getAll(db).all(playerId) as {
      id: number;
      item_template_id: number;
    }[];

    const item = items.find((i) => i.id === inventoryItemId);
    if (!item) {
      return { success: false, error: 'Item not found in inventory.' };
    }

    const template = itemTemplates.find((t) => t.id === item.item_template_id);
    if (!template) {
      return { success: false, error: 'Invalid item.' };
    }

    if (!template.slot) {
      return { success: false, error: 'That item cannot be equipped.' };
    }

    // Get player to check level
    const player = playerQueries.findById(db).get(playerId) as { level: number; class_id: number };
    if (template.levelRequired > player.level) {
      return { success: false, error: `You must be level ${template.levelRequired} to equip that.` };
    }

    if (template.classRequired && template.classRequired !== player.class_id) {
      return { success: false, error: 'Your class cannot use that item.' };
    }

    // Map slot names to database columns
    const slotToColumn: Record<string, string> = {
      head: 'head',
      neck: 'neck',
      body: 'body',
      back: 'back',
      legs: 'legs',
      feet: 'feet',
      hands: 'hands',
      mainHand: 'main_hand',
      offHand: 'off_hand',
      ring1: 'ring1',
      ring2: 'ring2',
    };

    const column = slotToColumn[template.slot];
    if (!column) {
      return { success: false, error: 'Invalid equipment slot.' };
    }

    // Check if slot is already occupied
    const equipment = equipmentQueries.get(db).get(playerId) as Record<string, number | null>;
    const currentEquipped = equipment?.[column];

    // Unequip current item if any
    if (currentEquipped) {
      // Add back to inventory
      this.addItemToInventory(playerId, currentEquipped, 1);
    }

    // Remove from inventory and equip
    inventoryQueries.removeItem(db).run(inventoryItemId);

    // Update equipment slot
    db.prepare(`UPDATE player_equipment SET ${column} = ? WHERE player_id = ?`).run(
      item.item_template_id,
      playerId
    );

    return { success: true, slot: template.slot };
  }

  // Unequip item
  unequipItem(playerId: number, slot: string): { success: boolean; error?: string } {
    const db = getDatabase();

    const slotToColumn: Record<string, string> = {
      head: 'head',
      neck: 'neck',
      body: 'body',
      back: 'back',
      legs: 'legs',
      feet: 'feet',
      hands: 'hands',
      mainHand: 'main_hand',
      offHand: 'off_hand',
      ring1: 'ring1',
      ring2: 'ring2',
    };

    const column = slotToColumn[slot];
    if (!column) {
      return { success: false, error: 'Invalid equipment slot.' };
    }

    const equipment = equipmentQueries.get(db).get(playerId) as Record<string, number | null>;
    const itemTemplateId = equipment?.[column];

    if (!itemTemplateId) {
      return { success: false, error: 'Nothing equipped in that slot.' };
    }

    // Add back to inventory
    this.addItemToInventory(playerId, itemTemplateId, 1);

    // Clear equipment slot
    db.prepare(`UPDATE player_equipment SET ${column} = NULL WHERE player_id = ?`).run(playerId);

    return { success: true };
  }

  // Award experience
  awardExperience(playerId: number, amount: number): { leveledUp: boolean; newLevel?: number } {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(playerId) as {
      level: number;
      experience: number;
      max_hp: number;
      max_mana: number;
      max_stamina: number;
      class_id: number;
    };

    if (!player || player.level >= MAX_LEVEL) {
      return { leveledUp: false };
    }

    let newExp = player.experience + amount;
    let newLevel = player.level;
    let leveledUp = false;

    // Check for level ups
    while (newLevel < MAX_LEVEL) {
      const xpNeeded = XP_FORMULA.xpForLevel(newLevel + 1);
      if (newExp >= xpNeeded) {
        newExp -= xpNeeded;
        newLevel++;
        leveledUp = true;
      } else {
        break;
      }
    }

    // Update database
    playerQueries.updateExperience(db).run(newExp, newLevel, playerId);

    // If leveled up, increase max stats
    if (leveledUp) {
      const classDef = classDefinitions.find((c) => c.id === player.class_id);
      if (classDef) {
        const levelsGained = newLevel - player.level;
        const newMaxHp = player.max_hp + (classDef.hpPerLevel * levelsGained);
        const newMaxMana = player.max_mana + (classDef.manaPerLevel * levelsGained);
        const newMaxStamina = player.max_stamina + (classDef.staminaPerLevel * levelsGained);

        db.prepare(`
          UPDATE players
          SET max_hp = ?, hp = ?, max_mana = ?, mana = ?, max_stamina = ?, stamina = ?
          WHERE id = ?
        `).run(newMaxHp, newMaxHp, newMaxMana, newMaxMana, newMaxStamina, newMaxStamina, playerId);
      }

      connectionManager.sendToPlayer(playerId, {
        type: 'level_up',
        level: newLevel,
        statPoints: 2,
      });

      connectionManager.sendToPlayer(playerId, {
        type: 'output',
        text: `\n*** CONGRATULATIONS! You have reached level ${newLevel}! ***\nYou have gained 2 stat points to distribute.\n`,
        messageType: 'system',
      });
    }

    return { leveledUp, newLevel: leveledUp ? newLevel : undefined };
  }

  // Modify gold
  modifyGold(playerId: number, amount: number): { success: boolean; newBalance: number } {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(playerId) as { gold: number };

    if (!player) {
      return { success: false, newBalance: 0 };
    }

    const newGold = Math.max(0, player.gold + amount);
    playerQueries.updateGold(db).run(newGold, playerId);

    return { success: true, newBalance: newGold };
  }

  // Get class definition
  getClassDefinition(classId: number): ClassDefinition | undefined {
    return classDefinitions.find((c) => c.id === classId);
  }

  // Roll stats (4d6 drop lowest per stat)
  static rollStats(): PlayerStats {
    const rollStat = (): number => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a);
      return rolls[0] + rolls[1] + rolls[2]; // Drop lowest
    };

    return {
      str: rollStat(),
      dex: rollStat(),
      con: rollStat(),
      int: rollStat(),
      wis: rollStat(),
      cha: rollStat(),
    };
  }

  // Generate score display
  getScoreDisplay(playerId: number): string {
    const db = getDatabase();
    const player = playerQueries.findById(db).get(playerId) as {
      name: string;
      level: number;
      experience: number;
      class_id: number;
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
      hp: number;
      max_hp: number;
      mana: number;
      max_mana: number;
      stamina: number;
      max_stamina: number;
      hunger: number;
      thirst: number;
      gold: number;
    };

    if (!player) return 'Player not found.';

    const classDef = classDefinitions.find((c) => c.id === player.class_id);
    const className = classDef?.name || 'Unknown';
    const xpNeeded = XP_FORMULA.xpForLevel(player.level + 1);

    const lines = [
      '',
      `╔════════════════════════════════════════╗`,
      `║  ${player.name.padEnd(36)}  ║`,
      `║  Level ${player.level} ${className.padEnd(28)}  ║`,
      `╠════════════════════════════════════════╣`,
      `║  ATTRIBUTES                            ║`,
      `║  STR: ${String(player.str).padStart(2)}    DEX: ${String(player.dex).padStart(2)}    CON: ${String(player.con).padStart(2)}     ║`,
      `║  INT: ${String(player.int).padStart(2)}    WIS: ${String(player.wis).padStart(2)}    CHA: ${String(player.cha).padStart(2)}     ║`,
      `╠════════════════════════════════════════╣`,
      `║  VITALS                                ║`,
      `║  HP:      ${String(player.hp).padStart(4)}/${String(player.max_hp).padEnd(4)}                   ║`,
      `║  Mana:    ${String(player.mana).padStart(4)}/${String(player.max_mana).padEnd(4)}                   ║`,
      `║  Stamina: ${String(player.stamina).padStart(4)}/${String(player.max_stamina).padEnd(4)}                   ║`,
      `╠════════════════════════════════════════╣`,
      `║  STATUS                                ║`,
      `║  Hunger: ${String(player.hunger).padStart(3)}%     Thirst: ${String(player.thirst).padStart(3)}%      ║`,
      `║  Gold: ${String(player.gold).padStart(6)}                          ║`,
      `╠════════════════════════════════════════╣`,
      `║  EXPERIENCE                            ║`,
      `║  ${String(player.experience).padStart(6)} / ${String(xpNeeded).padEnd(6)} to next level        ║`,
      `╚════════════════════════════════════════╝`,
      '',
    ];

    return lines.join('\n');
  }
}

export const playerManager = new PlayerManager();
export default playerManager;
