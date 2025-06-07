import { 
  VoiceState, 
  VoiceChannel,
  VoiceBasedChannel, 
  GuildMember,
  Client 
} from 'discord.js';
import { 
  joinVoiceChannel, 
  VoiceConnection, 
  VoiceConnectionStatus,
  getVoiceConnection
} from '@discordjs/voice';
import { MeetingSession, MeetingStatus } from '../models/types';
import { RecorderService } from './recorder';
import { MeetingManager } from './meetingManager';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';

export class VoiceManager {
  private client: Client;
  private meetingManager: MeetingManager;
  private activeSessions = new Map<string, MeetingSession>(); // channelId -> session
  private recorders = new Map<string, RecorderService>(); // sessionId -> recorder

  constructor(client: Client, meetingManager: MeetingManager) {
    this.client = client;
    this.meetingManager = meetingManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const channelId = newChannel?.id || oldChannel?.id;

    if (!channelId) return;

    await observabilityService.executeWithSpan(
      'voice_manager.handle_voice_state_update',
      async () => {
        // User joined a channel
        if (!oldChannel && newChannel) {
          await this.handleUserJoin(member, newChannel);
        }
        // User left a channel
        else if (oldChannel && !newChannel) {
          await this.handleUserLeave(member, oldChannel);
        }
        // User moved between channels
        else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
          await this.handleUserLeave(member, oldChannel);
          await this.handleUserJoin(member, newChannel);
        }
      },
      { 
        userId: member.id, 
        oldChannelId: oldChannel?.id || 'none',
        newChannelId: newChannel?.id || 'none'
      }
    );
  }

  private async handleUserJoin(member: GuildMember, channel: VoiceBasedChannel): Promise<void> {
    const channelId = channel.id;
    let session = this.activeSessions.get(channelId);

    // First human user joins - create session and bot joins
    if (!session) {
      session = await this.createMeetingSession(channel);
      await this.joinChannel(channel, session);
    }

    // Add user to session
    session.allParticipants.add(member.id);
    
    // Start recording for this user
    const recorder = this.recorders.get(session.id);
    if (recorder) {
      const connection = getVoiceConnection(channel.guildId);
      if (connection) {
        await recorder.startRecording(connection, member.id);
      }
    }

    logger.info(`User ${member.user.tag} joined channel ${channel.name}`, {
      sessionId: session.id,
      participantCount: session.allParticipants.size
    });
  }

  private async handleUserLeave(member: GuildMember, channel: VoiceBasedChannel): Promise<void> {
    const session = this.activeSessions.get(channel.id);
    if (!session) return;

    // Stop recording for this user
    const recorder = this.recorders.get(session.id);
    if (recorder) {
      recorder.stopRecording(member.id);
    }

    logger.info(`User ${member.user.tag} left channel ${channel.name}`, {
      sessionId: session.id
    });

    // Check if channel is now empty (no human users)
    const remainingUsers = channel.members.filter(m => !m.user.bot);
    if (remainingUsers.size === 0) {
      await this.endMeetingSession(session);
    }
  }

  private async createMeetingSession(channel: VoiceBasedChannel): Promise<MeetingSession> {
    const sessionId = `${channel.guildId}-${Date.now()}`;
    const session: MeetingSession = {
      id: sessionId,
      guildId: channel.guildId,
      channelId: channel.id,
      startTime: new Date(),
      allParticipants: new Set(),
      audioFiles: new Map(),
      transcripts: [],
      decisions: [],
      status: MeetingStatus.RECORDING
    };

    this.activeSessions.set(channel.id, session);
    
    // Create recorder for this session
    const recorder = new RecorderService(sessionId);
    this.recorders.set(sessionId, recorder);

    logger.info(`Created meeting session ${sessionId} for channel ${channel.name}`);
    return session;
  }

  private async joinChannel(channel: VoiceBasedChannel, session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'voice_manager.join_channel',
      async () => {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guildId,
          adapterCreator: channel.guild.voiceAdapterCreator as any,
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
          logger.info(`Bot joined voice channel ${channel.name}`);
        });

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          logger.warn(`Bot disconnected from channel ${channel.name}`);
          // If disconnected before meeting ends, mark as cancelled
          if (session.status === MeetingStatus.RECORDING) {
            session.status = MeetingStatus.CANCELLED;
            await this.cleanupSession(session);
          }
        });
      },
      { channelId: channel.id, sessionId: session.id }
    );
  }

  private async endMeetingSession(session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'voice_manager.end_meeting_session',
      async () => {
        session.endTime = new Date();
        session.status = MeetingStatus.PROCESSING;

        logger.info(`Ending meeting session ${session.id}`, {
          duration: session.endTime.getTime() - session.startTime.getTime(),
          participantCount: session.allParticipants.size
        });

        // Disconnect from voice channel
        const connection = getVoiceConnection(session.guildId);
        if (connection) {
          connection.destroy();
        }

        // Stop all recordings
        const recorder = this.recorders.get(session.id);
        if (recorder) {
          recorder.stopAllRecordings();
          session.audioFiles = recorder.getAllAudioFiles();
        }

        // Remove from active sessions
        this.activeSessions.delete(session.channelId);

        // Hand off to meeting manager for processing
        await this.meetingManager.processMeeting(session);
      },
      { sessionId: session.id }
    );
  }

  private async cleanupSession(session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'voice_manager.cleanup_session',
      async () => {
        const recorder = this.recorders.get(session.id);
        if (recorder) {
          await recorder.cleanup();
          this.recorders.delete(session.id);
        }

        this.activeSessions.delete(session.channelId);
        
        logger.info(`Cleaned up session ${session.id}`);
      },
      { sessionId: session.id }
    );
  }

  async handleBotRemoved(guildId: string, channelId: string): Promise<void> {
    const session = this.activeSessions.get(channelId);
    if (session) {
      session.status = MeetingStatus.CANCELLED;
      await this.cleanupSession(session);
      logger.info(`Bot was removed from channel, session ${session.id} cancelled`);
    }
  }
}