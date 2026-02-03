// Creative Manager for FROBARK
// Handles player-created content: books, artwork, and music
// These persistent creations allow players to leave their mark on the world

import { getDatabase } from '../database';
import { connectionManager } from './connectionManager';

// Book structure
interface BookPage {
  pageNumber: number;
  content: string;
}

interface Book {
  id: number;
  authorId: number;
  authorName: string;
  title: string;
  pages: BookPage[];
  published: boolean;
  copiesSold: number;
  locationRoom: string | null;
  createdAt: string;
}

// Artwork structure (ASCII art)
interface Artwork {
  id: number;
  artistId: number;
  artistName: string;
  title: string;
  asciiArt: string;
  width: number;
  height: number;
  displayedRoom: string | null;
  ownerId: number | null;
  forSale: boolean;
  price: number;
  createdAt: string;
}

// Music composition
interface Composition {
  id: number;
  composerId: number;
  composerName: string;
  title: string;
  notation: string;
  instrument: string;
  timesPerformed: number;
  createdAt: string;
}

// Player's current creative work in progress
interface WorkInProgress {
  type: 'book' | 'artwork' | 'composition';
  title: string;
  content: string; // For books: JSON stringified pages, for art: the ASCII, for music: notation
  width?: number;
  height?: number;
  instrument?: string;
}

class CreativeManager {
  // === BOOKS ===

  // Start writing a new book
  startBook(playerId: number, title: string): { success: boolean; message: string } {
    if (!title || title.length < 2) {
      return { success: false, message: 'Please provide a title for your book.' };
    }

    if (title.length > 50) {
      return { success: false, message: 'Title is too long. Maximum 50 characters.' };
    }

    const db = getDatabase();

    // Check if player already has a work in progress
    const existing = db.prepare(`
      SELECT type, title FROM player_creative_wip WHERE player_id = ?
    `).get(playerId) as { type: string; title: string } | undefined;

    if (existing) {
      return {
        success: false,
        message: `You're already working on a ${existing.type}: "${existing.title}"\nUse "finish" to complete it or "abandon" to discard it.`
      };
    }

    // Start new work
    const initialContent = JSON.stringify([{ pageNumber: 1, content: '' }]);
    db.prepare(`
      INSERT INTO player_creative_wip (player_id, type, title, content)
      VALUES (?, 'book', ?, ?)
    `).run(playerId, title, initialContent);

    return {
      success: true,
      message: `You begin writing "${title}".\n\nCommands:\n  page <num>    - Go to page\n  write <text>  - Add text to current page\n  read          - Read what you've written\n  newpage       - Add a new page\n  finish        - Complete and save the book\n  abandon       - Discard your work`
    };
  }

  // Write content to current book page
  writeToBook(playerId: number, text: string): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, content FROM player_creative_wip
      WHERE player_id = ? AND type = 'book'
    `).get(playerId) as { id: number; content: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not writing a book. Use "write <title>" to start one.' };
    }

    const pages: BookPage[] = JSON.parse(wip.content);
    const currentPage = pages[pages.length - 1];

    // Append text to current page (max 500 chars per page)
    const newContent = currentPage.content + (currentPage.content ? '\n' : '') + text;
    if (newContent.length > 500) {
      return { success: false, message: 'This page is full! Use "newpage" to add another page.' };
    }

    currentPage.content = newContent;

    db.prepare(`UPDATE player_creative_wip SET content = ? WHERE id = ?`)
      .run(JSON.stringify(pages), wip.id);

    return {
      success: true,
      message: `You write: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n[Page ${currentPage.pageNumber}, ${newContent.length}/500 characters]`
    };
  }

  // Add a new page to the book
  addBookPage(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, content FROM player_creative_wip
      WHERE player_id = ? AND type = 'book'
    `).get(playerId) as { id: number; content: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not writing a book.' };
    }

    const pages: BookPage[] = JSON.parse(wip.content);

    if (pages.length >= 20) {
      return { success: false, message: 'Your book has reached the maximum of 20 pages.' };
    }

    pages.push({ pageNumber: pages.length + 1, content: '' });

    db.prepare(`UPDATE player_creative_wip SET content = ? WHERE id = ?`)
      .run(JSON.stringify(pages), wip.id);

    return {
      success: true,
      message: `You turn to a fresh page. [Now on page ${pages.length}]`
    };
  }

  // Read the current work in progress
  readWip(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT type, title, content, width, height FROM player_creative_wip
      WHERE player_id = ?
    `).get(playerId) as { type: string; title: string; content: string; width: number | null; height: number | null } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not working on anything creative right now.' };
    }

    if (wip.type === 'book') {
      const pages: BookPage[] = JSON.parse(wip.content);
      const lines: string[] = [
        '',
        `╔════════════════════════════════════════════════════╗`,
        `║  "${wip.title}"  (Work in Progress)`,
        `╠════════════════════════════════════════════════════╣`,
      ];

      for (const page of pages) {
        lines.push(`║  --- Page ${page.pageNumber} ---`);
        if (page.content) {
          const contentLines = page.content.split('\n');
          for (const line of contentLines) {
            lines.push(`║  ${line}`);
          }
        } else {
          lines.push(`║  (blank)`);
        }
      }

      lines.push(`╚════════════════════════════════════════════════════╝`);
      lines.push('');

      return { success: true, message: lines.join('\n') };
    } else if (wip.type === 'artwork') {
      const lines: string[] = [
        '',
        `╔════════════════════════════════════════════════════╗`,
        `║  "${wip.title}"  (Work in Progress)`,
        `╠════════════════════════════════════════════════════╣`,
        wip.content || '(blank canvas)',
        `╚════════════════════════════════════════════════════╝`,
        '',
      ];
      return { success: true, message: lines.join('\n') };
    } else if (wip.type === 'composition') {
      return {
        success: true,
        message: `\n"${wip.title}" (composition in progress)\nNotation: ${wip.content || '(no notes yet)'}\n`
      };
    }

    return { success: false, message: 'Unknown work type.' };
  }

  // Finish and publish a book
  finishBook(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, title, content FROM player_creative_wip
      WHERE player_id = ? AND type = 'book'
    `).get(playerId) as { id: number; title: string; content: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not writing a book.' };
    }

    const pages: BookPage[] = JSON.parse(wip.content);
    const hasContent = pages.some(p => p.content.length > 0);

    if (!hasContent) {
      return { success: false, message: 'Your book has no content! Write something first.' };
    }

    // Get player name
    const player = db.prepare(`SELECT name FROM players WHERE id = ?`).get(playerId) as { name: string };

    // Save the book
    db.prepare(`
      INSERT INTO player_books (author_id, title, content, published, copies_sold)
      VALUES (?, ?, ?, 1, 0)
    `).run(playerId, wip.title, wip.content);

    // Remove work in progress
    db.prepare(`DELETE FROM player_creative_wip WHERE id = ?`).run(wip.id);

    return {
      success: true,
      message: `Congratulations! You have completed "${wip.title}"!\n\nYour book has been published. Others can now read it.\nUse "drop book" to leave a copy somewhere in the world.`
    };
  }

  // Abandon work in progress
  abandonWip(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, type, title FROM player_creative_wip WHERE player_id = ?
    `).get(playerId) as { id: number; type: string; title: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not working on anything creative.' };
    }

    db.prepare(`DELETE FROM player_creative_wip WHERE id = ?`).run(wip.id);

    return {
      success: true,
      message: `You crumple up "${wip.title}" and toss it away. The ${wip.type} is lost forever.`
    };
  }

  // Read a published book
  readBook(playerId: number, titleKeyword: string): { success: boolean; message: string } {
    const db = getDatabase();

    // First check player's inventory for books
    // Then check books in the current room
    // Then check all published books

    const book = db.prepare(`
      SELECT pb.*, p.name as author_name
      FROM player_books pb
      JOIN players p ON pb.author_id = p.id
      WHERE pb.title LIKE ? AND pb.published = 1
      LIMIT 1
    `).get(`%${titleKeyword}%`) as {
      id: number;
      author_id: number;
      author_name: string;
      title: string;
      content: string;
      copies_sold: number;
    } | undefined;

    if (!book) {
      return { success: false, message: `You can't find a book called "${titleKeyword}".` };
    }

    const pages: BookPage[] = JSON.parse(book.content);
    const lines: string[] = [
      '',
      `╔════════════════════════════════════════════════════════╗`,
      `║  "${book.title}"`,
      `║  by ${book.author_name}`,
      `╠════════════════════════════════════════════════════════╣`,
    ];

    for (const page of pages) {
      lines.push(`║  --- Page ${page.pageNumber} ---`);
      if (page.content) {
        const contentLines = page.content.split('\n');
        for (const line of contentLines) {
          lines.push(`║  ${line}`);
        }
      }
      lines.push('║');
    }

    lines.push(`╚════════════════════════════════════════════════════════╝`);
    lines.push('');

    return { success: true, message: lines.join('\n') };
  }

  // List all books by a player
  listPlayerBooks(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const books = db.prepare(`
      SELECT id, title, published, copies_sold, created_at
      FROM player_books
      WHERE author_id = ?
      ORDER BY created_at DESC
    `).all(playerId) as { id: number; title: string; published: number; copies_sold: number; created_at: string }[];

    if (books.length === 0) {
      return { success: true, message: '\nYou haven\'t written any books yet.\nUse "write <title>" to start one.\n' };
    }

    const lines: string[] = ['', '╔═══════════════════════════════════════╗'];
    lines.push('║          YOUR WRITTEN WORKS           ║');
    lines.push('╠═══════════════════════════════════════╣');

    for (const book of books) {
      const status = book.published ? '✓ Published' : '○ Draft';
      lines.push(`║  "${book.title}"`);
      lines.push(`║     ${status}`);
    }

    lines.push('╚═══════════════════════════════════════╝');
    lines.push('');

    return { success: true, message: lines.join('\n') };
  }

  // === ARTWORK ===

  // Start a new artwork
  startArtwork(playerId: number, title: string, width: number = 20, height: number = 10): { success: boolean; message: string } {
    if (!title || title.length < 2) {
      return { success: false, message: 'Please provide a title for your artwork.' };
    }

    // Clamp dimensions
    width = Math.min(Math.max(width, 5), 40);
    height = Math.min(Math.max(height, 3), 20);

    const db = getDatabase();

    const existing = db.prepare(`
      SELECT type, title FROM player_creative_wip WHERE player_id = ?
    `).get(playerId) as { type: string; title: string } | undefined;

    if (existing) {
      return {
        success: false,
        message: `You're already working on a ${existing.type}: "${existing.title}"\nUse "finish" or "abandon" first.`
      };
    }

    // Create blank canvas
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      rows.push(' '.repeat(width));
    }
    const blankCanvas = rows.join('\n');

    db.prepare(`
      INSERT INTO player_creative_wip (player_id, type, title, content, width, height)
      VALUES (?, 'artwork', ?, ?, ?, ?)
    `).run(playerId, title, blankCanvas, width, height);

    return {
      success: true,
      message: `You prepare a ${width}x${height} canvas for "${title}".\n\nCommands:\n  draw <x> <y> <char>  - Place a character\n  erase <x> <y>        - Clear a position\n  preview              - View your work\n  finish               - Complete the artwork\n  abandon              - Discard your work`
    };
  }

  // Draw on canvas
  drawOnCanvas(playerId: number, x: number, y: number, char: string): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, content, width, height FROM player_creative_wip
      WHERE player_id = ? AND type = 'artwork'
    `).get(playerId) as { id: number; content: string; width: number; height: number } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not working on an artwork. Use "paint <title>" to start.' };
    }

    if (x < 0 || x >= wip.width || y < 0 || y >= wip.height) {
      return { success: false, message: `Coordinates out of bounds. Canvas is ${wip.width}x${wip.height}.` };
    }

    // Take first character only
    const drawChar = char.charAt(0) || ' ';

    // Parse canvas and modify
    const rows = wip.content.split('\n');
    const row = rows[y].split('');
    row[x] = drawChar;
    rows[y] = row.join('');

    db.prepare(`UPDATE player_creative_wip SET content = ? WHERE id = ?`)
      .run(rows.join('\n'), wip.id);

    return {
      success: true,
      message: `You draw "${drawChar}" at (${x}, ${y}).`
    };
  }

  // Finish artwork
  finishArtwork(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, title, content, width, height FROM player_creative_wip
      WHERE player_id = ? AND type = 'artwork'
    `).get(playerId) as { id: number; title: string; content: string; width: number; height: number } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not working on an artwork.' };
    }

    // Check if it's not just blank
    const isBlank = wip.content.trim().length === 0;
    if (isBlank) {
      return { success: false, message: 'Your canvas is blank! Draw something first.' };
    }

    // Save artwork
    db.prepare(`
      INSERT INTO artwork (artist_id, title, ascii_art, width, height, for_sale, price)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(playerId, wip.title, wip.content, wip.width, wip.height);

    db.prepare(`DELETE FROM player_creative_wip WHERE id = ?`).run(wip.id);

    return {
      success: true,
      message: `You sign your artwork "${wip.title}"!\n\nYou can display it in your home or sell it to others.`
    };
  }

  // View an artwork
  viewArtwork(playerId: number, titleKeyword: string): { success: boolean; message: string } {
    const db = getDatabase();

    const artwork = db.prepare(`
      SELECT pa.*, p.name as artist_name
      FROM artwork pa
      JOIN players p ON pa.artist_id = p.id
      WHERE pa.title LIKE ?
      LIMIT 1
    `).get(`%${titleKeyword}%`) as {
      id: number;
      artist_id: number;
      artist_name: string;
      title: string;
      ascii_art: string;
    } | undefined;

    if (!artwork) {
      return { success: false, message: `You can't find an artwork called "${titleKeyword}".` };
    }

    const lines: string[] = [
      '',
      `╔════════════════════════════════════════════════════════╗`,
      `║  "${artwork.title}"`,
      `║  by ${artwork.artist_name}`,
      `╠════════════════════════════════════════════════════════╣`,
      artwork.ascii_art,
      `╚════════════════════════════════════════════════════════╝`,
      '',
    ];

    return { success: true, message: lines.join('\n') };
  }

  // === MUSIC ===

  // Start composing
  startComposition(playerId: number, title: string, instrument: string = 'voice'): { success: boolean; message: string } {
    if (!title || title.length < 2) {
      return { success: false, message: 'Please provide a title for your composition.' };
    }

    const validInstruments = ['voice', 'lute', 'flute', 'drum', 'harp'];
    instrument = instrument.toLowerCase();
    if (!validInstruments.includes(instrument)) {
      instrument = 'voice';
    }

    const db = getDatabase();

    const existing = db.prepare(`
      SELECT type, title FROM player_creative_wip WHERE player_id = ?
    `).get(playerId) as { type: string; title: string } | undefined;

    if (existing) {
      return {
        success: false,
        message: `You're already working on a ${existing.type}: "${existing.title}"\nUse "finish" or "abandon" first.`
      };
    }

    db.prepare(`
      INSERT INTO player_creative_wip (player_id, type, title, content, instrument)
      VALUES (?, 'composition', ?, '', ?)
    `).run(playerId, title, instrument);

    return {
      success: true,
      message: `You begin composing "${title}" for ${instrument}.\n\nCommands:\n  compose <notes>  - Add musical notes\n  preview          - Listen to what you've composed\n  finish           - Complete the composition\n  abandon          - Discard your work`
    };
  }

  // Add notes to composition
  addNotes(playerId: number, notes: string): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, content FROM player_creative_wip
      WHERE player_id = ? AND type = 'composition'
    `).get(playerId) as { id: number; content: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not composing anything. Use "compose <title>" to start.' };
    }

    const newContent = wip.content + (wip.content ? ' ' : '') + notes;
    if (newContent.length > 300) {
      return { success: false, message: 'Your composition is getting too long! Finish it or start a new one.' };
    }

    db.prepare(`UPDATE player_creative_wip SET content = ? WHERE id = ?`)
      .run(newContent, wip.id);

    return {
      success: true,
      message: `You add: ${notes}\nNotation so far: ${newContent}`
    };
  }

  // Finish composition
  finishComposition(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const wip = db.prepare(`
      SELECT id, title, content, instrument FROM player_creative_wip
      WHERE player_id = ? AND type = 'composition'
    `).get(playerId) as { id: number; title: string; content: string; instrument: string } | undefined;

    if (!wip) {
      return { success: false, message: 'You\'re not composing anything.' };
    }

    if (!wip.content || wip.content.length < 5) {
      return { success: false, message: 'Your composition needs more notes!' };
    }

    db.prepare(`
      INSERT INTO compositions (composer_id, title, notation, instrument, times_performed)
      VALUES (?, ?, ?, ?, 0)
    `).run(playerId, wip.title, wip.content, wip.instrument);

    db.prepare(`DELETE FROM player_creative_wip WHERE id = ?`).run(wip.id);

    return {
      success: true,
      message: `You complete "${wip.title}"!\n\nUse "play <title>" to perform it for others.`
    };
  }

  // Perform a composition
  performMusic(playerId: number, roomId: string, titleKeyword: string): { success: boolean; message: string; broadcastText?: string } {
    const db = getDatabase();

    // Find the composition
    const composition = db.prepare(`
      SELECT pc.*, p.name as composer_name
      FROM compositions pc
      JOIN players p ON pc.composer_id = p.id
      WHERE pc.composer_id = ? AND pc.title LIKE ?
      LIMIT 1
    `).get(playerId, `%${titleKeyword}%`) as {
      id: number;
      title: string;
      notation: string;
      instrument: string;
      times_performed: number;
      composer_name: string;
    } | undefined;

    if (!composition) {
      return { success: false, message: `You don't know a composition called "${titleKeyword}".` };
    }

    // Get player name
    const player = db.prepare(`SELECT name FROM players WHERE id = ?`).get(playerId) as { name: string };

    // Update times performed
    db.prepare(`UPDATE compositions SET times_performed = times_performed + 1 WHERE id = ?`)
      .run(composition.id);

    // Generate performance description based on instrument
    const instrumentDescriptions: Record<string, string> = {
      voice: 'begins to sing',
      lute: 'strums their lute',
      flute: 'raises a flute to their lips',
      drum: 'beats a rhythm on their drum',
      harp: 'plucks the strings of a harp',
    };

    const action = instrumentDescriptions[composition.instrument] || 'performs';
    const broadcastText = `${player.name} ${action}, playing "${composition.title}".\nThe melody fills the air: ${composition.notation}`;

    return {
      success: true,
      message: `You perform "${composition.title}".`,
      broadcastText
    };
  }

  // List player's compositions
  listPlayerCompositions(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const compositions = db.prepare(`
      SELECT title, instrument, times_performed
      FROM compositions
      WHERE composer_id = ?
      ORDER BY created_at DESC
    `).all(playerId) as { title: string; instrument: string; times_performed: number }[];

    if (compositions.length === 0) {
      return { success: true, message: '\nYou haven\'t composed any music yet.\nUse "compose <title>" to start.\n' };
    }

    const lines: string[] = ['', '╔═══════════════════════════════════════╗'];
    lines.push('║          YOUR COMPOSITIONS            ║');
    lines.push('╠═══════════════════════════════════════╣');

    for (const comp of compositions) {
      lines.push(`║  "${comp.title}" (${comp.instrument})`);
      lines.push(`║     Performed ${comp.times_performed} times`);
    }

    lines.push('╚═══════════════════════════════════════╝');
    lines.push('');

    return { success: true, message: lines.join('\n') };
  }

  // Get the current work in progress type (for routing commands)
  getWipType(playerId: number): 'book' | 'artwork' | 'composition' | null {
    const db = getDatabase();
    const wip = db.prepare(`SELECT type FROM player_creative_wip WHERE player_id = ?`)
      .get(playerId) as { type: 'book' | 'artwork' | 'composition' } | undefined;
    return wip?.type || null;
  }

  // Generic finish command - routes to appropriate finish function
  finishCreative(playerId: number): { success: boolean; message: string } {
    const wipType = this.getWipType(playerId);

    if (!wipType) {
      return { success: false, message: 'You\'re not working on anything creative.' };
    }

    switch (wipType) {
      case 'book':
        return this.finishBook(playerId);
      case 'artwork':
        return this.finishArtwork(playerId);
      case 'composition':
        return this.finishComposition(playerId);
      default:
        return { success: false, message: 'Unknown work type.' };
    }
  }
}

export const creativeManager = new CreativeManager();
