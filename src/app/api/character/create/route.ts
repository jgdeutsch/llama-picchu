// Character Creation API for Llama Picchu MUD
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  getDatabase,
  initializeDatabase,
  playerQueries,
  equipmentQueries,
} from '../../../../../server/database';
import { classDefinitions } from '../../../../../server/data/classes';

const JWT_SECRET = process.env.JWT_SECRET || 'llama-picchu-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { accountId, name, classId, stats } = await request.json();

    // Validate input
    if (!accountId || !name || !classId || !stats) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate name
    if (name.length < 3 || name.length > 20) {
      return NextResponse.json(
        { error: 'Name must be 3-20 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z]+$/.test(name)) {
      return NextResponse.json(
        { error: 'Name must contain only letters' },
        { status: 400 }
      );
    }

    // Validate class
    const classDef = classDefinitions.find((c) => c.id === classId);
    if (!classDef) {
      return NextResponse.json(
        { error: 'Invalid class' },
        { status: 400 }
      );
    }

    // Validate stats (should be reasonable ranges)
    const { str, dex, con, int, wis, cha } = stats;
    const statValues = [str, dex, con, int, wis, cha];
    for (const stat of statValues) {
      if (typeof stat !== 'number' || stat < 3 || stat > 18) {
        return NextResponse.json(
          { error: 'Invalid stat values (must be 3-18)' },
          { status: 400 }
        );
      }
    }

    // Initialize database
    initializeDatabase();
    const db = getDatabase();

    // Check if name exists
    const existingPlayer = playerQueries.findByName(db).get(name);
    if (existingPlayer) {
      return NextResponse.json(
        { error: 'Character name already taken' },
        { status: 400 }
      );
    }

    // Calculate starting resources
    const maxHp = classDef.baseHp + (con * 2);
    const maxMana = classDef.baseMana + (wis * 2) + int;
    const maxStamina = classDef.baseStamina + con + str;

    // Create player
    const result = playerQueries.create(db).run(
      accountId,
      name,
      classId,
      str, dex, con, int, wis, cha,
      maxHp, maxHp,      // hp, max_hp
      maxMana, maxMana,  // mana, max_mana
      maxStamina, maxStamina  // stamina, max_stamina
    );

    const playerId = result.lastInsertRowid as number;

    // Create equipment slots
    equipmentQueries.create(db).run(playerId);

    // Generate game token
    const gameToken = jwt.sign(
      {
        accountId,
        playerId,
        playerName: name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({
      success: true,
      playerId,
      playerName: name,
      gameToken,
    });

  } catch (error) {
    console.error('Character creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch classes
export async function GET() {
  return NextResponse.json({
    classes: classDefinitions.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      role: c.role,
      primaryStat: c.primaryStat,
      secondaryStat: c.secondaryStat,
    })),
  });
}
