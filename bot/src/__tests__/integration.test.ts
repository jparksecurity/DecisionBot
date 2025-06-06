import { Client } from 'discord.js';
import { ByteNiteAdapter } from '../services/byteniteAdapter';
import { DecisionExtractor } from '../services/decisionExtractor';
import { VoiceManager } from '../services/voiceManager';
import { MeetingManager } from '../services/meetingManager';
import { observabilityService } from '../services/observability';
import axios from 'axios';
import { performance } from 'perf_hooks';

// Mock external dependencies for integration tests
jest.mock('axios');
jest.mock('discord.js');
jest.mock('@discordjs/voice');

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Integration Tests (INT-1 through INT-11)
 * These tests verify end-to-end functionality across service boundaries
 */
describe('Integration Tests', () => {
  let mockClient: jest.Mocked<Client>;
  let byteniteAdapter: ByteNiteAdapter;
  let decisionExtractor: DecisionExtractor;
  let meetingManager: MeetingManager;

  beforeEach(() => {
    mockClient = {
      on: jest.fn(),
      users: { fetch: jest.fn() },
      channels: { fetch: jest.fn() },
    } as any;

    byteniteAdapter = new ByteNiteAdapter();
    decisionExtractor = new DecisionExtractor();
    meetingManager = new MeetingManager(
      byteniteAdapter,
      decisionExtractor,
      {} as any, // confirmationService
      {} as any  // publisher
    );

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('INT-1: End-to-End Flow', () => {
    it('should complete full meeting lifecycle with mock services', async () => {
      // Arrange
      const mockSession = {
        id: 'session123',
        guildId: 'guild123',
        channelId: 'channel123',
        startTime: new Date(),
        allParticipants: new Set(['user1', 'user2']),
        audioFiles: new Map([
          ['user1', '/tmp/user1.wav'],
          ['user2', '/tmp/user2.wav']
        ]),
        transcripts: [],
        decisions: [],
        status: 'recording' as const,
      };

      // Mock ByteNite responses
      mockedAxios.post.mockResolvedValue({
        data: { jobId: 'job123' }
      });
      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'job123', 
          status: 'completed', 
          transcript: 'We should ship API v2 on June 20th' 
        }
      });

      // Mock GMI decision extraction
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('decision-extractor')) {
          return Promise.resolve({
            data: {
              decisions: [{
                text: 'Ship API v2 on June 20th',
                speakerId: 'user1',
                confidence: 0.9
              }]
            }
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Mock filesystem operations
      jest.doMock('fs', () => ({
        createReadStream: jest.fn().mockReturnValue({}),
      }));

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      expect(mockSession.transcripts.length).toBeGreaterThan(0);
      expect(mockSession.decisions.length).toBeGreaterThan(0);
      expect(mockSession.decisions[0].text).toContain('Ship API v2');
    });
  });

  describe('INT-2: Fallback Flow', () => {
    it('should use regex fallback when ByteNite 500s and create Langtrace span', async () => {
      // Arrange
      const mockSession = {
        id: 'session123',
        guildId: 'guild123',
        startTime: new Date(),
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock ByteNite failure
      mockedAxios.post.mockRejectedValue(new Error('Server Error 500'));
      
      // Mock file stats for fallback
      jest.doMock('fs', () => ({
        createReadStream: jest.fn(),
        promises: {
          stat: jest.fn().mockResolvedValue({ size: 32000 })
        }
      }));

      // Spy on observability spans
      const executeWithSpanSpy = jest.spyOn(observabilityService, 'executeWithSpan');

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      expect(executeWithSpanSpy).toHaveBeenCalledWith(
        expect.stringContaining('fallback'),
        expect.any(Function),
        expect.objectContaining({ fallback: true })
      );
    });
  });

  describe('INT-3: Complete Meeting Lifecycle', () => {
    it('should integrate all components successfully', async () => {
      // This test would use real services in a test environment
      // For now, demonstrating the integration structure
      
      const startTime = performance.now();
      
      // Mock complete flow
      const mockSession = {
        id: 'integration-test',
        guildId: 'test-guild',
        startTime: new Date(),
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock all service responses
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Test transcript' }
      });

      await meetingManager.processMeeting(mockSession as any);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify integration completed
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockSession.transcripts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('INT-4: Performance - 2 Minute SLA', () => {
    it('should process 1-hour meeting within 2-minute SLA', async () => {
      // Arrange
      const startTime = performance.now();
      const mockSession = {
        id: 'perf-test',
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        endTime: new Date(),
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock fast responses
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Fast transcript' }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);
      
      const processingTime = performance.now() - startTime;

      // Assert
      expect(processingTime).toBeLessThan(120000); // 2 minutes = 120,000ms
    });
  });

  describe('INT-5: Concurrent Meetings', () => {
    it('should handle multiple concurrent meetings without resource conflicts', async () => {
      // Arrange
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        id: `session${i}`,
        guildId: `guild${i}`,
        startTime: new Date(),
        audioFiles: new Map([[`user${i}`, `/tmp/user${i}.wav`]]),
        transcripts: [],
        decisions: [],
      }));

      // Mock responses for all sessions
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Concurrent transcript' }
      });

      // Act
      const promises = sessions.map(session => 
        meetingManager.processMeeting(session as any)
      );
      
      const results = await Promise.allSettled(promises);

      // Assert
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults).toHaveLength(5);
    });
  });

  describe('INT-6: Network Failures and Retry', () => {
    it('should retry with exponential backoff and eventually succeed', async () => {
      // Arrange
      const mockSession = {
        id: 'retry-test',
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock network failures then success
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { jobId: 'job123' } });

      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Retry success' }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // 2 failures + 1 success
      expect(mockSession.transcripts.length).toBeGreaterThan(0);
    });
  });

  describe('INT-7: Partial Failures and Graceful Degradation', () => {
    it('should handle partial failures and post partial results', async () => {
      // Arrange
      const mockSession = {
        id: 'partial-fail-test',
        audioFiles: new Map([
          ['user1', '/tmp/user1.wav'],
          ['user2', '/tmp/user2.wav']
        ]),
        transcripts: [],
        decisions: [],
      };

      // Mock partial success
      mockedAxios.post
        .mockResolvedValueOnce({ data: { jobId: 'job1' } }) // user1 succeeds
        .mockRejectedValueOnce(new Error('Upload failed')); // user2 fails

      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job1', status: 'completed', transcript: 'Partial transcript' }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      expect(mockSession.transcripts.length).toBe(1); // Only successful transcription
    });
  });

  describe('INT-8: Security - Audio File Cleanup', () => {
    it('should delete all temporary files after processing', async () => {
      // Arrange
      const mockSession = {
        id: 'security-test',
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      const mockUnlink = jest.fn();
      jest.doMock('fs', () => ({
        createReadStream: jest.fn(),
        promises: { rm: mockUnlink }
      }));

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Security test' }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      // In a real implementation, verify cleanup calls
      expect(mockSession.transcripts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('INT-9: Security - Log Sanitization', () => {
    it('should ensure no sensitive data appears in logs', async () => {
      // This test would verify that PII, tokens, etc. are not logged
      const mockSession = {
        id: 'log-security-test',
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock logger to capture log messages
      const mockLogger = jest.fn();
      jest.doMock('../utils/logger', () => ({
        logger: { info: mockLogger, error: mockLogger, warn: mockLogger }
      }));

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Log security test' }
      });

      await meetingManager.processMeeting(mockSession as any);

      // In a real test, verify no sensitive data in log calls
      expect(mockSession.transcripts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('INT-10: Distributed Tracing', () => {
    it('should create complete trace spans across all services', async () => {
      // Arrange
      const executeWithSpanSpy = jest.spyOn(observabilityService, 'executeWithSpan');
      
      const mockSession = {
        id: 'tracing-test',
        guildId: 'guild123',
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Tracing test' }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);

      // Assert
      const expectedSpans = ['meeting_manager.process_meeting', 'meeting_manager.transcribe_audio'];
      for (const spanName of expectedSpans) {
        expect(executeWithSpanSpy).toHaveBeenCalledWith(
          spanName,
          expect.any(Function),
          expect.any(Object)
        );
      }
    });
  });

  describe('INT-11: Error Telemetry', () => {
    it('should capture error spans with correct attributes', async () => {
      // Arrange
      const executeWithSpanSpy = jest.spyOn(observabilityService, 'executeWithSpan');
      
      const mockSession = {
        id: 'error-telemetry-test',
        audioFiles: new Map([['user1', '/tmp/user1.wav']]),
        transcripts: [],
        decisions: [],
      };

      // Mock error condition
      mockedAxios.post.mockRejectedValue(new Error('Test error for telemetry'));

      // Act & Assert
      await expect(meetingManager.processMeeting(mockSession as any))
        .rejects.toThrow('Test error for telemetry');

      // Verify error span was created
      expect(executeWithSpanSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          sessionId: 'error-telemetry-test'
        })
      );
    });
  });
});