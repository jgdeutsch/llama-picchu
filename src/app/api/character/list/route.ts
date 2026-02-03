// Character List API for Llama Picchu MUD
import { NextRequest, NextResponse } from 'next/server';
import {
  getDatabase,
  initializeDatabase,
  playerQueries,
} from '../../../../../server/database';
import { classDefinitions } from '../../../../../server/data/classes';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID required' },
        { status: 400 }
      );
    }

    initializeDatabase();
    const db = getDatabase();

    const characters = playerQueries.findByAccountId(db).all(parseInt(accountId)) as {
      id: number;
      name: string;
      level: number;
      class_id: number;
      current_room: string;
      gold: number;
      last_login: string;
    }[];

    const characterData = characters.map((c) => {
      const classDef = classDefinitions.find((cd) => cd.id === c.class_id);
      return {
        id: c.id,
        name: c.name,
        level: c.level,
        className: classDef?.name || 'Unknown',
        gold: c.gold,
        lastLogin: c.last_login,
      };
    });

    return NextResponse.json({ characters: characterData });

  } catch (error) {
    console.error('Character list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    );
  }
}
