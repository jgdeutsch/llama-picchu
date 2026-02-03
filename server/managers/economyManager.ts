// Economy Manager for FROBARK
// Handles jobs, employment, wages, and economic transactions

import { getDatabase, playerQueries } from '../database';
import { connectionManager } from './connectionManager';
import { npcLifeManager } from './npcLifeManager';
import { getNpcById } from '../data/npcs';
import { getJobById, getJobsAtLocation, getJobsByEmployer, type JobDefinition } from '../data/jobs';

interface PlayerEmployment {
  id: number;
  playerId: number;
  jobId: number;
  hiredAt: Date;
  tasksCompleted: number;
  totalEarned: number;
  standing: 'new' | 'reliable' | 'valued' | 'essential' | 'fired';
}

interface WorkSession {
  playerId: number;
  jobId: number;
  startTick: number;
  ticksRemaining: number;
  taskDescription: string;
}

class EconomyManager {
  // Track active work sessions
  private workSessions: Map<number, WorkSession> = new Map();
  private tickCount = 0;

  // Initialize - seed jobs into database if needed
  initialize(): void {
    this.seedJobs();
    console.log('[Economy] Economy manager initialized');
  }

  // Seed job definitions into the database
  private seedJobs(): void {
    const db = getDatabase();
    const { jobDefinitions } = require('../data/jobs');

    for (const job of jobDefinitions) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO jobs (id, name, employer_npc_id, location, description, pay_per_task, skill_required, skill_min_level, reputation_required, tasks_available)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          job.id,
          job.name,
          job.employerNpcId,
          job.location,
          job.description,
          job.payPerTask,
          job.skillRequired,
          job.skillMinLevel,
          job.reputationRequired,
          -1 // Unlimited tasks
        );
      } catch (error) {
        // Job already exists or other error
      }
    }
  }

  // Get jobs available to a player at their current location
  getAvailableJobs(playerId: number, roomId: string): { job: JobDefinition; canWork: boolean; reason?: string }[] {
    const db = getDatabase();
    const jobsHere = getJobsAtLocation(roomId);
    const results: { job: JobDefinition; canWork: boolean; reason?: string }[] = [];

    for (const job of jobsHere) {
      let canWork = true;
      let reason: string | undefined;

      // Check reputation requirement
      if (job.employerNpcId) {
        const socialCapital = db.prepare(`
          SELECT capital FROM social_capital
          WHERE player_id = ? AND npc_id = ?
        `).get(playerId, job.employerNpcId) as { capital: number } | undefined;

        const capital = socialCapital?.capital || 0;

        if (capital < job.reputationRequired) {
          canWork = false;
          const npc = getNpcById(job.employerNpcId);
          reason = `${npc?.name || 'The employer'} doesn't trust you enough (need ${job.reputationRequired} social capital)`;
        }
      }

      // Check if already employed elsewhere (can only have one job at a time for simplicity)
      const currentJob = db.prepare(`
        SELECT job_id FROM player_employment
        WHERE player_id = ? AND standing != 'fired'
      `).get(playerId) as { job_id: number } | undefined;

      if (currentJob && currentJob.job_id !== job.id) {
        canWork = false;
        reason = 'You already have a job. Quit first to take a new one.';
      }

      // Check if currently working
      if (this.workSessions.has(playerId)) {
        canWork = false;
        reason = 'You\'re already working!';
      }

      results.push({ job, canWork, reason });
    }

    return results;
  }

  // Apply for a job
  applyForJob(playerId: number, jobId: number): { success: boolean; message: string } {
    const db = getDatabase();
    const job = getJobById(jobId);

    if (!job) {
      return { success: false, message: 'That job doesn\'t exist.' };
    }

    // Get player's current room
    const player = playerQueries.findById(db).get(playerId) as { current_room: string } | undefined;
    if (!player || player.current_room !== job.location) {
      return { success: false, message: 'You need to be at the job location to apply.' };
    }

    // Check reputation
    if (job.employerNpcId) {
      const socialCapital = db.prepare(`
        SELECT capital FROM social_capital
        WHERE player_id = ? AND npc_id = ?
      `).get(playerId, job.employerNpcId) as { capital: number } | undefined;

      const capital = socialCapital?.capital || 0;
      if (capital < job.reputationRequired) {
        const npc = getNpcById(job.employerNpcId);
        return {
          success: false,
          message: `${npc?.name || 'The employer'} doesn't trust you enough yet. Build your relationship first.`
        };
      }
    }

    // Check if already employed
    const existingJob = db.prepare(`
      SELECT id FROM player_employment WHERE player_id = ? AND standing != 'fired'
    `).get(playerId);

    if (existingJob) {
      return { success: false, message: 'You already have a job. Quit first to take another.' };
    }

    // Hire the player
    db.prepare(`
      INSERT INTO player_employment (player_id, job_id)
      VALUES (?, ?)
    `).run(playerId, jobId);

    const npc = job.employerNpcId ? getNpcById(job.employerNpcId) : null;
    const employerName = npc?.name || 'The village';

    return {
      success: true,
      message: `${employerName} has hired you as a ${job.name}! Type "work" to start a task.`
    };
  }

  // Quit a job
  quitJob(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    const employment = db.prepare(`
      SELECT pe.*, j.name as job_name, j.employer_npc_id
      FROM player_employment pe
      JOIN jobs j ON pe.job_id = j.id
      WHERE pe.player_id = ? AND pe.standing != 'fired'
    `).get(playerId) as any;

    if (!employment) {
      return { success: false, message: 'You don\'t have a job to quit.' };
    }

    // Update standing to quit
    db.prepare(`
      UPDATE player_employment
      SET standing = 'fired', fired_at = CURRENT_TIMESTAMP
      WHERE player_id = ? AND standing != 'fired'
    `).run(playerId);

    // Small reputation penalty for quitting
    if (employment.employer_npc_id) {
      db.prepare(`
        UPDATE social_capital
        SET capital = MAX(-100, capital - 5)
        WHERE player_id = ? AND npc_id = ?
      `).run(playerId, employment.employer_npc_id);
    }

    return {
      success: true,
      message: `You quit your job as a ${employment.job_name}. You can find new work elsewhere.`
    };
  }

  // Start working on a task
  startWork(playerId: number): { success: boolean; message: string } {
    const db = getDatabase();

    // Check if already working
    if (this.workSessions.has(playerId)) {
      const session = this.workSessions.get(playerId)!;
      return {
        success: false,
        message: `You're already ${session.taskDescription}. (${session.ticksRemaining} ticks remaining)`
      };
    }

    // Get current employment
    const employment = db.prepare(`
      SELECT pe.job_id, j.name, j.location, j.pay_per_task
      FROM player_employment pe
      JOIN jobs j ON pe.job_id = j.id
      WHERE pe.player_id = ? AND pe.standing != 'fired'
    `).get(playerId) as { job_id: number; name: string; location: string; pay_per_task: number } | undefined;

    if (!employment) {
      return { success: false, message: 'You don\'t have a job. Look for work with "jobs" or ask NPCs.' };
    }

    // Check if at the right location
    const player = playerQueries.findById(db).get(playerId) as { current_room: string } | undefined;
    if (!player || player.current_room !== employment.location) {
      return {
        success: false,
        message: `You need to be at ${employment.location} to work as a ${employment.name}.`
      };
    }

    // Get job details
    const job = getJobById(employment.job_id);
    if (!job) {
      return { success: false, message: 'Error: Job not found.' };
    }

    // Start the work session
    const session: WorkSession = {
      playerId,
      jobId: job.id,
      startTick: this.tickCount,
      ticksRemaining: job.taskDuration,
      taskDescription: job.taskDescription,
    };

    this.workSessions.set(playerId, session);

    return {
      success: true,
      message: `You begin ${job.taskDescription}...\n[Work in progress - ${job.taskDuration} ticks remaining]`
    };
  }

  // Process work tick - called by game loop
  tick(): void {
    this.tickCount++;

    // Process active work sessions
    for (const [playerId, session] of this.workSessions) {
      session.ticksRemaining--;

      if (session.ticksRemaining <= 0) {
        this.completeWork(playerId, session);
        this.workSessions.delete(playerId);
      } else if (session.ticksRemaining % 2 === 0) {
        // Periodic update
        connectionManager.sendToPlayer(playerId, {
          type: 'output',
          text: `[Still ${session.taskDescription}... ${session.ticksRemaining} ticks remaining]`,
          messageType: 'system',
        });
      }
    }
  }

  // Complete a work task
  private completeWork(playerId: number, session: WorkSession): void {
    const db = getDatabase();
    const job = getJobById(session.jobId);

    if (!job) return;

    // Pay the player
    const pay = job.payPerTask;
    db.prepare(`UPDATE players SET gold = gold + ? WHERE id = ?`).run(pay, playerId);

    // Update employment record
    db.prepare(`
      UPDATE player_employment
      SET tasks_completed = tasks_completed + 1,
          total_earned = total_earned + ?
      WHERE player_id = ? AND job_id = ?
    `).run(pay, playerId, session.jobId);

    // Check for standing upgrade
    this.checkStandingUpgrade(playerId, session.jobId);

    // Small social capital gain with employer
    if (job.employerNpcId) {
      const gain = Math.random() < 0.3 ? 1 : 0; // 30% chance to gain 1 capital
      if (gain > 0) {
        db.prepare(`
          INSERT INTO social_capital (player_id, npc_id, capital, last_interaction)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (player_id, npc_id) DO UPDATE SET
            capital = MIN(100, capital + 1),
            last_interaction = CURRENT_TIMESTAMP
        `).run(playerId, job.employerNpcId, gain);
      }
    }

    // Notify player
    connectionManager.sendToPlayer(playerId, {
      type: 'output',
      text: `\n${job.completionMessage}\n[+${pay} gold]`,
      messageType: 'normal',
    });
  }

  // Check if player should be promoted
  private checkStandingUpgrade(playerId: number, jobId: number): void {
    const db = getDatabase();

    const employment = db.prepare(`
      SELECT tasks_completed, standing FROM player_employment
      WHERE player_id = ? AND job_id = ?
    `).get(playerId, jobId) as { tasks_completed: number; standing: string } | undefined;

    if (!employment) return;

    const tasks = employment.tasks_completed;
    let newStanding = employment.standing;

    if (tasks >= 50 && employment.standing !== 'essential') {
      newStanding = 'essential';
    } else if (tasks >= 20 && employment.standing === 'reliable') {
      newStanding = 'valued';
    } else if (tasks >= 5 && employment.standing === 'new') {
      newStanding = 'reliable';
    }

    if (newStanding !== employment.standing) {
      db.prepare(`
        UPDATE player_employment SET standing = ? WHERE player_id = ? AND job_id = ?
      `).run(newStanding, playerId, jobId);

      const standingMessages: Record<string, string> = {
        reliable: 'Your employer considers you a reliable worker now.',
        valued: 'Your employer values your contributions greatly!',
        essential: 'You\'ve become an essential part of the operation!',
      };

      connectionManager.sendToPlayer(playerId, {
        type: 'output',
        text: `\n[Promotion] ${standingMessages[newStanding] || 'Your standing has improved.'}\n`,
        messageType: 'system',
      });
    }
  }

  // Get player's current job info
  getCurrentJob(playerId: number): { job: JobDefinition; employment: any } | null {
    const db = getDatabase();

    const employment = db.prepare(`
      SELECT * FROM player_employment
      WHERE player_id = ? AND standing != 'fired'
    `).get(playerId) as any;

    if (!employment) return null;

    const job = getJobById(employment.job_id);
    if (!job) return null;

    return { job, employment };
  }

  // Transfer gold between players
  transferGold(fromPlayerId: number, toPlayerId: number, amount: number): { success: boolean; message: string } {
    const db = getDatabase();

    if (amount <= 0) {
      return { success: false, message: 'Amount must be positive.' };
    }

    const fromPlayer = db.prepare(`SELECT gold, name FROM players WHERE id = ?`).get(fromPlayerId) as { gold: number; name: string } | undefined;
    if (!fromPlayer || fromPlayer.gold < amount) {
      return { success: false, message: 'You don\'t have enough gold.' };
    }

    const toPlayer = db.prepare(`SELECT name FROM players WHERE id = ?`).get(toPlayerId) as { name: string } | undefined;
    if (!toPlayer) {
      return { success: false, message: 'That player doesn\'t exist.' };
    }

    // Transfer
    db.prepare(`UPDATE players SET gold = gold - ? WHERE id = ?`).run(amount, fromPlayerId);
    db.prepare(`UPDATE players SET gold = gold + ? WHERE id = ?`).run(amount, toPlayerId);

    // Notify recipient
    connectionManager.sendToPlayer(toPlayerId, {
      type: 'output',
      text: `\n${fromPlayer.name} gave you ${amount} gold.\n`,
      messageType: 'normal',
    });

    return { success: true, message: `You gave ${amount} gold to ${toPlayer.name}.` };
  }

  // Check if player is currently working
  isWorking(playerId: number): boolean {
    return this.workSessions.has(playerId);
  }

  // Get work status
  getWorkStatus(playerId: number): string | null {
    const session = this.workSessions.get(playerId);
    if (!session) return null;
    return `${session.taskDescription} (${session.ticksRemaining} ticks remaining)`;
  }
}

export const economyManager = new EconomyManager();
