// Resource Manager for FROBARK
// Handles digging, gathering, and resource discovery
// Players need tools to gather resources - can't just dig with bare hands!

import { getDatabase, playerQueries } from '../database';
import { connectionManager } from './connectionManager';
import { itemTemplates } from '../data/items';
import { inventoryQueries } from '../database';

// Tool types and what they can do
const TOOL_ACTIONS: Record<string, string[]> = {
  shovel: ['dig'],
  axe: ['chop'],
  pickaxe: ['mine'],
  hoe: ['farm', 'till'],
  fishing: ['fish'],
  hammer: ['build'],
};

// What can be found when digging in different terrain types
interface ResourceDrop {
  itemId: number;
  name: string;
  chance: number;      // 0-100
  minQuantity: number;
  maxQuantity: number;
  minDepth?: number;   // How many dig actions needed to find this
  message: string;     // What player sees when they find it
}

// Terrain resources by room type/area
const TERRAIN_RESOURCES: Record<string, ResourceDrop[]> = {
  farmlands: [
    { itemId: 300, name: 'Rich Soil', chance: 60, minQuantity: 1, maxQuantity: 3, message: 'You dig up some rich, dark soil.' },
    { itemId: 301, name: 'Clay', chance: 25, minQuantity: 1, maxQuantity: 2, message: 'You uncover a pocket of clay.' },
    { itemId: 302, name: 'Earthworm', chance: 40, minQuantity: 1, maxQuantity: 5, message: 'You find some wriggling earthworms - good for fishing!' },
    { itemId: 303, name: 'Old Coin', chance: 5, minQuantity: 1, maxQuantity: 1, minDepth: 2, message: 'You unearth an old coin! It\'s tarnished but still worth something.' },
    { itemId: 304, name: 'Root Vegetable', chance: 30, minQuantity: 1, maxQuantity: 2, message: 'You dig up a root vegetable someone must have missed.' },
  ],
  river_crossing: [
    { itemId: 305, name: 'River Sand', chance: 70, minQuantity: 2, maxQuantity: 5, message: 'You scoop up handfuls of fine river sand.' },
    { itemId: 301, name: 'Clay', chance: 40, minQuantity: 1, maxQuantity: 3, message: 'The riverbank yields good clay.' },
    { itemId: 306, name: 'Smooth Stone', chance: 35, minQuantity: 1, maxQuantity: 2, message: 'You find some smooth, water-worn stones.' },
    { itemId: 307, name: 'Gold Flake', chance: 3, minQuantity: 1, maxQuantity: 1, minDepth: 3, message: 'A glint catches your eye - a tiny flake of gold!' },
    { itemId: 308, name: 'Lost Ring', chance: 2, minQuantity: 1, maxQuantity: 1, minDepth: 2, message: 'You find a ring half-buried in the sand. Someone lost this long ago.' },
  ],
  forest_edge: [
    { itemId: 300, name: 'Rich Soil', chance: 50, minQuantity: 1, maxQuantity: 2, message: 'You dig up forest loam.' },
    { itemId: 309, name: 'Mushroom', chance: 35, minQuantity: 1, maxQuantity: 3, message: 'You uncover some mushrooms growing in the soil.' },
    { itemId: 310, name: 'Tree Root', chance: 25, minQuantity: 1, maxQuantity: 1, message: 'You dig up a gnarled tree root.' },
    { itemId: 311, name: 'Buried Bone', chance: 15, minQuantity: 1, maxQuantity: 1, message: 'You find an old bone. What creature did this belong to?' },
    { itemId: 312, name: 'Rusty Dagger', chance: 3, minQuantity: 1, maxQuantity: 1, minDepth: 3, message: 'Your shovel hits something metal - an old dagger, rusted but intact!' },
  ],
  deep_forest: [
    { itemId: 300, name: 'Rich Soil', chance: 40, minQuantity: 1, maxQuantity: 2, message: 'The forest floor yields dark soil.' },
    { itemId: 309, name: 'Mushroom', chance: 45, minQuantity: 2, maxQuantity: 4, message: 'Mushrooms are plentiful here in the deep shade.' },
    { itemId: 313, name: 'Strange Root', chance: 20, minQuantity: 1, maxQuantity: 1, message: 'You dig up a root that pulses faintly with an inner light.' },
    { itemId: 311, name: 'Buried Bone', chance: 20, minQuantity: 1, maxQuantity: 2, message: 'Old bones lie beneath the forest floor.' },
    { itemId: 314, name: 'Ancient Artifact', chance: 1, minQuantity: 1, maxQuantity: 1, minDepth: 4, message: 'You unearth something ancient - a carved stone figure covered in strange symbols!' },
  ],
  village_square: [
    { itemId: 300, name: 'Rich Soil', chance: 30, minQuantity: 1, maxQuantity: 1, message: 'You dig up some packed earth.' },
    { itemId: 303, name: 'Old Coin', chance: 15, minQuantity: 1, maxQuantity: 2, message: 'Coins dropped by careless merchants over the years!' },
    { itemId: 315, name: 'Broken Pottery', chance: 40, minQuantity: 1, maxQuantity: 3, message: 'Shards of old pottery - the village has stood here a long time.' },
    { itemId: 316, name: 'Lost Key', chance: 5, minQuantity: 1, maxQuantity: 1, message: 'You find an old key. Whose door did this open?' },
  ],
  underground_default: [
    { itemId: 317, name: 'Stone Chunk', chance: 70, minQuantity: 2, maxQuantity: 4, message: 'You break off chunks of stone.' },
    { itemId: 318, name: 'Iron Ore', chance: 20, minQuantity: 1, maxQuantity: 2, minDepth: 2, message: 'The rock here contains veins of iron ore!' },
    { itemId: 319, name: 'Coal', chance: 30, minQuantity: 1, maxQuantity: 3, message: 'You find a seam of coal.' },
    { itemId: 320, name: 'Crystal', chance: 5, minQuantity: 1, maxQuantity: 1, minDepth: 3, message: 'A beautiful crystal glints in the darkness!' },
    { itemId: 321, name: 'Ancient Relic', chance: 1, minQuantity: 1, maxQuantity: 1, minDepth: 5, message: 'You discover something incredible - an ancient relic from before Wilson\'s time!' },
  ],
};

// Default resources for areas not specifically defined
const DEFAULT_RESOURCES: ResourceDrop[] = [
  { itemId: 300, name: 'Rich Soil', chance: 40, minQuantity: 1, maxQuantity: 2, message: 'You dig up some ordinary soil.' },
  { itemId: 306, name: 'Smooth Stone', chance: 20, minQuantity: 1, maxQuantity: 1, message: 'You find a stone.' },
  { itemId: 303, name: 'Old Coin', chance: 3, minQuantity: 1, maxQuantity: 1, minDepth: 2, message: 'You find a lost coin!' },
];

// Fishing catches
const FISH_CATCHES: ResourceDrop[] = [
  { itemId: 330, name: 'Small Fish', chance: 50, minQuantity: 1, maxQuantity: 1, message: 'You catch a small fish. Not much, but it\'s food.' },
  { itemId: 331, name: 'River Trout', chance: 30, minQuantity: 1, maxQuantity: 1, message: 'A nice river trout! Harpua would be proud.' },
  { itemId: 332, name: 'Large Carp', chance: 15, minQuantity: 1, maxQuantity: 1, message: 'You land a big carp - this will make a good meal!' },
  { itemId: 333, name: 'Old Boot', chance: 10, minQuantity: 1, maxQuantity: 1, message: 'You fish up an old boot. Well, at least you tried.' },
  { itemId: 334, name: 'Golden Fish', chance: 2, minQuantity: 1, maxQuantity: 1, message: 'A golden fish! It shimmers with an otherworldly light...' },
];

// Wood from chopping
const WOOD_YIELDS: ResourceDrop[] = [
  { itemId: 340, name: 'Firewood', chance: 70, minQuantity: 2, maxQuantity: 4, message: 'You chop some firewood.' },
  { itemId: 341, name: 'Oak Log', chance: 40, minQuantity: 1, maxQuantity: 2, message: 'A solid oak log.' },
  { itemId: 342, name: 'Flexible Branch', chance: 30, minQuantity: 1, maxQuantity: 2, message: 'A flexible branch - good for crafting.' },
  { itemId: 343, name: 'Tree Sap', chance: 15, minQuantity: 1, maxQuantity: 1, message: 'You collect some sticky tree sap.' },
];

// Track dig depth per player per room (resets on room change)
const playerDigDepth: Map<string, number> = new Map();

function getDigKey(playerId: number, roomId: string): string {
  return `${playerId}:${roomId}`;
}

class ResourceManager {
  // Check if player has a tool of the given type
  hasToolOfType(playerId: number, toolType: string): { hasTool: boolean; toolName?: string } {
    const db = getDatabase();

    // Get player inventory
    const inventory = db.prepare(`
      SELECT item_template_id FROM player_inventory WHERE player_id = ?
    `).all(playerId) as { item_template_id: number }[];

    for (const item of inventory) {
      const template = itemTemplates.find(t => t.id === item.item_template_id);
      if (template && template.toolType === toolType) {
        return { hasTool: true, toolName: template.name };
      }
    }

    return { hasTool: false };
  }

  // Main DIG command handler
  dig(playerId: number, roomId: string): { success: boolean; message: string; items?: { name: string; quantity: number }[] } {
    // Check for shovel
    const { hasTool, toolName } = this.hasToolOfType(playerId, 'shovel');

    if (!hasTool) {
      return {
        success: false,
        message: 'You need a shovel to dig. Try buying one from the blacksmith.'
      };
    }

    // Get terrain type for this room
    const resources = TERRAIN_RESOURCES[roomId] || DEFAULT_RESOURCES;

    // Track dig depth
    const digKey = getDigKey(playerId, roomId);
    const currentDepth = (playerDigDepth.get(digKey) || 0) + 1;
    playerDigDepth.set(digKey, currentDepth);

    // Determine what was found
    const foundItems: { name: string; quantity: number; itemId: number; message: string }[] = [];

    for (const resource of resources) {
      // Check depth requirement
      if (resource.minDepth && currentDepth < resource.minDepth) {
        continue;
      }

      // Roll for this resource
      if (Math.random() * 100 < resource.chance) {
        const quantity = resource.minQuantity +
          Math.floor(Math.random() * (resource.maxQuantity - resource.minQuantity + 1));

        foundItems.push({
          name: resource.name,
          quantity,
          itemId: resource.itemId,
          message: resource.message
        });
      }
    }

    // Add items to inventory
    const db = getDatabase();
    for (const item of foundItems) {
      this.addResourceToInventory(playerId, item.itemId, item.quantity);
    }

    // Build response message
    if (foundItems.length === 0) {
      const emptyMessages = [
        'You dig but find nothing of interest.',
        'The earth yields nothing useful this time.',
        'Your shovel turns up only dirt.',
        'Nothing here. Maybe try a different spot?',
      ];
      return {
        success: true,
        message: `\n${emptyMessages[Math.floor(Math.random() * emptyMessages.length)]}\n[Dig depth: ${currentDepth}]`
      };
    }

    const messages = foundItems.map(item => item.message);
    const itemList = foundItems.map(item => `  • ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`);

    return {
      success: true,
      message: `\n${messages.join('\n')}\n\nYou found:\n${itemList.join('\n')}\n[Dig depth: ${currentDepth}]`,
      items: foundItems.map(i => ({ name: i.name, quantity: i.quantity }))
    };
  }

  // FISH command handler
  fish(playerId: number, roomId: string): { success: boolean; message: string } {
    // Check for fishing tool
    const { hasTool } = this.hasToolOfType(playerId, 'fishing');

    if (!hasTool) {
      return {
        success: false,
        message: 'You need a fishing line to fish. Try the market district.'
      };
    }

    // Can only fish in certain locations
    const fishableRooms = ['river_crossing', 'forest_stream'];
    if (!fishableRooms.includes(roomId)) {
      return {
        success: false,
        message: 'There\'s nowhere to fish here. Try the river.'
      };
    }

    // Fishing takes time - show waiting message
    const waitMessages = [
      'You cast your line into the water...',
      'You wait patiently, line in the water...',
      'The float bobs gently on the surface...',
    ];

    // Roll for a catch
    const roll = Math.random() * 100;
    let totalChance = 0;

    for (const fish of FISH_CATCHES) {
      totalChance += fish.chance;
      if (roll < totalChance) {
        // Caught something!
        this.addResourceToInventory(playerId, fish.itemId, fish.minQuantity);

        return {
          success: true,
          message: `\n${waitMessages[Math.floor(Math.random() * waitMessages.length)]}\n\n${fish.message}\n[+${fish.name}]`
        };
      }
    }

    // Nothing caught
    const failMessages = [
      'The fish aren\'t biting today.',
      'Something nibbled but got away.',
      'You wait and wait, but nothing bites.',
    ];

    return {
      success: true,
      message: `\n${waitMessages[Math.floor(Math.random() * waitMessages.length)]}\n\n${failMessages[Math.floor(Math.random() * failMessages.length)]}`
    };
  }

  // CHOP command handler
  chop(playerId: number, roomId: string): { success: boolean; message: string } {
    // Check for axe
    const { hasTool } = this.hasToolOfType(playerId, 'axe');

    if (!hasTool) {
      return {
        success: false,
        message: 'You need an axe to chop wood. The blacksmith sells them.'
      };
    }

    // Can only chop in forest areas
    const forestRooms = ['forest_edge', 'deep_forest', 'great_tree', 'hidden_glade', 'forest_stream'];
    if (!forestRooms.includes(roomId)) {
      return {
        success: false,
        message: 'There are no trees to chop here. Try the forest.'
      };
    }

    // Roll for wood
    const foundItems: { name: string; quantity: number; itemId: number; message: string }[] = [];

    for (const wood of WOOD_YIELDS) {
      if (Math.random() * 100 < wood.chance) {
        const quantity = wood.minQuantity +
          Math.floor(Math.random() * (wood.maxQuantity - wood.minQuantity + 1));

        foundItems.push({
          name: wood.name,
          quantity,
          itemId: wood.itemId,
          message: wood.message
        });
      }
    }

    // Add to inventory
    const db = getDatabase();
    for (const item of foundItems) {
      this.addResourceToInventory(playerId, item.itemId, item.quantity);
    }

    if (foundItems.length === 0) {
      return {
        success: true,
        message: '\nYou swing your axe but the tree proves stubborn. Try again.'
      };
    }

    const itemList = foundItems.map(item => `  • ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`);

    return {
      success: true,
      message: `\nYou swing your axe, chips flying...\n\nYou gathered:\n${itemList.join('\n')}`
    };
  }

  // MINE command handler
  mine(playerId: number, roomId: string): { success: boolean; message: string } {
    // Check for pickaxe
    const { hasTool } = this.hasToolOfType(playerId, 'pickaxe');

    if (!hasTool) {
      return {
        success: false,
        message: 'You need a pickaxe to mine. The blacksmith might have one.'
      };
    }

    // Can only mine in underground/rocky areas
    const mineableRooms = ['the_underground', 'castle_dungeon', 'tower_base'];
    if (!mineableRooms.includes(roomId)) {
      return {
        success: false,
        message: 'There\'s no rock to mine here. Try underground areas.'
      };
    }

    // Use underground resources
    const resources = TERRAIN_RESOURCES['underground_default'];

    // Track mining depth similar to digging
    const mineKey = getDigKey(playerId, roomId);
    const currentDepth = (playerDigDepth.get(mineKey) || 0) + 1;
    playerDigDepth.set(mineKey, currentDepth);

    const foundItems: { name: string; quantity: number; itemId: number; message: string }[] = [];

    for (const resource of resources) {
      if (resource.minDepth && currentDepth < resource.minDepth) {
        continue;
      }

      if (Math.random() * 100 < resource.chance) {
        const quantity = resource.minQuantity +
          Math.floor(Math.random() * (resource.maxQuantity - resource.minQuantity + 1));

        foundItems.push({
          name: resource.name,
          quantity,
          itemId: resource.itemId,
          message: resource.message
        });
      }
    }

    // Add to inventory
    for (const item of foundItems) {
      this.addResourceToInventory(playerId, item.itemId, item.quantity);
    }

    if (foundItems.length === 0) {
      return {
        success: true,
        message: `\nYour pickaxe strikes rock, but you find nothing valuable.\n[Mine depth: ${currentDepth}]`
      };
    }

    const itemList = foundItems.map(item => `  • ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`);

    return {
      success: true,
      message: `\nYou swing your pickaxe at the rock face...\n\nYou found:\n${itemList.join('\n')}\n[Mine depth: ${currentDepth}]`
    };
  }

  // Add resource item to player inventory (create if template doesn't exist as real item)
  private addResourceToInventory(playerId: number, itemId: number, quantity: number): void {
    const db = getDatabase();

    // Check if player already has this item
    const existing = db.prepare(`
      SELECT id, quantity FROM player_inventory
      WHERE player_id = ? AND item_template_id = ?
    `).get(playerId, itemId) as { id: number; quantity: number } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?
      `).run(quantity, existing.id);
    } else {
      db.prepare(`
        INSERT INTO player_inventory (player_id, item_template_id, quantity)
        VALUES (?, ?, ?)
      `).run(playerId, itemId, quantity);
    }
  }

  // Reset dig depth when player moves
  onPlayerMove(playerId: number, fromRoom: string): void {
    const digKey = getDigKey(playerId, fromRoom);
    playerDigDepth.delete(digKey);
  }
}

export const resourceManager = new ResourceManager();
