// Combat-related types for Llama Picchu MUD

export interface DamageResult {
  attacker: string;
  defender: string;
  damage: number;
  isCritical: boolean;
  isHit: boolean;
  isMiss: boolean;
  isDodge: boolean;
  isParry: boolean;
  message: string;
}

export interface CombatRoundResult {
  round: number;
  actions: DamageResult[];
  combatEnded: boolean;
  winner?: 'player' | 'npc' | 'flee';
  experienceGained?: number;
  lootDropped?: { itemId: number; quantity: number }[];
  goldDropped?: number;
}

export interface CombatState {
  inCombat: boolean;
  target: {
    type: 'npc' | 'player';
    id: number;
    name: string;
  } | null;
  round: number;
  lastRoundTime: number;
}

// Attack messages themed for llamas
export const PLAYER_ATTACK_MESSAGES = {
  miss: [
    'You lunge forward but miss!',
    'Your attack goes wide!',
    'You stumble, missing your target!',
  ],
  hit: [
    'You strike with your hooves!',
    'You land a solid headbutt!',
    'Your attack connects!',
    'You charge forward, connecting!',
  ],
  critical: [
    'CRITICAL HIT! Your powerful charge sends them reeling!',
    'CRITICAL! You deliver a devastating headbutt!',
    'CRITICAL STRIKE! Your hooves thunder against your foe!',
  ],
};

export const PLAYER_DEFENSE_MESSAGES = {
  dodge: [
    'You nimbly sidestep the attack!',
    'You duck under the blow!',
    'You leap back, avoiding the strike!',
  ],
  parry: [
    'You deflect the attack with your hooves!',
    'You block the incoming strike!',
  ],
  hit: [
    'takes damage',
    'is struck',
    'is wounded',
  ],
};

// Death and defeat messages
export const DEATH_MESSAGES = {
  playerDeath: 'You collapse to the ground, your vision fading to black...',
  playerRespawn: 'You awaken at the Sacred Spring, weakened but alive.',
  npcDeath: (npcName: string) => `${npcName} falls defeated!`,
  flee: 'You turn tail and flee from combat!',
  fleeFail: 'You try to flee but cannot escape!',
};

// Experience and leveling
export const XP_FORMULA = {
  // XP needed for next level: 100 * 1.5^(level-1)
  xpForLevel: (level: number): number => Math.floor(100 * Math.pow(1.5, level - 1)),

  // XP gained from kill, scaled by level difference
  xpFromKill: (playerLevel: number, npcLevel: number, baseXp: number): number => {
    const levelDiff = npcLevel - playerLevel;
    let multiplier = 1.0;

    if (levelDiff > 0) {
      multiplier = 1 + (levelDiff * 0.1); // 10% more per level above
    } else if (levelDiff < 0) {
      multiplier = Math.max(0.1, 1 + (levelDiff * 0.2)); // 20% less per level below, min 10%
    }

    return Math.floor(baseXp * multiplier);
  },
};

// Level cap
export const MAX_LEVEL = 50;

// Combat timing
export const COMBAT_ROUND_MS = 3000; // 3 seconds per round
export const FLEE_CHANCE_BASE = 50; // Base 50% chance to flee
export const FLEE_CHANCE_DEX_BONUS = 2; // +2% per DEX point above defender
