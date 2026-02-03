// Registration API for Llama Picchu MUD
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getDatabase, initializeDatabase, accountQueries } from '../../../../../server/database';

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json();

    // Validate input
    if (!username || !password || !email) {
      return NextResponse.json(
        { error: 'Username, password, and email are required' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Initialize database if needed
    initializeDatabase();
    const db = getDatabase();

    // Check if username exists
    const existingUser = accountQueries.findByUsername(db).get(username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      );
    }

    // Hash password and create account
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = accountQueries.create(db).run(username, passwordHash, email);

    return NextResponse.json({
      success: true,
      accountId: result.lastInsertRowid,
      message: 'Account created successfully',
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
