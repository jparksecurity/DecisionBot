import { VoiceManager } from '../voiceManager';
import { MeetingManager } from '../meetingManager';
import { Client, VoiceState, VoiceChannel, GuildMember, User, Guild } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, VoiceConnection } from '@discordjs/voice';
import { MeetingStatus } from '../../models/types';

// Mock dependencies
jest.mock('@discordjs/voice');
jest.mock('../meetingManager');
jest.mock('../observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));

const mockJoinVoiceChannel = joinVoiceChannel as jest.MockedFunction<typeof joinVoiceChannel>;
const mockGetVoiceConnection = getVoiceConnection as jest.MockedFunction<typeof getVoiceConnection>;

describe('VoiceManager', () => {
  let voiceManager: VoiceManager;
  let mockClient: jest.Mocked<Client>;
  let mockMeetingManager: jest.Mocked<MeetingManager>;
  let mockConnection: jest.Mocked<VoiceConnection>;

  beforeEach(() => {
    // Create mocks
    mockClient = {
      on: jest.fn(),
      user: { id: 'bot-id', tag: 'DecisionBot#1234' },
    } as any;

    mockMeetingManager = {
      processMeeting: jest.fn(),
    } as any;

    mockConnection = {
      on: jest.fn(),
      destroy: jest.fn(),
    } as any;

    // Setup voice channel mocks
    mockJoinVoiceChannel.mockReturnValue(mockConnection);
    mockGetVoiceConnection.mockReturnValue(mockConnection);

    voiceManager = new VoiceManager(mockClient, mockMeetingManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('VM-1: joinOnFirstMember', () => {
    it('should join voice channel when first human user joins', async () => {
      // Arrange
      const mockUser = { id: 'user1', bot: false, tag: 'User1#1234' } as User;
      const mockMember = {
        id: 'user1',
        user: mockUser,
      } as GuildMember;

      const mockGuild = { 
        id: 'guild1',
        voiceAdapterCreator: jest.fn(),
      } as any;

      const mockChannel = {
        id: 'channel1',
        name: 'General Voice',
        guildId: 'guild1',
        guild: mockGuild,
        members: new Map([['user1', mockMember]]),
      } as any;

      const oldState = { channel: null, member: mockMember } as VoiceState;
      const newState = { channel: mockChannel, member: mockMember } as VoiceState;

      // Mock the connection callbacks
      mockConnection.on.mockImplementation((event, callback) => {
        if (event === VoiceConnectionStatus.Ready) {
          setTimeout(() => callback(), 10);
        }
        return mockConnection;
      });

      // Act
      await voiceManager['handleVoiceStateUpdate'](oldState, newState);

      // Assert
      expect(mockJoinVoiceChannel).toHaveBeenCalledWith({
        channelId: 'channel1',
        guildId: 'guild1',
        adapterCreator: mockGuild.voiceAdapterCreator,
      });

      // Check session was created with recording status
      const sessions = voiceManager['activeSessions'];
      expect(sessions.size).toBe(1);
      
      const session = sessions.get('channel1');
      expect(session).toBeDefined();
      expect(session!.status).toBe(MeetingStatus.RECORDING);
      expect(session!.allParticipants.has('user1')).toBe(true);
    });
  });

  describe('VM-2: ignoreRejoin', () => {
    it('should not change allParticipants size when user leaves and rejoins', async () => {
      // Arrange - Create initial session
      const mockUser = { id: 'user1', bot: false, tag: 'User1#1234' } as User;
      const mockMember = { id: 'user1', user: mockUser } as GuildMember;
      const mockChannel = {
        id: 'channel1',
        name: 'General Voice',
        guildId: 'guild1',
        guild: { id: 'guild1', voiceAdapterCreator: jest.fn() },
        members: new Map([['user1', mockMember]]),
      } as any;

      // Initial join
      const initialJoin = { channel: null, member: mockMember } as VoiceState;
      const joinState = { channel: mockChannel, member: mockMember } as VoiceState;
      await voiceManager['handleVoiceStateUpdate'](initialJoin, joinState);

      const initialSession = voiceManager['activeSessions'].get('channel1');
      const initialParticipantCount = initialSession!.allParticipants.size;

      // User leaves
      const leaveState = { channel: null, member: mockMember } as VoiceState;
      await voiceManager['handleVoiceStateUpdate'](joinState, leaveState);

      // User rejoins
      const rejoinState = { channel: mockChannel, member: mockMember } as VoiceState;
      await voiceManager['handleVoiceStateUpdate'](leaveState, rejoinState);

      // Assert
      const finalSession = voiceManager['activeSessions'].get('channel1');
      expect(finalSession!.allParticipants.size).toBe(initialParticipantCount);
      expect(finalSession!.allParticipants.has('user1')).toBe(true);
    });
  });

  describe('VM-3: handleKick', () => {
    it('should set skipProcessing=true and close streams when bot is kicked', async () => {
      // Arrange
      const mockChannel = {
        id: 'channel1',
        guildId: 'guild1',
      } as VoiceChannel;

      // Create active session
      const session = {
        id: 'session1',
        channelId: 'channel1',
        guildId: 'guild1',
        status: MeetingStatus.RECORDING,
        allParticipants: new Set(['user1']),
        startTime: new Date(),
        audioFiles: new Map(),
        transcripts: [],
        decisions: [],
      };
      voiceManager['activeSessions'].set('channel1', session as any);

      // Mock recorder
      const mockRecorder = {
        cleanup: jest.fn(),
        stopAllRecordings: jest.fn(),
      };
      voiceManager['recorders'].set('session1', mockRecorder as any);

      // Act
      await voiceManager.handleBotRemoved('guild1', 'channel1');

      // Assert
      expect(session.status).toBe(MeetingStatus.CANCELLED);
      expect(mockRecorder.cleanup).toHaveBeenCalled();
      expect(voiceManager['activeSessions'].has('channel1')).toBe(false);
    });
  });

  describe('VM-4: handleDisconnection', () => {
    it('should cleanup when VoiceConnectionStatus.Disconnected occurs', async () => {
      // Arrange
      const mockChannel = {
        id: 'channel1',
        guildId: 'guild1',
        guild: { voiceAdapterCreator: jest.fn() },
        name: 'Test Channel',
      } as any;

      const session = {
        id: 'session1',
        channelId: 'channel1',
        status: MeetingStatus.RECORDING,
        allParticipants: new Set(['user1']),
      };
      voiceManager['activeSessions'].set('channel1', session as any);

      // Setup connection to emit Disconnected
      let disconnectCallback: () => void;
      mockConnection.on.mockImplementation((event, callback) => {
        if (event === VoiceConnectionStatus.Disconnected) {
          disconnectCallback = callback;
        }
        return mockConnection;
      });

      // Create session (which sets up connection)
      await voiceManager['joinChannel'](mockChannel, session as any);

      // Act - Trigger disconnection
      disconnectCallback!();

      // Give some time for async cleanup
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(session.status).toBe(MeetingStatus.CANCELLED);
    });
  });

  describe('VM-5: ignoreBotVoiceUpdates', () => {
    it('should ignore voice state changes from bot users', async () => {
      // Arrange
      const botUser = { id: 'bot2', bot: true, tag: 'OtherBot#5678' } as User;
      const botMember = { id: 'bot2', user: botUser } as GuildMember;
      const mockChannel = { id: 'channel1' } as VoiceChannel;

      const oldState = { channel: null, member: botMember } as VoiceState;
      const newState = { channel: mockChannel, member: botMember } as VoiceState;

      // Act
      await voiceManager['handleVoiceStateUpdate'](oldState, newState);

      // Assert
      expect(mockJoinVoiceChannel).not.toHaveBeenCalled();
      expect(voiceManager['activeSessions'].size).toBe(0);
    });
  });

  describe('VM-6: handleChannelMove', () => {
    it('should transfer session when user moves between channels', async () => {
      // Arrange
      const mockUser = { id: 'user1', bot: false, tag: 'User1#1234' } as User;
      const mockMember = { id: 'user1', user: mockUser } as GuildMember;
      
      const channel1 = {
        id: 'channel1',
        guildId: 'guild1',
        guild: { voiceAdapterCreator: jest.fn() },
        name: 'Channel 1',
        members: new Map(),
      } as any;

      const channel2 = {
        id: 'channel2',
        guildId: 'guild1',
        guild: { voiceAdapterCreator: jest.fn() },
        name: 'Channel 2',
        members: new Map([['user1', mockMember]]),
      } as any;

      // Initial join to channel1
      const initialJoin = { channel: null, member: mockMember } as VoiceState;
      const channel1State = { channel: channel1, member: mockMember } as VoiceState;
      await voiceManager['handleVoiceStateUpdate'](initialJoin, channel1State);

      // Verify session created for channel1
      expect(voiceManager['activeSessions'].has('channel1')).toBe(true);
      const session1 = voiceManager['activeSessions'].get('channel1');
      expect(session1!.allParticipants.has('user1')).toBe(true);

      // Mock empty channel1 after move
      channel1.members = new Map();

      // Move to channel2
      const channel2State = { channel: channel2, member: mockMember } as VoiceState;
      await voiceManager['handleVoiceStateUpdate'](channel1State, channel2State);

      // Assert
      // Channel1 session should be ended/processed (since it's now empty)
      expect(mockMeetingManager.processMeeting).toHaveBeenCalledWith(session1);
      
      // New session should be created for channel2
      expect(voiceManager['activeSessions'].has('channel2')).toBe(true);
      const session2 = voiceManager['activeSessions'].get('channel2');
      expect(session2!.allParticipants.has('user1')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined channel gracefully', async () => {
      const mockMember = { user: { bot: false } } as GuildMember;
      const oldState = { channel: null, member: mockMember } as VoiceState;
      const newState = { channel: null, member: mockMember } as VoiceState;

      // Should not throw
      await expect(
        voiceManager['handleVoiceStateUpdate'](oldState, newState)
      ).resolves.not.toThrow();
    });

    it('should handle missing member gracefully', async () => {
      const oldState = { channel: null, member: null } as any;
      const newState = { channel: null, member: null } as any;

      // Should not throw
      await expect(
        voiceManager['handleVoiceStateUpdate'](oldState, newState)
      ).resolves.not.toThrow();
    });
  });
});