// Building Manager for FROBARK
// Allows players to purchase plots and build structures
// Buildings are rendered as ASCII art grids

import { getDatabase } from '../database';
import { connectionManager } from './connectionManager';

// Structure types that can be built
interface StructureType {
  id: string;
  name: string;
  char: string;           // ASCII character to display
  materialCost: { itemId: number; quantity: number }[];
  description: string;
}

const STRUCTURE_TYPES: Record<string, StructureType> = {
  wall: {
    id: 'wall',
    name: 'Wall',
    char: '#',
    materialCost: [{ itemId: 341, quantity: 2 }], // 2 Oak Logs
    description: 'A solid wooden wall',
  },
  door: {
    id: 'door',
    name: 'Door',
    char: 'D',
    materialCost: [{ itemId: 341, quantity: 1 }, { itemId: 318, quantity: 1 }], // 1 Oak Log, 1 Iron Ore
    description: 'A wooden door with iron hinges',
  },
  window: {
    id: 'window',
    name: 'Window',
    char: 'W',
    materialCost: [{ itemId: 305, quantity: 3 }], // 3 River Sand (for glass)
    description: 'A glass window',
  },
  floor: {
    id: 'floor',
    name: 'Floor',
    char: '.',
    materialCost: [{ itemId: 317, quantity: 1 }], // 1 Stone Chunk
    description: 'A stone floor',
  },
  bed: {
    id: 'bed',
    name: 'Bed',
    char: 'B',
    materialCost: [{ itemId: 341, quantity: 2 }, { itemId: 342, quantity: 2 }], // Wood + branches
    description: 'A simple bed for resting',
  },
  table: {
    id: 'table',
    name: 'Table',
    char: 'T',
    materialCost: [{ itemId: 341, quantity: 1 }], // 1 Oak Log
    description: 'A wooden table',
  },
  chair: {
    id: 'chair',
    name: 'Chair',
    char: 'c',
    materialCost: [{ itemId: 341, quantity: 1 }], // 1 Oak Log
    description: 'A wooden chair',
  },
  chest: {
    id: 'chest',
    name: 'Storage Chest',
    char: 'C',
    materialCost: [{ itemId: 341, quantity: 2 }, { itemId: 318, quantity: 1 }], // Wood + Iron
    description: 'A chest for storing items',
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    char: 'F',
    materialCost: [{ itemId: 317, quantity: 5 }, { itemId: 319, quantity: 3 }], // Stone + Coal
    description: 'A forge for metalworking',
  },
};

// Rooms where plots can be purchased
const BUILDABLE_ROOMS: Record<string, { maxPlots: number; plotPrice: number; plotWidth: number; plotHeight: number }> = {
  lizard_homes_west: { maxPlots: 5, plotPrice: 200, plotWidth: 12, plotHeight: 8 },
  farmlands: { maxPlots: 3, plotPrice: 150, plotWidth: 15, plotHeight: 10 },
  market_district: { maxPlots: 2, plotPrice: 500, plotWidth: 10, plotHeight: 8 },
  forest_edge: { maxPlots: 2, plotPrice: 100, plotWidth: 10, plotHeight: 8 },
};

class BuildingManager {
  // Get available plots in a room
  getAvailablePlots(roomId: string): { plotNumber: number; price: number; width: number; height: number; owned: boolean; ownerName?: string }[] {
    const db = getDatabase();
    const config = BUILDABLE_ROOMS[roomId];

    if (!config) {
      return [];
    }

    const plots: { plotNumber: number; price: number; width: number; height: number; owned: boolean; ownerName?: string }[] = [];

    for (let i = 1; i <= config.maxPlots; i++) {
      const existing = db.prepare(`
        SELECT bp.*, p.name as owner_name
        FROM building_plots bp
        LEFT JOIN players p ON bp.owner_player_id = p.id
        WHERE bp.room_id = ? AND bp.plot_number = ?
      `).get(roomId, i) as { owner_player_id: number | null; owner_name: string | null } | undefined;

      plots.push({
        plotNumber: i,
        price: config.plotPrice,
        width: config.plotWidth,
        height: config.plotHeight,
        owned: existing?.owner_player_id != null,
        ownerName: existing?.owner_name || undefined,
      });
    }

    return plots;
  }

  // Purchase a plot
  purchasePlot(playerId: number, roomId: string, plotNumber: number): { success: boolean; message: string } {
    const db = getDatabase();
    const config = BUILDABLE_ROOMS[roomId];

    if (!config) {
      return { success: false, message: 'You cannot purchase land here.' };
    }

    if (plotNumber < 1 || plotNumber > config.maxPlots) {
      return { success: false, message: `Invalid plot number. This area has plots 1-${config.maxPlots}.` };
    }

    // Check if plot is available
    const existing = db.prepare(`
      SELECT owner_player_id FROM building_plots
      WHERE room_id = ? AND plot_number = ?
    `).get(roomId, plotNumber) as { owner_player_id: number | null } | undefined;

    if (existing?.owner_player_id) {
      return { success: false, message: 'This plot is already owned by someone.' };
    }

    // Check player gold
    const player = db.prepare(`SELECT gold FROM players WHERE id = ?`).get(playerId) as { gold: number } | undefined;

    if (!player || player.gold < config.plotPrice) {
      return { success: false, message: `You need ${config.plotPrice} gold to purchase this plot. You have ${player?.gold || 0}.` };
    }

    // Purchase the plot
    db.prepare(`UPDATE players SET gold = gold - ? WHERE id = ?`).run(config.plotPrice, playerId);

    if (existing) {
      // Update existing row
      db.prepare(`
        UPDATE building_plots
        SET owner_player_id = ?, purchased_at = CURRENT_TIMESTAMP
        WHERE room_id = ? AND plot_number = ?
      `).run(playerId, roomId, plotNumber);
    } else {
      // Create new plot
      db.prepare(`
        INSERT INTO building_plots (room_id, plot_number, width, height, owner_player_id, purchase_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(roomId, plotNumber, config.plotWidth, config.plotHeight, playerId, config.plotPrice);
    }

    return {
      success: true,
      message: `Congratulations! You now own Plot #${plotNumber} in this area!\nUse "survey" to see your plot and "build" to start construction.`
    };
  }

  // Get player's plot in current room (if any)
  getPlayerPlot(playerId: number, roomId: string): { plotId: number; plotNumber: number; width: number; height: number } | null {
    const db = getDatabase();

    const plot = db.prepare(`
      SELECT id, plot_number, width, height
      FROM building_plots
      WHERE room_id = ? AND owner_player_id = ?
    `).get(roomId, playerId) as { id: number; plot_number: number; width: number; height: number } | undefined;

    return plot ? { plotId: plot.id, plotNumber: plot.plot_number, width: plot.width, height: plot.height } : null;
  }

  // Survey a plot - render as ASCII
  surveyPlot(playerId: number, roomId: string): { success: boolean; message: string } {
    const plot = this.getPlayerPlot(playerId, roomId);

    if (!plot) {
      return {
        success: false,
        message: 'You don\'t own a plot here. Use "plots" to see available land.'
      };
    }

    const db = getDatabase();

    // Get all structures on this plot
    const structures = db.prepare(`
      SELECT x, y, structure_type, ascii_char
      FROM built_structures
      WHERE plot_id = ?
    `).all(plot.plotId) as { x: number; y: number; structure_type: string; ascii_char: string }[];

    // Build the grid
    const grid: string[][] = [];
    for (let y = 0; y < plot.height; y++) {
      grid[y] = [];
      for (let x = 0; x < plot.width; x++) {
        grid[y][x] = '·'; // Empty space
      }
    }

    // Place structures
    for (const struct of structures) {
      if (struct.y >= 0 && struct.y < plot.height && struct.x >= 0 && struct.x < plot.width) {
        grid[struct.y][struct.x] = struct.ascii_char;
      }
    }

    // Render the grid
    const lines: string[] = [];
    lines.push('');
    lines.push(`╔${'═'.repeat(plot.width + 2)}╗`);
    lines.push(`║ Your Plot #${plot.plotNumber} (${plot.width}x${plot.height}) ║`);
    lines.push(`╠${'═'.repeat(plot.width + 2)}╣`);

    // Top border with coordinates
    let coordLine = '║  ';
    for (let x = 0; x < plot.width; x++) {
      coordLine += (x % 5 === 0) ? String(x % 10) : ' ';
    }
    coordLine += ' ║';
    lines.push(coordLine);

    // Grid rows
    for (let y = 0; y < plot.height; y++) {
      const row = grid[y].join('');
      const yLabel = (y % 5 === 0) ? String(y % 10) : ' ';
      lines.push(`║${yLabel} ${row} ║`);
    }

    lines.push(`╠${'═'.repeat(plot.width + 2)}╣`);
    lines.push('║ Legend:                   ║');
    lines.push('║ · Empty  # Wall  D Door  ║');
    lines.push('║ W Window B Bed   T Table ║');
    lines.push('║ c Chair  C Chest F Forge ║');
    lines.push(`╚${'═'.repeat(plot.width + 2)}╝`);
    lines.push('');
    lines.push('Use: build <type> <x> <y>');
    lines.push('     demolish <x> <y>');
    lines.push('');

    return { success: true, message: lines.join('\n') };
  }

  // Build a structure at coordinates
  build(playerId: number, roomId: string, structureType: string, x: number, y: number): { success: boolean; message: string } {
    const plot = this.getPlayerPlot(playerId, roomId);

    if (!plot) {
      return { success: false, message: 'You don\'t own a plot here.' };
    }

    const structure = STRUCTURE_TYPES[structureType.toLowerCase()];
    if (!structure) {
      const validTypes = Object.keys(STRUCTURE_TYPES).join(', ');
      return { success: false, message: `Unknown structure type. Valid types: ${validTypes}` };
    }

    // Validate coordinates
    if (x < 0 || x >= plot.width || y < 0 || y >= plot.height) {
      return { success: false, message: `Invalid coordinates. Plot is ${plot.width}x${plot.height} (0-${plot.width - 1}, 0-${plot.height - 1}).` };
    }

    const db = getDatabase();

    // Check if space is empty
    const existing = db.prepare(`
      SELECT id FROM built_structures WHERE plot_id = ? AND x = ? AND y = ?
    `).get(plot.plotId, x, y);

    if (existing) {
      return { success: false, message: 'There\'s already something built there. Demolish it first.' };
    }

    // Check materials
    for (const cost of structure.materialCost) {
      const hasItem = db.prepare(`
        SELECT quantity FROM player_inventory
        WHERE player_id = ? AND item_template_id = ?
      `).get(playerId, cost.itemId) as { quantity: number } | undefined;

      if (!hasItem || hasItem.quantity < cost.quantity) {
        return { success: false, message: `You need more materials. Check your inventory with "i".` };
      }
    }

    // Deduct materials
    for (const cost of structure.materialCost) {
      db.prepare(`
        UPDATE player_inventory
        SET quantity = quantity - ?
        WHERE player_id = ? AND item_template_id = ?
      `).run(cost.quantity, playerId, cost.itemId);

      // Remove items with 0 quantity
      db.prepare(`
        DELETE FROM player_inventory WHERE player_id = ? AND item_template_id = ? AND quantity <= 0
      `).run(playerId, cost.itemId);
    }

    // Build the structure
    db.prepare(`
      INSERT INTO built_structures (plot_id, x, y, structure_type, ascii_char, builder_player_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(plot.plotId, x, y, structure.id, structure.char, playerId);

    return {
      success: true,
      message: `You built a ${structure.name} at (${x}, ${y})!\nUse "survey" to see your plot.`
    };
  }

  // Demolish a structure
  demolish(playerId: number, roomId: string, x: number, y: number): { success: boolean; message: string } {
    const plot = this.getPlayerPlot(playerId, roomId);

    if (!plot) {
      return { success: false, message: 'You don\'t own a plot here.' };
    }

    const db = getDatabase();

    // Check if there's something there
    const existing = db.prepare(`
      SELECT id, structure_type FROM built_structures WHERE plot_id = ? AND x = ? AND y = ?
    `).get(plot.plotId, x, y) as { id: number; structure_type: string } | undefined;

    if (!existing) {
      return { success: false, message: 'There\'s nothing built at those coordinates.' };
    }

    // Remove it
    db.prepare(`DELETE FROM built_structures WHERE id = ?`).run(existing.id);

    const structure = STRUCTURE_TYPES[existing.structure_type];

    return {
      success: true,
      message: `You demolished the ${structure?.name || 'structure'} at (${x}, ${y}).`
    };
  }

  // List structure types and their costs
  listBuildOptions(): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('╔═══════════════════════════════════════════════════╗');
    lines.push('║              BUILDING MATERIALS                   ║');
    lines.push('╠═══════════════════════════════════════════════════╣');

    for (const [key, struct] of Object.entries(STRUCTURE_TYPES)) {
      const costs = struct.materialCost.map(c => {
        // Get item name from templates (simplified - in real code would look up)
        const itemNames: Record<number, string> = {
          305: 'River Sand',
          317: 'Stone Chunk',
          318: 'Iron Ore',
          319: 'Coal',
          341: 'Oak Log',
          342: 'Flex. Branch',
        };
        return `${c.quantity}x ${itemNames[c.itemId] || 'Item'}`;
      }).join(', ');

      lines.push(`║  ${struct.char} ${struct.name.padEnd(15)} ${costs.padEnd(26)} ║`);
    }

    lines.push('╠═══════════════════════════════════════════════════╣');
    lines.push('║  Gather resources with: dig, chop, mine           ║');
    lines.push('║  Build with: build <type> <x> <y>                 ║');
    lines.push('╚═══════════════════════════════════════════════════╝');
    lines.push('');

    return lines.join('\n');
  }
}

export const buildingManager = new BuildingManager();
