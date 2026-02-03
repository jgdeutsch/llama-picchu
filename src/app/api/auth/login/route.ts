// Login API for Llama Picchu MUD
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDatabase, initializeDatabase, accountQueries, playerQueries } from '../../../../../server/database';

const JWT_SECRET = process.env.JWT_SECRET || 'llama-picchu-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { username, password, playerId } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Initialize database if needed
    initializeDatabase();
    const db = getDatabase();

    // Find account
    const account = accountQueries.findByUsername(db).get(username) as {
      id: number;
      username: string;
      password_hash: string;
    } | undefined;

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Update last login
    accountQueries.updateLastLogin(db).run(account.id);

    // Get characters for this account
    const characters = playerQueries.findByAccountId(db).all(account.id) as {
      id: number;
      name: string;
      level: number;
      class_id: number;
    }[];

    // If playerId specified and valid, generate game token
    let gameToken = null;
    if (playerId) {
      const player = characters.find((c) => c.id === playerId);
      if (player) {
        gameToken = jwt.sign(
          {
            accountId: account.id,
            playerId: player.id,
            playerName: player.name,
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Update player last login
        playerQueries.updateLastLogin(db).run(player.id);
      }
    }

    return NextResponse.json({
      success: true,
      accountId: account.id,
      characters,
      gameToken,
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
