// Shop Commands for Llama Picchu MUD
import { connectionManager } from '../managers/connectionManager';
import { worldManager } from '../managers/worldManager';
import { npcManager } from '../managers/npcManager';
import { npcTemplates } from '../data/npcs';
import type { CommandContext } from './index';

export function processShopCommand(ctx: CommandContext, action: string): void {
  switch (action) {
    case 'list':
      processShopList(ctx);
      break;
    case 'buy':
      processBuy(ctx);
      break;
    case 'sell':
      processSell(ctx);
      break;
  }
}

function sendOutput(playerId: number, text: string): void {
  connectionManager.sendToPlayer(playerId, {
    type: 'output',
    text,
    messageType: 'normal',
  });
}

function findShopkeeper(roomId: string): { npcInstanceId: number; template: typeof npcTemplates[0] } | null {
  const roomState = worldManager.getRoomState(roomId);
  if (!roomState) return null;

  for (const npc of roomState.npcs) {
    const template = npcTemplates.find((t) => t.id === npc.npcTemplateId);
    if (template && (template.type === 'shopkeeper' || template.type === 'innkeeper') && template.shopInventory) {
      return { npcInstanceId: npc.id, template };
    }
  }

  return null;
}

function processShopList(ctx: CommandContext): void {
  const shopkeeper = findShopkeeper(ctx.roomId);

  if (!shopkeeper) {
    sendOutput(ctx.playerId, 'There is no shop here.');
    return;
  }

  const inventory = npcManager.getShopInventory(shopkeeper.template.id);

  if (!inventory || inventory.length === 0) {
    sendOutput(ctx.playerId, `${shopkeeper.template.name} has nothing for sale.`);
    return;
  }

  const lines = [
    '',
    `╔════════════════════════════════════════════════════╗`,
    `║  ${shopkeeper.template.name.padEnd(20)} - FOR SALE                ║`,
    `╠════════════════════════════════════════════════════╣`,
  ];

  for (const item of inventory) {
    const stockStr = item.stock === -1 ? '∞' : String(item.stock);
    lines.push(
      `║  ${item.name.padEnd(25)} ${String(item.price).padStart(6)} gold  [${stockStr.padStart(2)}] ║`
    );
  }

  lines.push(`╠════════════════════════════════════════════════════╣`);
  lines.push(`║  Type "buy <item>" to purchase.                    ║`);
  lines.push(`╚════════════════════════════════════════════════════╝`);
  lines.push('');

  sendOutput(ctx.playerId, lines.join('\n'));
}

function processBuy(ctx: CommandContext): void {
  const shopkeeper = findShopkeeper(ctx.roomId);

  if (!shopkeeper) {
    sendOutput(ctx.playerId, 'There is no shop here.');
    return;
  }

  const itemKeyword = ctx.args.join(' ');
  const result = npcManager.buyItem(ctx.playerId, shopkeeper.npcInstanceId, itemKeyword);
  sendOutput(ctx.playerId, result.message);
}

function processSell(ctx: CommandContext): void {
  const shopkeeper = findShopkeeper(ctx.roomId);

  if (!shopkeeper) {
    sendOutput(ctx.playerId, 'There is no shop here.');
    return;
  }

  const itemKeyword = ctx.args.join(' ');
  const result = npcManager.sellItem(ctx.playerId, shopkeeper.npcInstanceId, itemKeyword);
  sendOutput(ctx.playerId, result.message);
}
