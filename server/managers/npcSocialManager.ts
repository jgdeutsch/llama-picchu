// NPC Social Manager for FROBARK
// Handles NPC-to-NPC relationships, gossip, and journal keeping
// "The inhabitants of Gamehenge don't merely exist for the player's benefit.
//  They have lives, opinions, loves, and grudges of their own." - Design Notes

import { getDatabase } from '../database';
import { getNpcById, npcTemplates, getNpcPersonalityPrompt } from '../data/npcs';
import { connectionManager } from './connectionManager';
import { worldManager } from './worldManager';
import {
  generateNpcToNpcInteraction,
  addNpcToNpcMemory,
  getNpcMemoriesOfNpc,
  getTimeOfDay,
  type NpcToNpcContext,
  type NpcToNpcInteraction,
} from '../services/geminiService';

interface NpcRelationship {
  npcId: number;
  targetNpcId: number;
  relationshipType: string;
  affinity: number;
  trust: number;
  notes: string | null;
}

interface JournalEntry {
  id: number;
  npcId: number;
  entryDate: string;
  content: string;
  entryType: string;
  mentionsPlayerId: number | null;
  mentionsNpcId: number | null;
  importance: number;
  isSecret: boolean;
}

interface GossipMessage {
  speakerNpcId: number;
  listenerNpcId: number;
  aboutNpcId: number | null;
  aboutPlayerId: number | null;
  content: string;
  gossipType: string;
}

class NpcSocialManager {
  // Initialize NPC relationships based on their affiliations and lore
  initializeRelationships(): void {
    const db = getDatabase();

    // Define initial relationships based on Gamehenge lore
    const initialRelationships: { npc1: number; npc2: number; type: string; affinity: number; notes: string }[] = [
      // Wilson's court
      { npc1: 1, npc2: 5, type: 'employer', affinity: 30, notes: 'Errand Wolfe serves Wilson loyally' },
      { npc1: 5, npc2: 1, type: 'servant', affinity: 60, notes: 'Devoted to Wilson, conflicted about methods' },

      // The Resistance
      { npc1: 3, npc2: 6, type: 'ally', affinity: 70, notes: 'Tela trusts Fee completely' },
      { npc1: 6, npc2: 3, type: 'ally', affinity: 80, notes: 'Fee would die for the resistance' },
      { npc1: 3, npc2: 1, type: 'enemy', affinity: -90, notes: 'Tela despises everything Wilson stands for' },
      { npc1: 1, npc2: 3, type: 'enemy', affinity: -80, notes: 'Wilson knows Tela leads the resistance' },

      // Icculus - mysterious to all
      { npc1: 2, npc2: 1, type: 'observer', affinity: -20, notes: 'Icculus sees Wilson as a necessary evil, for now' },
      { npc1: 2, npc2: 3, type: 'mentor', affinity: 40, notes: 'Icculus guides the resistance from afar' },

      // Village folk
      { npc1: 10, npc2: 11, type: 'spouse', affinity: 85, notes: 'Rutherford loves Martha deeply' },
      { npc1: 11, npc2: 10, type: 'spouse', affinity: 80, notes: 'Martha worries about Rutherford working too hard' },
      { npc1: 10, npc2: 12, type: 'parent', affinity: 90, notes: 'Rutherford is proud of young Jimmy' },

      // Blacksmith Gordo
      { npc1: 13, npc2: 14, type: 'parent', affinity: 95, notes: 'Gordo dotes on his daughter Elena' },
      { npc1: 14, npc2: 13, type: 'child', affinity: 75, notes: 'Elena respects her father but dreams of adventure' },

      // Innkeeper relationships
      { npc1: 15, npc2: 10, type: 'friend', affinity: 50, notes: 'Possum and Rutherford share drinks after work' },
      { npc1: 15, npc2: 3, type: 'secret_ally', affinity: 40, notes: 'Possum quietly supports the resistance' },
    ];

    for (const rel of initialRelationships) {
      db.prepare(`
        INSERT OR IGNORE INTO npc_relationships (npc_id, target_npc_id, relationship_type, affinity, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(rel.npc1, rel.npc2, rel.type, rel.affinity, rel.notes);
    }

    console.log('[NpcSocialManager] Initialized NPC relationships');
  }

  // Get an NPC's relationship with another NPC
  getRelationship(npcId: number, targetNpcId: number): NpcRelationship | null {
    const db = getDatabase();
    const rel = db.prepare(`
      SELECT * FROM npc_relationships WHERE npc_id = ? AND target_npc_id = ?
    `).get(npcId, targetNpcId) as any;

    if (!rel) return null;

    return {
      npcId: rel.npc_id,
      targetNpcId: rel.target_npc_id,
      relationshipType: rel.relationship_type,
      affinity: rel.affinity,
      trust: rel.trust,
      notes: rel.notes,
    };
  }

  // Get all relationships for an NPC
  getAllRelationships(npcId: number): NpcRelationship[] {
    const db = getDatabase();
    const rels = db.prepare(`
      SELECT * FROM npc_relationships WHERE npc_id = ?
    `).all(npcId) as any[];

    return rels.map(rel => ({
      npcId: rel.npc_id,
      targetNpcId: rel.target_npc_id,
      relationshipType: rel.relationship_type,
      affinity: rel.affinity,
      trust: rel.trust,
      notes: rel.notes,
    }));
  }

  // Update relationship between two NPCs
  updateRelationship(npcId: number, targetNpcId: number, affinityChange: number, reason: string): void {
    const db = getDatabase();

    const existing = this.getRelationship(npcId, targetNpcId);

    if (existing) {
      const newAffinity = Math.max(-100, Math.min(100, existing.affinity + affinityChange));
      const newType = this.affinityToRelationType(newAffinity, existing.relationshipType);

      db.prepare(`
        UPDATE npc_relationships
        SET affinity = ?, relationship_type = ?, notes = ?, last_interaction = CURRENT_TIMESTAMP
        WHERE npc_id = ? AND target_npc_id = ?
      `).run(newAffinity, newType, reason, npcId, targetNpcId);
    } else {
      const type = this.affinityToRelationType(affinityChange, 'acquaintance');
      db.prepare(`
        INSERT INTO npc_relationships (npc_id, target_npc_id, relationship_type, affinity, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(npcId, targetNpcId, type, affinityChange, reason);
    }
  }

  // Convert affinity score to relationship type
  private affinityToRelationType(affinity: number, currentType: string): string {
    // Preserve special relationship types
    if (['spouse', 'parent', 'child', 'sibling', 'employer', 'servant'].includes(currentType)) {
      return currentType;
    }

    if (affinity <= -70) return 'enemy';
    if (affinity <= -30) return 'rival';
    if (affinity <= 10) return 'acquaintance';
    if (affinity <= 40) return 'friend';
    if (affinity <= 70) return 'close_friend';
    return 'trusted';
  }

  // === JOURNAL SYSTEM ===

  // Add a journal entry for an NPC
  addJournalEntry(
    npcId: number,
    content: string,
    entryType: 'daily' | 'event' | 'relationship' | 'secret' | 'dream' = 'daily',
    mentionsPlayerId?: number,
    mentionsNpcId?: number,
    importance: number = 5,
    isSecret: boolean = false
  ): void {
    const db = getDatabase();

    db.prepare(`
      INSERT INTO npc_journals (npc_id, content, entry_type, mentions_player_id, mentions_npc_id, importance, is_secret)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(npcId, content, entryType, mentionsPlayerId || null, mentionsNpcId || null, importance, isSecret ? 1 : 0);
  }

  // Get journal entries for an NPC
  getJournalEntries(npcId: number, limit: number = 10, includeSecrets: boolean = false): JournalEntry[] {
    const db = getDatabase();

    const query = includeSecrets
      ? `SELECT * FROM npc_journals WHERE npc_id = ? ORDER BY entry_date DESC LIMIT ?`
      : `SELECT * FROM npc_journals WHERE npc_id = ? AND is_secret = 0 ORDER BY entry_date DESC LIMIT ?`;

    const entries = db.prepare(query).all(npcId, limit) as any[];

    return entries.map(e => ({
      id: e.id,
      npcId: e.npc_id,
      entryDate: e.entry_date,
      content: e.content,
      entryType: e.entry_type,
      mentionsPlayerId: e.mentions_player_id,
      mentionsNpcId: e.mentions_npc_id,
      importance: e.importance,
      isSecret: e.is_secret === 1,
    }));
  }

  // Format journal for display (when player finds it)
  formatJournalForDisplay(npcId: number, includeSecrets: boolean = false): string {
    const npc = getNpcById(npcId);
    const entries = this.getJournalEntries(npcId, 20, includeSecrets);

    if (entries.length === 0) {
      return `\nThe journal is blank.\n`;
    }

    const lines: string[] = [
      '',
      `╔════════════════════════════════════════════════════════╗`,
      `║  The Journal of ${npc?.name || 'Unknown'}`,
      `╠════════════════════════════════════════════════════════╣`,
    ];

    for (const entry of entries) {
      const date = new Date(entry.entryDate).toLocaleDateString();
      lines.push(`║  --- ${date} ---`);
      // Word wrap the content
      const words = entry.content.split(' ');
      let line = '║  ';
      for (const word of words) {
        if (line.length + word.length > 55) {
          lines.push(line);
          line = '║  ' + word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line.trim() !== '║') lines.push(line);
      lines.push('║');
    }

    lines.push(`╚════════════════════════════════════════════════════════╝`);
    lines.push('');

    return lines.join('\n');
  }

  // Get all journals for implementors
  getAllJournals(): { npcId: number; npcName: string; entryCount: number; lastEntry: string }[] {
    const db = getDatabase();

    const npcsWithJournals = db.prepare(`
      SELECT npc_id, COUNT(*) as entry_count, MAX(entry_date) as last_entry
      FROM npc_journals
      GROUP BY npc_id
      ORDER BY last_entry DESC
    `).all() as any[];

    return npcsWithJournals.map(j => ({
      npcId: j.npc_id,
      npcName: getNpcById(j.npc_id)?.name || 'Unknown',
      entryCount: j.entry_count,
      lastEntry: j.last_entry,
    }));
  }

  // === GOSSIP SYSTEM ===

  // NPC gossips to another NPC
  spreadGossip(speakerNpcId: number, listenerNpcId: number, gossip: {
    aboutNpcId?: number;
    aboutPlayerId?: number;
    content: string;
    gossipType: 'rumor' | 'observation' | 'opinion' | 'news' | 'secret';
  }): void {
    const db = getDatabase();

    // Record the gossip
    db.prepare(`
      INSERT INTO npc_npc_gossip (speaker_npc_id, listener_npc_id, about_npc_id, about_player_id, gossip_content, gossip_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      speakerNpcId,
      listenerNpcId,
      gossip.aboutNpcId || null,
      gossip.aboutPlayerId || null,
      gossip.content,
      gossip.gossipType
    );

    // If gossip is about another NPC, update listener's opinion
    if (gossip.aboutNpcId) {
      const speaker = getNpcById(speakerNpcId);
      const speakerRelWithListener = this.getRelationship(listenerNpcId, speakerNpcId);
      const trustFactor = speakerRelWithListener ? speakerRelWithListener.trust / 100 : 0.5;

      // Positive gossip = positive affinity change, negative = negative
      const isPositive = !gossip.content.toLowerCase().match(/bad|terrible|rude|cruel|thief|liar|enemy/);
      const affinityChange = Math.round((isPositive ? 5 : -5) * trustFactor);

      if (affinityChange !== 0) {
        this.updateRelationship(listenerNpcId, gossip.aboutNpcId, affinityChange,
          `Heard from ${speaker?.name || 'someone'}: "${gossip.content.substring(0, 50)}..."`);
      }
    }

    // If gossip is about a player, update the existing player gossip system
    if (gossip.aboutPlayerId) {
      db.prepare(`
        INSERT INTO npc_gossip (source_npc_id, about_player_id, gossip_type, content, spread_to, credibility)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        speakerNpcId,
        gossip.aboutPlayerId,
        gossip.gossipType,
        gossip.content,
        JSON.stringify([listenerNpcId]),
        50
      );
    }
  }

  // Process gossip tick - NPCs who are in the same room might gossip
  processGossipTick(): void {
    const db = getDatabase();

    // Get NPCs who are in the same room
    const npcsByRoom = db.prepare(`
      SELECT current_room, GROUP_CONCAT(npc_id) as npcs
      FROM npc_state
      WHERE current_task != 'sleeping'
      GROUP BY current_room
      HAVING COUNT(*) > 1
    `).all() as { current_room: string; npcs: string }[];

    for (const room of npcsByRoom) {
      const npcIds = room.npcs.split(',').map(Number);

      // 60% chance of interaction in each room with multiple awake NPCs
      // NPCs have their own lives - they talk, argue, gossip constantly
      if (Math.random() < 0.6 && npcIds.length >= 2) {
        const speakerId = npcIds[Math.floor(Math.random() * npcIds.length)];
        const otherNpcs = npcIds.filter(id => id !== speakerId);
        const listenerId = otherNpcs[Math.floor(Math.random() * otherNpcs.length)];

        if (speakerId && listenerId) {
          // Use the new NPC-to-NPC interaction system
          this.processNpcToNpcInteraction(speakerId, listenerId, room.current_room)
            .catch(err => console.error('[NpcSocial] Interaction error:', err));
        }
      }
    }
  }

  // Process an interaction between two NPCs
  async processNpcToNpcInteraction(speakerId: number, listenerId: number, roomId: string): Promise<void> {
    const db = getDatabase();

    // Get NPC data
    const speakerTemplate = getNpcById(speakerId);
    const listenerTemplate = getNpcById(listenerId);
    if (!speakerTemplate || !listenerTemplate) return;

    // Get NPC states
    const speakerState = db.prepare(`
      SELECT current_task, mood FROM npc_state WHERE npc_id = ?
    `).get(speakerId) as { current_task: string | null; mood: string } | undefined;

    const listenerState = db.prepare(`
      SELECT current_task FROM npc_state WHERE npc_id = ?
    `).get(listenerId) as { current_task: string | null } | undefined;

    // Get relationship
    const relationship = this.getRelationship(speakerId, listenerId);

    // Get recent memories between them
    const speakerMemories = getNpcMemoriesOfNpc(speakerId, listenerId);
    const listenerMemories = getNpcMemoriesOfNpc(listenerId, speakerId);
    const sharedMemories = [...speakerMemories, ...listenerMemories].slice(0, 5);

    // Get room name
    const room = worldManager.getRoom(roomId);
    const roomName = room?.name || roomId;

    // Build context
    const context: NpcToNpcContext = {
      speakerId,
      speakerName: speakerTemplate.name,
      speakerPersonality: getNpcPersonalityPrompt(speakerId),
      speakerCurrentTask: speakerState?.current_task || null,
      speakerMood: speakerState?.mood || 'neutral',
      listenerId,
      listenerName: listenerTemplate.name,
      listenerPersonality: getNpcPersonalityPrompt(listenerId),
      listenerCurrentTask: listenerState?.current_task || null,
      relationshipType: relationship?.relationshipType || 'acquaintance',
      affinity: relationship?.affinity || 0,
      recentMemories: sharedMemories,
      roomName,
      timeOfDay: getTimeOfDay(),
    };

    // Generate the interaction
    const interaction = await generateNpcToNpcInteraction(context);
    if (!interaction) return;

    // Display to players in the room
    this.broadcastNpcInteraction(roomId, speakerTemplate.name, listenerTemplate.name, interaction);

    // Record memories
    if (interaction.memoryForSpeaker) {
      addNpcToNpcMemory(speakerId, listenerId, interaction.memoryForSpeaker, 5, interaction.affinityChange || 0);
    }
    if (interaction.memoryForListener) {
      addNpcToNpcMemory(listenerId, speakerId, interaction.memoryForListener, 5, interaction.affinityChange || 0);
    }

    // Update relationship affinity
    if (interaction.affinityChange && interaction.affinityChange !== 0) {
      this.updateRelationship(speakerId, listenerId, interaction.affinityChange, 'Recent conversation');
      this.updateRelationship(listenerId, speakerId, interaction.affinityChange, 'Recent conversation');
    }

    console.log(`[NpcSocial] ${speakerTemplate.name} interacted with ${listenerTemplate.name} in ${roomName}`);
  }

  // Broadcast NPC interaction to all players in the room
  private broadcastNpcInteraction(
    roomId: string,
    speakerName: string,
    listenerName: string,
    interaction: NpcToNpcInteraction
  ): void {
    const playersInRoom = worldManager.getPlayersInRoom(roomId);

    for (const playerId of playersInRoom) {
      const messages: string[] = [];

      // Speaker's emote
      if (interaction.speakerEmote) {
        const emote = interaction.speakerEmote.startsWith(speakerName)
          ? interaction.speakerEmote
          : `${speakerName} ${interaction.speakerEmote}`;
        messages.push(emote);
      }

      // Speaker's speech
      if (interaction.speakerSpeech) {
        messages.push(`${speakerName} says to ${listenerName}, "${interaction.speakerSpeech}"`);
      }

      // Listener's emote (if any)
      if (interaction.listenerEmote) {
        const emote = interaction.listenerEmote.startsWith(listenerName)
          ? interaction.listenerEmote
          : `${listenerName} ${interaction.listenerEmote}`;
        messages.push(emote);
      }

      // Listener's speech (if any)
      if (interaction.listenerSpeech) {
        messages.push(`${listenerName} replies, "${interaction.listenerSpeech}"`);
      }

      // Send as a single message block
      if (messages.length > 0) {
        connectionManager.sendToPlayer(playerId, {
          type: 'output',
          text: '\n' + messages.join('\n'),
          messageType: 'npc_ambient',
        });
      }
    }
  }

  // Generate random gossip between two NPCs
  private generateRandomGossip(speakerId: number, listenerId: number): void {
    const db = getDatabase();
    const speaker = getNpcById(speakerId);
    const listener = getNpcById(listenerId);

    if (!speaker || !listener) return;

    // Get recent events to gossip about
    const recentPlayerGossip = db.prepare(`
      SELECT about_player_id, gossip_type, content FROM npc_gossip
      WHERE created_at > datetime('now', '-1 day')
      ORDER BY RANDOM() LIMIT 1
    `).get() as { about_player_id: number; gossip_type: string; content: string } | undefined;

    // Get a relationship to gossip about
    const relationships = this.getAllRelationships(speakerId);
    const interestingRel = relationships.find(r => Math.abs(r.affinity) > 30 && r.targetNpcId !== listenerId);

    let gossipContent: string;
    let gossipType: 'rumor' | 'observation' | 'opinion' | 'news' | 'secret' = 'observation';
    let aboutNpcId: number | undefined;
    let aboutPlayerId: number | undefined;

    if (recentPlayerGossip && Math.random() < 0.4) {
      // Gossip about a player
      aboutPlayerId = recentPlayerGossip.about_player_id;
      gossipContent = recentPlayerGossip.content;
      gossipType = 'rumor';
    } else if (interestingRel && Math.random() < 0.6) {
      // Gossip about another NPC
      aboutNpcId = interestingRel.targetNpcId;
      const targetNpc = getNpcById(interestingRel.targetNpcId);
      const sentiment = interestingRel.affinity > 0 ? 'good things' : 'concerns';
      gossipContent = `I've heard ${sentiment} about ${targetNpc?.name || 'someone'}...`;
      gossipType = 'opinion';
    } else {
      // General observation about the world
      const observations = [
        "Wilson's taxes are getting heavier...",
        "The crops aren't doing well this season.",
        "I saw strange lights near the forest last night.",
        "Business has been slow lately.",
        "The guards seem more nervous than usual.",
        "Have you noticed the weather changing?",
      ];
      gossipContent = observations[Math.floor(Math.random() * observations.length)];
      gossipType = 'observation';
    }

    this.spreadGossip(speakerId, listenerId, {
      aboutNpcId,
      aboutPlayerId,
      content: gossipContent,
      gossipType,
    });
  }

  // === DAILY JOURNAL WRITING ===

  // NPCs write in their journals at the end of each day
  writeEndOfDayJournals(): void {
    const db = getDatabase();

    // Get all NPCs who haven't written today
    const npcsToWrite = db.prepare(`
      SELECT DISTINCT ns.npc_id
      FROM npc_state ns
      WHERE ns.npc_id NOT IN (
        SELECT npc_id FROM npc_journals
        WHERE date(entry_date) = date('now')
      )
    `).all() as { npc_id: number }[];

    for (const { npc_id } of npcsToWrite) {
      this.generateJournalEntry(npc_id);
    }
  }

  // Generate a journal entry for an NPC based on the day's events
  private generateJournalEntry(npcId: number): void {
    const db = getDatabase();
    const npc = getNpcById(npcId);
    if (!npc) return;

    // Get today's interactions
    const interactions = db.prepare(`
      SELECT * FROM npc_memories
      WHERE npc_id = ? AND date(created_at) = date('now')
      ORDER BY importance DESC
      LIMIT 3
    `).all(npcId) as any[];

    // Get gossip heard today
    const gossipHeard = db.prepare(`
      SELECT * FROM npc_npc_gossip
      WHERE listener_npc_id = ? AND date(created_at) = date('now')
      LIMIT 2
    `).all(npcId) as any[];

    // Build journal entry
    let entry = '';
    let entryType: 'daily' | 'event' | 'relationship' = 'daily';
    let importance = 5;
    let mentionsPlayerId: number | undefined;
    let mentionsNpcId: number | undefined;

    if (interactions.length > 0) {
      const mainInteraction = interactions[0];
      entry = `Today a traveler ${mainInteraction.content || 'visited'}. `;
      mentionsPlayerId = mainInteraction.player_id;
      importance = Math.max(importance, mainInteraction.importance || 5);
      entryType = 'event';
    }

    if (gossipHeard.length > 0) {
      const gossip = gossipHeard[0];
      const speakerNpc = getNpcById(gossip.speaker_npc_id);
      entry += `${speakerNpc?.name || 'Someone'} told me: "${gossip.gossip_content.substring(0, 50)}". `;
      if (gossip.about_npc_id) mentionsNpcId = gossip.about_npc_id;
    }

    if (!entry) {
      // Default daily entry based on NPC personality
      const dailyThoughts = [
        `Another quiet day in Gamehenge.`,
        `The work continues. We must endure.`,
        `I wonder what tomorrow will bring.`,
        `Thinking about the old days, before Wilson...`,
      ];
      entry = dailyThoughts[Math.floor(Math.random() * dailyThoughts.length)];
      importance = 3;
    }

    this.addJournalEntry(npcId, entry, entryType, mentionsPlayerId, mentionsNpcId, importance, false);
  }

  // Check if a name is protected
  isProtectedName(name: string): boolean {
    const db = getDatabase();
    const result = db.prepare(`SELECT name FROM protected_names WHERE name = ?`).get(name);
    return !!result;
  }
}

export const npcSocialManager = new NpcSocialManager();
