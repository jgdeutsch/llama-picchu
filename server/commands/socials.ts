// Social/Emote Commands for FROBARK MUD
// These are expressive actions players can take that don't directly affect game state
// but make the world feel more interactive and alive

import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { npcManager } from '../managers/npcManager';
import { getDatabase, roomNpcQueries } from '../database';
import { npcTemplates, getNpcPersonalityPrompt } from '../data/npcs';
import { generateNpcSpeechReaction, addNpcMemory } from '../services/geminiService';
import type { CommandContext } from './index';

// Social definition: messages for self, target, and observers
interface SocialDefinition {
  name: string;
  aliases?: string[];
  noTarget: {
    self: string;      // What you see when you do it alone
    others: string;    // What others in room see
  };
  withTarget: {
    self: string;      // What you see (use {target} for target name)
    target: string;    // What the target sees (use {actor} for your name)
    others: string;    // What others see (use {actor} and {target})
  };
  // For NPC reactions - describes the social's nature
  sentiment?: 'friendly' | 'hostile' | 'neutral' | 'romantic' | 'playful';
}

// All available socials
export const SOCIALS: SocialDefinition[] = [
  // Basic expressions
  {
    name: 'smile',
    noTarget: {
      self: 'You smile happily.',
      others: '{actor} smiles happily.',
    },
    withTarget: {
      self: 'You smile warmly at {target}.',
      target: '{actor} smiles warmly at you.',
      others: '{actor} smiles warmly at {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'grin',
    noTarget: {
      self: 'You grin mischievously.',
      others: '{actor} grins mischievously.',
    },
    withTarget: {
      self: 'You grin at {target}.',
      target: '{actor} grins at you.',
      others: '{actor} grins at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'laugh',
    aliases: ['lol', 'haha'],
    noTarget: {
      self: 'You laugh out loud.',
      others: '{actor} laughs out loud.',
    },
    withTarget: {
      self: 'You laugh at {target}.',
      target: '{actor} laughs at you.',
      others: '{actor} laughs at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'chuckle',
    noTarget: {
      self: 'You chuckle quietly.',
      others: '{actor} chuckles quietly.',
    },
    withTarget: {
      self: 'You chuckle at {target}.',
      target: '{actor} chuckles at you.',
      others: '{actor} chuckles at {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'giggle',
    noTarget: {
      self: 'You giggle.',
      others: '{actor} giggles.',
    },
    withTarget: {
      self: 'You giggle at {target}.',
      target: '{actor} giggles at you.',
      others: '{actor} giggles at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'snicker',
    noTarget: {
      self: 'You snicker.',
      others: '{actor} snickers.',
    },
    withTarget: {
      self: 'You snicker at {target}.',
      target: '{actor} snickers at you.',
      others: '{actor} snickers at {target}.',
    },
    sentiment: 'playful',
  },

  // Greetings
  {
    name: 'wave',
    noTarget: {
      self: 'You wave.',
      others: '{actor} waves.',
    },
    withTarget: {
      self: 'You wave at {target}.',
      target: '{actor} waves at you.',
      others: '{actor} waves at {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'bow',
    noTarget: {
      self: 'You bow gracefully.',
      others: '{actor} bows gracefully.',
    },
    withTarget: {
      self: 'You bow before {target}.',
      target: '{actor} bows before you.',
      others: '{actor} bows before {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'curtsey',
    aliases: ['curtsy'],
    noTarget: {
      self: 'You curtsey gracefully.',
      others: '{actor} curtseys gracefully.',
    },
    withTarget: {
      self: 'You curtsey to {target}.',
      target: '{actor} curtseys to you.',
      others: '{actor} curtseys to {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'nod',
    noTarget: {
      self: 'You nod.',
      others: '{actor} nods.',
    },
    withTarget: {
      self: 'You nod at {target}.',
      target: '{actor} nods at you.',
      others: '{actor} nods at {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'salute',
    noTarget: {
      self: 'You salute smartly.',
      others: '{actor} salutes smartly.',
    },
    withTarget: {
      self: 'You salute {target}.',
      target: '{actor} salutes you.',
      others: '{actor} salutes {target}.',
    },
    sentiment: 'friendly',
  },

  // Affection
  {
    name: 'hug',
    noTarget: {
      self: 'You hug yourself. Lonely?',
      others: '{actor} hugs themselves.',
    },
    withTarget: {
      self: 'You hug {target} warmly.',
      target: '{actor} hugs you warmly.',
      others: '{actor} hugs {target} warmly.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'kiss',
    noTarget: {
      self: 'You blow a kiss into the air.',
      others: '{actor} blows a kiss into the air.',
    },
    withTarget: {
      self: 'You kiss {target} gently.',
      target: '{actor} kisses you gently.',
      others: '{actor} kisses {target} gently.',
    },
    sentiment: 'romantic',
  },
  {
    name: 'pat',
    noTarget: {
      self: 'You pat yourself on the back.',
      others: '{actor} pats themselves on the back.',
    },
    withTarget: {
      self: 'You pat {target} on the back.',
      target: '{actor} pats you on the back.',
      others: '{actor} pats {target} on the back.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'comfort',
    noTarget: {
      self: 'You look around for someone to comfort.',
      others: '{actor} looks around for someone to comfort.',
    },
    withTarget: {
      self: 'You comfort {target}.',
      target: '{actor} comforts you.',
      others: '{actor} comforts {target}.',
    },
    sentiment: 'friendly',
  },

  // Physical/Playful
  {
    name: 'tickle',
    noTarget: {
      self: 'You tickle yourself and wonder why it doesn\'t work.',
      others: '{actor} tickles themselves. Strange.',
    },
    withTarget: {
      self: 'You tickle {target} mercilessly.',
      target: '{actor} tickles you mercilessly!',
      others: '{actor} tickles {target} mercilessly.',
    },
    sentiment: 'playful',
  },
  {
    name: 'poke',
    noTarget: {
      self: 'You poke the air aimlessly.',
      others: '{actor} pokes the air aimlessly.',
    },
    withTarget: {
      self: 'You poke {target}.',
      target: '{actor} pokes you.',
      others: '{actor} pokes {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'nudge',
    noTarget: {
      self: 'You nudge the air. The air ignores you.',
      others: '{actor} nudges the air conspiratorially.',
    },
    withTarget: {
      self: 'You nudge {target} knowingly.',
      target: '{actor} nudges you knowingly.',
      others: '{actor} nudges {target} knowingly.',
    },
    sentiment: 'playful',
  },
  {
    name: 'push',
    aliases: ['shove'],
    noTarget: {
      self: 'You push against nothing.',
      others: '{actor} pushes against nothing.',
    },
    withTarget: {
      self: 'You push {target}.',
      target: '{actor} pushes you!',
      others: '{actor} pushes {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'slap',
    noTarget: {
      self: 'You slap yourself. Ouch!',
      others: '{actor} slaps themselves. Ouch!',
    },
    withTarget: {
      self: 'You slap {target}!',
      target: '{actor} slaps you!',
      others: '{actor} slaps {target}!',
    },
    sentiment: 'hostile',
  },
  {
    name: 'punch',
    noTarget: {
      self: 'You punch the air dramatically.',
      others: '{actor} punches the air dramatically.',
    },
    withTarget: {
      self: 'You punch {target}!',
      target: '{actor} punches you!',
      others: '{actor} punches {target}!',
    },
    sentiment: 'hostile',
  },
  {
    name: 'highfive',
    aliases: ['hi5', 'hifive'],
    noTarget: {
      self: 'You hold your hand up for a high five. Anyone?',
      others: '{actor} holds their hand up for a high five.',
    },
    withTarget: {
      self: 'You high five {target}!',
      target: '{actor} high fives you!',
      others: '{actor} high fives {target}!',
    },
    sentiment: 'friendly',
  },
  {
    name: 'handshake',
    aliases: ['shake'],
    noTarget: {
      self: 'You extend your hand to no one.',
      others: '{actor} extends their hand to no one.',
    },
    withTarget: {
      self: 'You shake hands with {target}.',
      target: '{actor} shakes your hand.',
      others: '{actor} shakes hands with {target}.',
    },
    sentiment: 'friendly',
  },

  // Body language
  {
    name: 'shrug',
    noTarget: {
      self: 'You shrug.',
      others: '{actor} shrugs.',
    },
    withTarget: {
      self: 'You shrug at {target}.',
      target: '{actor} shrugs at you.',
      others: '{actor} shrugs at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'sigh',
    noTarget: {
      self: 'You sigh.',
      others: '{actor} sighs.',
    },
    withTarget: {
      self: 'You sigh at {target}.',
      target: '{actor} sighs at you.',
      others: '{actor} sighs at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'yawn',
    noTarget: {
      self: 'You yawn loudly.',
      others: '{actor} yawns loudly.',
    },
    withTarget: {
      self: 'You yawn at {target}. How rude!',
      target: '{actor} yawns at you. How rude!',
      others: '{actor} yawns at {target}. How rude!',
    },
    sentiment: 'neutral',
  },
  {
    name: 'stretch',
    noTarget: {
      self: 'You stretch your tired muscles.',
      others: '{actor} stretches their tired muscles.',
    },
    withTarget: {
      self: 'You stretch out towards {target}.',
      target: '{actor} stretches out towards you.',
      others: '{actor} stretches out towards {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'point',
    noTarget: {
      self: 'You point at nothing in particular.',
      others: '{actor} points at nothing in particular.',
    },
    withTarget: {
      self: 'You point at {target}.',
      target: '{actor} points at you.',
      others: '{actor} points at {target}.',
    },
    sentiment: 'neutral',
  },

  // Expressions of emotion
  {
    name: 'cry',
    aliases: ['sob', 'weep'],
    noTarget: {
      self: 'You burst into tears.',
      others: '{actor} bursts into tears.',
    },
    withTarget: {
      self: 'You cry on {target}\'s shoulder.',
      target: '{actor} cries on your shoulder.',
      others: '{actor} cries on {target}\'s shoulder.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'frown',
    noTarget: {
      self: 'You frown.',
      others: '{actor} frowns.',
    },
    withTarget: {
      self: 'You frown at {target}.',
      target: '{actor} frowns at you.',
      others: '{actor} frowns at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'pout',
    noTarget: {
      self: 'You pout.',
      others: '{actor} pouts.',
    },
    withTarget: {
      self: 'You pout at {target}.',
      target: '{actor} pouts at you.',
      others: '{actor} pouts at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'groan',
    aliases: ['moan'],
    noTarget: {
      self: 'You groan.',
      others: '{actor} groans.',
    },
    withTarget: {
      self: 'You groan at {target}.',
      target: '{actor} groans at you.',
      others: '{actor} groans at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'gasp',
    noTarget: {
      self: 'You gasp in surprise!',
      others: '{actor} gasps in surprise!',
    },
    withTarget: {
      self: 'You gasp at {target}!',
      target: '{actor} gasps at you!',
      others: '{actor} gasps at {target}!',
    },
    sentiment: 'neutral',
  },
  {
    name: 'blush',
    noTarget: {
      self: 'Your cheeks turn bright red.',
      others: '{actor}\'s cheeks turn bright red.',
    },
    withTarget: {
      self: 'You blush at {target}.',
      target: '{actor} blushes at you.',
      others: '{actor} blushes at {target}.',
    },
    sentiment: 'neutral',
  },

  // Hostile/Rude
  {
    name: 'glare',
    noTarget: {
      self: 'You glare at the world.',
      others: '{actor} glares at the world.',
    },
    withTarget: {
      self: 'You glare icily at {target}.',
      target: '{actor} glares icily at you.',
      others: '{actor} glares icily at {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'sneer',
    noTarget: {
      self: 'You sneer contemptuously.',
      others: '{actor} sneers contemptuously.',
    },
    withTarget: {
      self: 'You sneer at {target}.',
      target: '{actor} sneers at you.',
      others: '{actor} sneers at {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'growl',
    noTarget: {
      self: 'You growl menacingly.',
      others: '{actor} growls menacingly.',
    },
    withTarget: {
      self: 'You growl at {target}.',
      target: '{actor} growls at you.',
      others: '{actor} growls at {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'snarl',
    noTarget: {
      self: 'You snarl.',
      others: '{actor} snarls.',
    },
    withTarget: {
      self: 'You snarl at {target}.',
      target: '{actor} snarls at you.',
      others: '{actor} snarls at {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'spit',
    noTarget: {
      self: 'You spit on the ground.',
      others: '{actor} spits on the ground.',
    },
    withTarget: {
      self: 'You spit at {target}\'s feet.',
      target: '{actor} spits at your feet!',
      others: '{actor} spits at {target}\'s feet!',
    },
    sentiment: 'hostile',
  },
  {
    name: 'ignore',
    noTarget: {
      self: 'You ignore everyone.',
      others: '{actor} ignores everyone.',
    },
    withTarget: {
      self: 'You pointedly ignore {target}.',
      target: '{actor} pointedly ignores you.',
      others: '{actor} pointedly ignores {target}.',
    },
    sentiment: 'hostile',
  },
  {
    name: 'taunt',
    aliases: ['mock'],
    noTarget: {
      self: 'You taunt the air. Very brave.',
      others: '{actor} taunts the air. Very brave.',
    },
    withTarget: {
      self: 'You taunt {target}.',
      target: '{actor} taunts you!',
      others: '{actor} taunts {target}.',
    },
    sentiment: 'hostile',
  },

  // Curious/Thoughtful
  {
    name: 'think',
    aliases: ['ponder', 'hmm'],
    noTarget: {
      self: 'You think deeply.',
      others: '{actor} seems lost in thought.',
    },
    withTarget: {
      self: 'You think about {target}.',
      target: '{actor} seems to be thinking about you.',
      others: '{actor} seems to be thinking about {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'scratch',
    noTarget: {
      self: 'You scratch your head.',
      others: '{actor} scratches their head.',
    },
    withTarget: {
      self: 'You scratch your head at {target}.',
      target: '{actor} scratches their head at you.',
      others: '{actor} scratches their head at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'stare',
    noTarget: {
      self: 'You stare off into the distance.',
      others: '{actor} stares off into the distance.',
    },
    withTarget: {
      self: 'You stare at {target}.',
      target: '{actor} stares at you.',
      others: '{actor} stares at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'eyebrow',
    aliases: ['raise', 'brow'],
    noTarget: {
      self: 'You raise an eyebrow.',
      others: '{actor} raises an eyebrow.',
    },
    withTarget: {
      self: 'You raise an eyebrow at {target}.',
      target: '{actor} raises an eyebrow at you.',
      others: '{actor} raises an eyebrow at {target}.',
    },
    sentiment: 'neutral',
  },

  // Fun actions
  {
    name: 'dance',
    noTarget: {
      self: 'You dance around happily!',
      others: '{actor} dances around happily!',
    },
    withTarget: {
      self: 'You dance with {target}!',
      target: '{actor} dances with you!',
      others: '{actor} dances with {target}!',
    },
    sentiment: 'friendly',
  },
  {
    name: 'spin',
    aliases: ['twirl'],
    noTarget: {
      self: 'You spin around!',
      others: '{actor} spins around!',
    },
    withTarget: {
      self: 'You spin {target} around!',
      target: '{actor} spins you around!',
      others: '{actor} spins {target} around!',
    },
    sentiment: 'playful',
  },
  {
    name: 'jump',
    aliases: ['hop', 'leap'],
    noTarget: {
      self: 'You jump up and down!',
      others: '{actor} jumps up and down!',
    },
    withTarget: {
      self: 'You jump in front of {target}!',
      target: '{actor} jumps in front of you!',
      others: '{actor} jumps in front of {target}!',
    },
    sentiment: 'playful',
  },
  {
    name: 'clap',
    aliases: ['applaud'],
    noTarget: {
      self: 'You clap your hands.',
      others: '{actor} claps their hands.',
    },
    withTarget: {
      self: 'You applaud {target}.',
      target: '{actor} applauds you.',
      others: '{actor} applauds {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'cheer',
    noTarget: {
      self: 'You cheer enthusiastically!',
      others: '{actor} cheers enthusiastically!',
    },
    withTarget: {
      self: 'You cheer for {target}!',
      target: '{actor} cheers for you!',
      others: '{actor} cheers for {target}!',
    },
    sentiment: 'friendly',
  },
  {
    name: 'wink',
    noTarget: {
      self: 'You wink suggestively.',
      others: '{actor} winks suggestively.',
    },
    withTarget: {
      self: 'You wink at {target}.',
      target: '{actor} winks at you.',
      others: '{actor} winks at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'whistle',
    noTarget: {
      self: 'You whistle a tune.',
      others: '{actor} whistles a tune.',
    },
    withTarget: {
      self: 'You whistle at {target}.',
      target: '{actor} whistles at you.',
      others: '{actor} whistles at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'snap',
    noTarget: {
      self: 'You snap your fingers.',
      others: '{actor} snaps their fingers.',
    },
    withTarget: {
      self: 'You snap your fingers at {target}.',
      target: '{actor} snaps their fingers at you.',
      others: '{actor} snaps their fingers at {target}.',
    },
    sentiment: 'neutral',
  },

  // Agreement/Disagreement
  {
    name: 'agree',
    noTarget: {
      self: 'You nod in agreement.',
      others: '{actor} nods in agreement.',
    },
    withTarget: {
      self: 'You agree with {target}.',
      target: '{actor} agrees with you.',
      others: '{actor} agrees with {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'disagree',
    noTarget: {
      self: 'You shake your head in disagreement.',
      others: '{actor} shakes their head in disagreement.',
    },
    withTarget: {
      self: 'You disagree with {target}.',
      target: '{actor} disagrees with you.',
      others: '{actor} disagrees with {target}.',
    },
    sentiment: 'neutral',
  },

  // Misc
  {
    name: 'thank',
    aliases: ['thanks', 'ty'],
    noTarget: {
      self: 'You thank everyone.',
      others: '{actor} thanks everyone.',
    },
    withTarget: {
      self: 'You thank {target} sincerely.',
      target: '{actor} thanks you sincerely.',
      others: '{actor} thanks {target} sincerely.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'apologize',
    aliases: ['sorry'],
    noTarget: {
      self: 'You apologize profusely.',
      others: '{actor} apologizes profusely.',
    },
    withTarget: {
      self: 'You apologize to {target}.',
      target: '{actor} apologizes to you.',
      others: '{actor} apologizes to {target}.',
    },
    sentiment: 'friendly',
  },
  {
    name: 'cough',
    noTarget: {
      self: 'You cough.',
      others: '{actor} coughs.',
    },
    withTarget: {
      self: 'You cough at {target}. Gross!',
      target: '{actor} coughs at you. Gross!',
      others: '{actor} coughs at {target}. Gross!',
    },
    sentiment: 'neutral',
  },
  {
    name: 'sneeze',
    noTarget: {
      self: 'You sneeze loudly. Achoo!',
      others: '{actor} sneezes loudly. Achoo!',
    },
    withTarget: {
      self: 'You sneeze on {target}!',
      target: '{actor} sneezes on you! Eww!',
      others: '{actor} sneezes on {target}! Eww!',
    },
    sentiment: 'neutral',
  },
  {
    name: 'flex',
    noTarget: {
      self: 'You flex your muscles impressively.',
      others: '{actor} flexes their muscles impressively.',
    },
    withTarget: {
      self: 'You flex your muscles at {target}.',
      target: '{actor} flexes their muscles at you.',
      others: '{actor} flexes their muscles at {target}.',
    },
    sentiment: 'playful',
  },
  {
    name: 'facepalm',
    aliases: ['headdesk'],
    noTarget: {
      self: 'You facepalm.',
      others: '{actor} facepalms.',
    },
    withTarget: {
      self: 'You facepalm at {target}.',
      target: '{actor} facepalms at you.',
      others: '{actor} facepalms at {target}.',
    },
    sentiment: 'neutral',
  },
  {
    name: 'brb',
    noTarget: {
      self: 'You announce you\'ll be right back.',
      others: '{actor} announces they\'ll be right back.',
    },
    withTarget: {
      self: 'You tell {target} you\'ll be right back.',
      target: '{actor} tells you they\'ll be right back.',
      others: '{actor} tells {target} they\'ll be right back.',
    },
    sentiment: 'neutral',
  },
];

// Build a map for quick lookup
const SOCIAL_MAP = new Map<string, SocialDefinition>();
for (const social of SOCIALS) {
  SOCIAL_MAP.set(social.name, social);
  if (social.aliases) {
    for (const alias of social.aliases) {
      SOCIAL_MAP.set(alias, social);
    }
  }
}

// Get a social by name or alias
export function getSocial(name: string): SocialDefinition | undefined {
  return SOCIAL_MAP.get(name.toLowerCase());
}

// Get all social names (for help)
export function getAllSocialNames(): string[] {
  return SOCIALS.map(s => s.name);
}

// Process a social command
export function processSocialCommand(ctx: CommandContext, socialName: string): void {
  const social = getSocial(socialName);
  if (!social) {
    sendOutput(ctx.playerId, `Unknown social: ${socialName}`);
    return;
  }

  const targetArg = ctx.args[0]?.toLowerCase();

  if (!targetArg) {
    // No target - solo social
    processSoloSocial(ctx, social);
  } else {
    // Has target - find them
    processTargetedSocial(ctx, social, targetArg);
  }
}

function sendOutput(playerId: number, text: string): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: 'emote',
  });
}

function processSoloSocial(ctx: CommandContext, social: SocialDefinition): void {
  // Send to self
  sendOutput(ctx.playerId, social.noTarget.self);

  // Send to others in room
  const othersMessage = social.noTarget.others.replace('{actor}', ctx.playerName);
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  for (const otherId of playersInRoom) {
    if (otherId !== ctx.playerId) {
      sendOutput(otherId, othersMessage);
    }
  }

  // NPCs might react to notable socials
  if (social.sentiment && Math.random() < 0.3) {
    triggerNpcSocialReaction(ctx, social, null);
  }
}

function processTargetedSocial(ctx: CommandContext, social: SocialDefinition, targetArg: string): void {
  const db = getDatabase();

  // Check for player target first
  const playersInRoom = worldManager.getPlayersInRoom(ctx.roomId);
  let targetPlayer: { id: number; name: string } | null = null;

  for (const pid of playersInRoom) {
    if (pid === ctx.playerId) continue;
    const player = db.prepare(`SELECT id, name FROM players WHERE id = ?`).get(pid) as { id: number; name: string } | undefined;
    if (player && player.name.toLowerCase().includes(targetArg)) {
      targetPlayer = player;
      break;
    }
  }

  if (targetPlayer) {
    // Target is a player
    const selfMsg = social.withTarget.self.replace('{target}', targetPlayer.name);
    const targetMsg = social.withTarget.target.replace('{actor}', ctx.playerName);
    const othersMsg = social.withTarget.others
      .replace('{actor}', ctx.playerName)
      .replace('{target}', targetPlayer.name);

    sendOutput(ctx.playerId, selfMsg);
    sendOutput(targetPlayer.id, targetMsg);

    for (const otherId of playersInRoom) {
      if (otherId !== ctx.playerId && otherId !== targetPlayer.id) {
        sendOutput(otherId, othersMsg);
      }
    }
    return;
  }

  // Check for NPC target
  const npc = worldManager.findNpcInRoom(ctx.roomId, targetArg);
  if (npc) {
    const template = npcTemplates.find(t => t.id === npc.npcTemplateId);
    if (template) {
      const selfMsg = social.withTarget.self.replace('{target}', template.name);
      const othersMsg = social.withTarget.others
        .replace('{actor}', ctx.playerName)
        .replace('{target}', template.name);

      sendOutput(ctx.playerId, selfMsg);

      for (const otherId of playersInRoom) {
        if (otherId !== ctx.playerId) {
          sendOutput(otherId, othersMsg);
        }
      }

      // NPC will definitely react to being targeted
      triggerNpcSocialReaction(ctx, social, { npcTemplateId: npc.npcTemplateId, name: template.name });
      return;
    }
  }

  // Target not found
  sendOutput(ctx.playerId, `You don't see "${targetArg}" here.`);
}

// Trigger NPC reaction to a social
async function triggerNpcSocialReaction(
  ctx: CommandContext,
  social: SocialDefinition,
  target: { npcTemplateId: number; name: string } | null
): Promise<void> {
  const db = getDatabase();

  // If this social was targeted at an NPC, they'll definitely react
  if (target) {
    const template = npcTemplates.find(t => t.id === target.npcTemplateId);
    if (!template || template.type === 'enemy') return;

    const personality = getNpcPersonalityPrompt(target.npcTemplateId);

    // Get relationship
    const relationship = db.prepare(`
      SELECT trust_level, capital FROM social_capital
      WHERE player_id = ? AND npc_id = ?
    `).get(ctx.playerId, target.npcTemplateId) as { trust_level: string; capital: number } | undefined;

    const trustLevel = relationship?.trust_level || 'stranger';

    // Describe what happened
    const actionDesc = `${ctx.playerName} ${social.noTarget.others.replace('{actor}', '').trim().replace(/\.$/, '')} at you`;

    try {
      const reaction = await generateNpcSpeechReaction(
        target.npcTemplateId,
        target.name,
        personality,
        null,
        ctx.playerId,
        ctx.playerName,
        actionDesc,
        trustLevel
      );

      if (reaction) {
        if (reaction.emote) {
          sendOutput(ctx.playerId, `\n${target.name} ${reaction.emote}`);
        }
        if (reaction.response) {
          if (reaction.emote) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          sendOutput(ctx.playerId, `${target.name} says, "${reaction.response}"`);
        }

        // Record interaction and update social capital based on sentiment
        let capitalChange = 0;
        if (social.sentiment === 'friendly') capitalChange = 1;
        else if (social.sentiment === 'hostile') capitalChange = -3;
        else if (social.sentiment === 'romantic' && trustLevel !== 'hostile') capitalChange = 1;

        if (capitalChange !== 0) {
          db.prepare(`
            INSERT INTO social_capital (player_id, npc_id, capital, last_interaction)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (player_id, npc_id) DO UPDATE SET
              capital = MIN(100, MAX(-100, capital + ?)),
              last_interaction = CURRENT_TIMESTAMP
          `).run(ctx.playerId, target.npcTemplateId, capitalChange, capitalChange);
        }

        // Add to NPC memory
        const memoryContent = `${ctx.playerName} ${social.name}ed at me`;
        addNpcMemory(
          target.npcTemplateId,
          ctx.playerId,
          'interaction',
          memoryContent,
          social.sentiment === 'hostile' ? 5 : 2,
          social.sentiment === 'friendly' ? 1 : social.sentiment === 'hostile' ? -2 : 0
        );
      }
    } catch (error) {
      console.error(`[Social NPC Reaction] Error:`, error);
    }
  }
}
