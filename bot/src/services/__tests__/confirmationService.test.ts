import { ConfirmationService } from '../confirmationService';
import { Client, User, Message, MessageReaction, EmbedBuilder, TextChannel } from 'discord.js';
import { DecisionCandidate, MeetingSession, DecisionStatus, MeetingStatus } from '../../models/types';

// Mock dependencies
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  EmbedBuilder: jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('../observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));

jest.mock('../../utils/config', () => ({
  config: {
    discord: {
      decisionsChannelId: 'decisions-channel-123',
    },
  },
}));

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  let mockClient: jest.Mocked<Client>;
  let mockUser: jest.Mocked<User>;
  let mockMessage: jest.Mocked<Message>;
  let mockChannel: jest.Mocked<TextChannel>;

  beforeEach(() => {
    // Create mocks
    mockUser = {
      id: 'user123',
      tag: 'TestUser#1234',
      bot: false,
      send: jest.fn(),
    } as any;

    mockMessage = {
      id: 'message123',
      edit: jest.fn(),
      react: jest.fn(),
      content: 'Test decision message',
    } as any;

    mockChannel = {
      id: 'decisions-channel-123',
      isTextBased: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(mockMessage),
    } as any;

    mockClient = {
      on: jest.fn(),
      users: {
        fetch: jest.fn().mockResolvedValue(mockUser),
      },
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
    } as any;

    // Mock user.send to return message
    mockUser.send.mockResolvedValue(mockMessage);

    confirmationService = new ConfirmationService(mockClient);
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const createMockSession = (decisions: DecisionCandidate[] = []): MeetingSession => ({
    id: 'session123',
    guildId: 'guild123',
    channelId: 'channel123',
    startTime: new Date(),
    allParticipants: new Set(['user1', 'user2']),
    audioFiles: new Map(),
    transcripts: [],
    decisions,
    status: MeetingStatus.CONFIRMING,
  });

  const createMockDecision = (id: string, text: string): DecisionCandidate => ({
    id,
    text,
    speakerId: 'user1',
    status: DecisionStatus.PENDING,
    confirmationMessageIds: new Map(),
  });

  describe('CS-1: dmAllParticipants', () => {
    it('should send one DM per user and return message IDs', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Ship API v2 on June 20th');
      const session = createMockSession([decision]);

      // Act
      const confirmedDecisions = await confirmationService.confirmDecisions(session);

      // Assert
      expect(mockClient.users.fetch).toHaveBeenCalledTimes(2); // 2 participants
      expect(mockUser.send).toHaveBeenCalledTimes(2);
      expect(mockMessage.react).toHaveBeenCalledWith('❌');
      
      // Verify message IDs are stored
      expect(decision.confirmationMessageIds.size).toBe(2);
      expect(decision.confirmationMessageIds.has('user1')).toBe(true);
      expect(decision.confirmationMessageIds.has('user2')).toBe(true);
    });
  });

  describe('CS-2: cancelOnReaction', () => {
    it('should set status to canceled within 60 seconds', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Ship API v2 on June 20th');
      const session = createMockSession([decision]);

      // Start confirmation process
      const confirmPromise = confirmationService.confirmDecisions(session);

      // Simulate user reaction within timeout
      setTimeout(() => {
        const mockReaction = {
          emoji: { name: '❌' },
          message: { id: 'message123', content: 'Test message', edit: jest.fn() },
        } as any;

        // Trigger reaction handler directly
        confirmationService['handleReactionAdd'](mockReaction, mockUser);
      }, 30000); // 30 seconds - within timeout

      // Fast forward through timeout
      jest.advanceTimersByTime(35000); // 35 seconds
      
      const result = await confirmPromise;

      // Assert
      expect(result).toHaveLength(0); // Decision was cancelled
      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('❌ **Cancelled by TestUser#1234**')
        })
      );
    });
  });

  describe('CS-3: lateReactionIgnored', () => {
    it('should ignore reactions after 60 seconds and keep status as posted', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Ship API v2 on June 20th');
      const session = createMockSession([decision]);

      // Start confirmation process
      const confirmPromise = confirmationService.confirmDecisions(session);

      // Fast forward past timeout
      jest.advanceTimersByTime(61000); // 61 seconds
      
      const confirmedDecisions = await confirmPromise;

      // Now simulate late reaction
      const mockReaction = {
        emoji: { name: '❌' },
        message: { id: 'message123', content: 'Test message', edit: jest.fn() },
      } as any;

      confirmationService['handleReactionAdd'](mockReaction, mockUser);

      // Assert
      expect(confirmedDecisions).toHaveLength(1); // Decision was confirmed
      expect(confirmedDecisions[0].status).toBe(DecisionStatus.PENDING); // Still pending (to be set to confirmed later)
      expect(mockMessage.edit).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('❌ **Cancelled')
        })
      );
    });
  });

  describe('CS-4: handleDMPermissionDenied', () => {
    it('should fallback to channel mention when DMs are closed', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Ship API v2 on June 20th');
      const session = createMockSession([decision]);

      // Mock DM failure for one user
      mockUser.send.mockRejectedValueOnce(new Error('Cannot send messages to this user'));

      // Act
      await confirmationService.confirmDecisions(session);

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '⚠️ Confirmation Required',
              description: expect.stringContaining('<@user123>')
            })
          ])
        })
      );
    });
  });

  describe('CS-5: handleMultipleReactions', () => {
    it('should cancel all decisions when same user reacts to multiple', async () => {
      // Arrange
      const decision1 = createMockDecision('decision1', 'Ship API v2');
      const decision2 = createMockDecision('decision2', 'Upgrade to Node 20');
      const session = createMockSession([decision1, decision2]);

      // Mock different message IDs for each decision
      const mockMessage1 = { ...mockMessage, id: 'message1', edit: jest.fn() };
      const mockMessage2 = { ...mockMessage, id: 'message2', edit: jest.fn() };
      
      mockUser.send
        .mockResolvedValueOnce(mockMessage1 as any)
        .mockResolvedValueOnce(mockMessage2 as any)
        .mockResolvedValueOnce(mockMessage1 as any) // Second user gets same decisions
        .mockResolvedValueOnce(mockMessage2 as any);

      // Start confirmation
      const confirmPromise = confirmationService.confirmDecisions(session);

      // Simulate user reacting to both decisions
      setTimeout(() => {
        const mockReaction1 = {
          emoji: { name: '❌' },
          message: mockMessage1,
        } as any;
        
        const mockReaction2 = {
          emoji: { name: '❌' },
          message: mockMessage2,
        } as any;

        confirmationService['handleReactionAdd'](mockReaction1, mockUser);
        confirmationService['handleReactionAdd'](mockReaction2, mockUser);
      }, 30000);

      jest.advanceTimersByTime(35000);
      
      const result = await confirmPromise;

      // Assert
      expect(result).toHaveLength(0); // Both decisions cancelled
      expect(mockMessage1.edit).toHaveBeenCalled();
      expect(mockMessage2.edit).toHaveBeenCalled();
    });
  });

  describe('No Decisions Flow', () => {
    it('should handle zero decisions with participant confirmation', async () => {
      // Arrange
      const session = createMockSession([]); // No decisions

      // Act
      const result = await confirmationService.confirmDecisions(session);

      // Assert
      expect(result).toHaveLength(0);
      expect(mockUser.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '📝 No Decisions Detected'
            })
          ])
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle user fetch failures gracefully', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Test decision');
      const session = createMockSession([decision]);

      mockClient.users.fetch.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(confirmationService.confirmDecisions(session))
        .resolves.not.toThrow();
    });

    it('should handle channel fetch failures for fallback', async () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Test decision');
      const session = createMockSession([decision]);

      mockUser.send.mockRejectedValue(new Error('DM failed'));
      mockClient.channels.fetch.mockRejectedValue(new Error('Channel not found'));

      // Act & Assert
      await expect(confirmationService.confirmDecisions(session))
        .resolves.not.toThrow();
    });

    it('should handle reaction emoji validation', async () => {
      // Arrange
      const mockReaction = {
        emoji: { name: '👍' }, // Wrong emoji
        message: { id: 'message123' },
      } as any;

      // Act
      confirmationService['handleReactionAdd'](mockReaction, mockUser);

      // Assert - should be ignored
      expect(mockMessage.edit).not.toHaveBeenCalled();
    });

    it('should ignore bot reactions', async () => {
      // Arrange
      const botUser = { ...mockUser, bot: true };
      const mockReaction = {
        emoji: { name: '❌' },
        message: { id: 'message123' },
      } as any;

      // Act
      confirmationService['handleReactionAdd'](mockReaction, botUser as any);

      // Assert
      expect(mockMessage.edit).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clear all active timeouts on cleanup', () => {
      // Arrange
      const decision = createMockDecision('decision1', 'Test decision');
      const session = createMockSession([decision]);

      // Start confirmation to create timeouts
      confirmationService.confirmDecisions(session);

      // Verify timeouts exist
      expect(confirmationService['activeConfirmations'].size).toBeGreaterThan(0);

      // Act
      confirmationService.cleanup();

      // Assert
      expect(confirmationService['activeConfirmations'].size).toBe(0);
    });
  });
});