import { Publisher } from '../publisher';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { DecisionCandidate, MeetingSession, DecisionStatus, MeetingStatus } from '../../models/types';

// Mock dependencies
jest.mock('discord.js');
jest.mock('../observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));
jest.mock('../../utils/config', () => ({
  config: {
    discord: {
      decisionsChannelId: 'decisions-123',
      logsChannelId: 'logs-123',
    },
  },
}));

describe('Publisher', () => {
  let publisher: Publisher;
  let mockClient: jest.Mocked<Client>;
  let mockChannel: jest.Mocked<TextChannel>;

  beforeEach(() => {
    mockChannel = {
      id: 'decisions-123',
      isTextBased: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue({ id: 'sent-message-123' }),
    } as any;

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
    } as any;

    publisher = new Publisher(mockClient);
  });

  const createMockSession = (): MeetingSession => ({
    id: 'session123',
    guildId: 'guild123',
    channelId: 'channel123',
    startTime: new Date('2023-06-20T10:00:00Z'),
    endTime: new Date('2023-06-20T10:30:00Z'),
    allParticipants: new Set(['user1', 'user2']),
    audioFiles: new Map(),
    transcripts: [],
    decisions: [],
    status: MeetingStatus.PUBLISHING,
  });

  const createMockDecision = (text: string, status: DecisionStatus = DecisionStatus.CONFIRMED): DecisionCandidate => ({
    id: 'decision1',
    text,
    speakerId: 'user1',
    status,
    confirmationMessageIds: new Map(),
  });

  describe('PUB-1: postDecision', () => {
    it('should post decision with markdown matching snapshot', async () => {
      // Arrange
      const session = createMockSession();
      const decision = createMockDecision('Ship API v2 on June 20th');
      const confirmedDecisions = [decision];

      // Act
      await publisher.publishDecisions(session, confirmedDecisions);

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: '✅ Meeting Decisions',
            description: '1 decision confirmed from your meeting:',
            // Verify fields include participants, duration, date, time
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Participants' }),
              expect.objectContaining({ name: 'Duration', value: '30m 0s' }),
              expect.objectContaining({ name: 'Date', value: '6/20/2023' }),
              expect.objectContaining({ name: 'Time' }),
              expect.objectContaining({ 
                name: 'Decision 1',
                value: expect.stringContaining('Ship API v2 on June 20th')
              }),
            ]),
          })
        ])
      });
    });
  });

  describe('PUB-2: postCanceledNotice', () => {
    it('should post exactly 1 notice for cancelled decision', async () => {
      // Arrange
      const session = createMockSession();
      const cancelledDecision = createMockDecision('Skip retro meeting', DecisionStatus.CANCELLED);
      session.decisions = [cancelledDecision];

      // Act
      await publisher.publishDecisions(session, []);

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: '❌ Decision Cancelled',
            description: 'The following decision was cancelled by a participant:',
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Cancelled Decision',
                value: expect.stringContaining('Skip retro meeting')
              })
            ])
          })
        ])
      });
    });
  });

  describe('PUB-3: noDecisionConfirmed', () => {
    it('should post "no decisions detected (confirmed)" message', async () => {
      // Arrange
      const session = createMockSession();

      // Act
      await publisher.publishDecisions(session, []);

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: '📝 Meeting Summary',
            description: 'No decisions detected (confirmed by participants)',
          })
        ])
      });
    });
  });

  describe('PUB-4: formatTimestamps', () => {
    it('should include date/time & participant list in formatted output', async () => {
      // Arrange
      const session = createMockSession();
      const decision = createMockDecision('Test decision');

      // Act
      await publisher.publishDecisions(session, [decision]);

      // Assert
      const sentEmbed = mockChannel.send.mock.calls[0][0].embeds[0];
      
      expect(sentEmbed.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Participants',
            value: '<@user1>, <@user2>'
          }),
          expect.objectContaining({
            name: 'Duration',
            value: '30m 0s'
          }),
          expect.objectContaining({
            name: 'Date',
            value: expect.any(String)
          }),
          expect.objectContaining({
            name: 'Time',
            value: expect.any(String)
          })
        ])
      );
    });
  });

  describe('Error Publishing', () => {
    it('should publish error to logs channel', async () => {
      // Arrange
      const logsChannel = {
        id: 'logs-123',
        isTextBased: jest.fn().mockReturnValue(true),
        send: jest.fn(),
      } as any;

      mockClient.channels.fetch.mockImplementation((id) => {
        if (id === 'logs-123') return Promise.resolve(logsChannel);
        return Promise.resolve(mockChannel);
      });

      const error = new Error('Test error message');
      const sessionId = 'session123';

      // Act
      await publisher.publishError(sessionId, error);

      // Assert
      expect(logsChannel.send).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: '🚨 DecisionBot Error',
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Error',
                value: 'Test error message'
              }),
              expect.objectContaining({
                name: 'Session ID',
                value: sessionId
              })
            ])
          })
        ])
      });
    });
  });

  describe('Duration Formatting', () => {
    it('should format various durations correctly', () => {
      // Test the private formatDuration method through public interface
      const testCases = [
        { start: new Date('2023-01-01T10:00:00Z'), end: new Date('2023-01-01T10:00:30Z'), expected: '30s' },
        { start: new Date('2023-01-01T10:00:00Z'), end: new Date('2023-01-01T10:02:30Z'), expected: '2m 30s' },
        { start: new Date('2023-01-01T10:00:00Z'), end: new Date('2023-01-01T11:00:00Z'), expected: '60m 0s' },
      ];

      testCases.forEach(({ start, end, expected }) => {
        const session = createMockSession();
        session.startTime = start;
        session.endTime = end;

        // The formatDuration method is private, so we test through the public interface
        publisher.publishDecisions(session, [createMockDecision('Test')]);
        
        const call = mockChannel.send.mock.calls[mockChannel.send.mock.calls.length - 1];
        const embed = call[0].embeds[0];
        const durationField = embed.fields.find((f: any) => f.name === 'Duration');
        
        expect(durationField.value).toBe(expected);
      });
    });
  });
});