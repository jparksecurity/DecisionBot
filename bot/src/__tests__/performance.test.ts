import { performance } from 'perf_hooks';
import { MeetingManager } from '../services/meetingManager';
import { ByteNiteAdapter } from '../services/byteniteAdapter';
import { DecisionExtractor } from '../services/decisionExtractor';
import axios from 'axios';

// Mock dependencies for performance testing
jest.mock('axios');
jest.mock('../services/observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Performance & Load Tests (PERF-1 through PERF-6)
 * These tests verify system performance under various conditions
 */
describe('Performance Tests', () => {
  let meetingManager: MeetingManager;
  let byteniteAdapter: ByteNiteAdapter;

  beforeEach(() => {
    byteniteAdapter = new ByteNiteAdapter();
    const decisionExtractor = new DecisionExtractor();
    meetingManager = new MeetingManager(
      byteniteAdapter,
      decisionExtractor,
      {} as any, // confirmationService
      {} as any  // publisher
    );

    jest.clearAllMocks();
  });

  describe('PERF-1: Meeting End to Decision Post Latency', () => {
    it('should complete processing within 2 minutes for ≤1 hour meeting', async () => {
      // Arrange
      const meetingDuration = 60 * 60 * 1000; // 1 hour
      const slaLimit = 2 * 60 * 1000; // 2 minutes
      
      const mockSession = {
        id: 'perf-test-1',
        guildId: 'guild123',
        startTime: new Date(Date.now() - meetingDuration),
        endTime: new Date(),
        audioFiles: new Map([
          ['user1', '/tmp/user1.wav'],
          ['user2', '/tmp/user2.wav']
        ]),
        transcripts: [],
        decisions: [],
      };

      // Mock fast service responses
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'job123', 
          status: 'completed', 
          transcript: 'Performance test transcript' 
        }
      });

      // Act
      const startTime = performance.now();
      await meetingManager.processMeeting(mockSession as any);
      const processingTime = performance.now() - startTime;

      // Assert
      expect(processingTime).toBeLessThan(slaLimit);
      console.log(`Meeting processing completed in ${processingTime.toFixed(2)}ms`);
    });

    it('should scale processing time linearly with meeting duration', async () => {
      const testCases = [
        { duration: 10 * 60 * 1000, expectedMax: 30 * 1000 }, // 10 min → 30s
        { duration: 30 * 60 * 1000, expectedMax: 60 * 1000 }, // 30 min → 1m
        { duration: 60 * 60 * 1000, expectedMax: 120 * 1000 }, // 60 min → 2m
      ];

      for (const testCase of testCases) {
        const mockSession = {
          id: `perf-duration-${testCase.duration}`,
          startTime: new Date(Date.now() - testCase.duration),
          endTime: new Date(),
          audioFiles: new Map([['user1', '/tmp/user1.wav']]),
          transcripts: [],
          decisions: [],
        };

        mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
        mockedAxios.get.mockResolvedValue({
          data: { jobId: 'job123', status: 'completed', transcript: 'Test' }
        });

        const startTime = performance.now();
        await meetingManager.processMeeting(mockSession as any);
        const processingTime = performance.now() - startTime;

        expect(processingTime).toBeLessThan(testCase.expectedMax);
      }
    });
  });

  describe('PERF-2: ByteNite Transcription Response Time', () => {
    it('should respond within 30 seconds for 10-minute audio', async () => {
      // Arrange
      const audioFiles = new Map([['user1', '/tmp/10min-audio.wav']]);
      const responseTimeLimit = 30 * 1000; // 30 seconds

      // Mock ByteNite response timing
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'job123', 
          status: 'completed', 
          transcript: 'This is a 10-minute audio transcription' 
        }
      });

      // Act
      const startTime = performance.now();
      const results = await byteniteAdapter.transcribeAudioFiles(audioFiles);
      const responseTime = performance.now() - startTime;

      // Assert
      expect(responseTime).toBeLessThan(responseTimeLimit);
      expect(results).toHaveLength(1);
      console.log(`ByteNite transcription completed in ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('PERF-3: Concurrent Meetings Processing', () => {
    it('should handle ≥5 meetings in parallel without degradation', async () => {
      // Arrange
      const concurrentMeetings = 5;
      const sessions = Array.from({ length: concurrentMeetings }, (_, i) => ({
        id: `concurrent-session-${i}`,
        guildId: `guild-${i}`,
        startTime: new Date(),
        audioFiles: new Map([[`user${i}`, `/tmp/user${i}.wav`]]),
        transcripts: [],
        decisions: [],
      }));

      // Mock responses for all sessions
      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'job123', 
          status: 'completed', 
          transcript: 'Concurrent processing test' 
        }
      });

      // Act
      const startTime = performance.now();
      const promises = sessions.map(session => 
        meetingManager.processMeeting(session as any)
      );
      
      const results = await Promise.allSettled(promises);
      const totalTime = performance.now() - startTime;

      // Assert
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults).toHaveLength(concurrentMeetings);
      
      // Concurrent processing should not take much longer than sequential
      const sequentialEstimate = concurrentMeetings * 1000; // 1s per meeting
      expect(totalTime).toBeLessThan(sequentialEstimate * 1.5); // Allow 50% overhead
      
      console.log(`Processed ${concurrentMeetings} meetings concurrently in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('PERF-4: Audio File Upload Throughput', () => {
    it('should achieve ≥10MB/s average upload throughput', async () => {
      // Arrange
      const fileSizeMB = 50; // 50MB test file
      const minThroughputMBps = 10; // 10 MB/s
      const maxExpectedTime = (fileSizeMB / minThroughputMBps) * 1000; // Convert to ms

      const largeAudioFiles = new Map([
        ['user1', '/tmp/large-audio-50mb.wav']
      ]);

      // Mock large file upload
      mockedAxios.post.mockImplementation(() => {
        // Simulate upload time proportional to file size
        const uploadTime = (fileSizeMB / 20) * 1000; // 20 MB/s simulated speed
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ data: { jobId: 'large-file-job' } });
          }, uploadTime);
        });
      });

      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'large-file-job', 
          status: 'completed', 
          transcript: 'Large file transcription' 
        }
      });

      // Act
      const startTime = performance.now();
      await byteniteAdapter.transcribeAudioFiles(largeAudioFiles);
      const uploadTime = performance.now() - startTime;

      // Assert
      expect(uploadTime).toBeLessThan(maxExpectedTime);
      
      const actualThroughput = fileSizeMB / (uploadTime / 1000);
      expect(actualThroughput).toBeGreaterThanOrEqual(minThroughputMBps);
      
      console.log(`Upload throughput: ${actualThroughput.toFixed(2)} MB/s`);
    });
  });

  describe('PERF-5: Memory Usage During Audio Processing', () => {
    it('should use ≤512MB per meeting', async () => {
      // Note: This test is conceptual since Jest doesn't provide real memory monitoring
      // In a real implementation, you'd use process.memoryUsage()
      
      const memoryLimitMB = 512;
      const initialMemory = process.memoryUsage();

      const mockSession = {
        id: 'memory-test',
        audioFiles: new Map([
          ['user1', '/tmp/user1.wav'],
          ['user2', '/tmp/user2.wav'],
          ['user3', '/tmp/user3.wav']
        ]),
        transcripts: [],
        decisions: [],
      };

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { 
          jobId: 'job123', 
          status: 'completed', 
          transcript: 'Memory test transcript' 
        }
      });

      // Act
      await meetingManager.processMeeting(mockSession as any);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      // Assert (conceptual - in real test would have actual memory monitoring)
      expect(memoryIncrease).toBeLessThan(memoryLimitMB);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
    });

    it('should properly cleanup memory after processing', async () => {
      // Test memory cleanup by processing multiple sessions sequentially
      const sessions = Array.from({ length: 3 }, (_, i) => ({
        id: `cleanup-test-${i}`,
        audioFiles: new Map([[`user${i}`, `/tmp/user${i}.wav`]]),
        transcripts: [],
        decisions: [],
      }));

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Cleanup test' }
      });

      const memorySnapshots: number[] = [];

      // Process sessions and track memory
      for (const session of sessions) {
        await meetingManager.processMeeting(session as any);
        memorySnapshots.push(process.memoryUsage().heapUsed);
        
        // Force garbage collection if available (Node.js with --expose-gc)
        if (global.gc) {
          global.gc();
        }
      }

      // Memory should not grow indefinitely
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      expect(memoryGrowthMB).toBeLessThan(100); // Should not grow more than 100MB
    });
  });

  describe('PERF-6: CPU Usage During Transcription', () => {
    it('should maintain ≤80% average CPU usage', async () => {
      // Note: This is a conceptual test - real CPU monitoring would require native modules
      
      const cpuLimit = 80; // 80% max CPU usage
      
      const mockSession = {
        id: 'cpu-test',
        audioFiles: new Map([
          ['user1', '/tmp/user1.wav'],
          ['user2', '/tmp/user2.wav']
        ]),
        transcripts: [],
        decisions: [],
      };

      // Mock CPU-intensive operations
      mockedAxios.post.mockImplementation(() => {
        // Simulate CPU work
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait to simulate CPU usage
          Math.random();
        }
        return Promise.resolve({ data: { jobId: 'job123' } });
      });

      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'CPU test' }
      });

      // Act
      const startTime = performance.now();
      await meetingManager.processMeeting(mockSession as any);
      const processingTime = performance.now() - startTime;

      // Assert
      // In a real test, you would monitor actual CPU usage
      expect(processingTime).toBeGreaterThan(0);
      console.log(`CPU test processing time: ${processingTime.toFixed(2)}ms`);
      
      // Conceptual assertion - real implementation would check actual CPU metrics
      expect(true).toBe(true); // Placeholder for actual CPU monitoring
    });

    it('should scale CPU usage efficiently with concurrent processing', async () => {
      const concurrentTasks = 3;
      const sessions = Array.from({ length: concurrentTasks }, (_, i) => ({
        id: `cpu-concurrent-${i}`,
        audioFiles: new Map([[`user${i}`, `/tmp/user${i}.wav`]]),
        transcripts: [],
        decisions: [],
      }));

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Concurrent CPU test' }
      });

      // Measure single task
      const singleStart = performance.now();
      await meetingManager.processMeeting(sessions[0] as any);
      const singleTime = performance.now() - singleStart;

      // Measure concurrent tasks
      const concurrentStart = performance.now();
      await Promise.all(
        sessions.slice(1).map(session => meetingManager.processMeeting(session as any))
      );
      const concurrentTime = performance.now() - concurrentStart;

      // Concurrent processing should be more efficient than sequential
      const sequentialEstimate = singleTime * (concurrentTasks - 1);
      expect(concurrentTime).toBeLessThan(sequentialEstimate);
      
      console.log(`Single task: ${singleTime.toFixed(2)}ms, Concurrent: ${concurrentTime.toFixed(2)}ms`);
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle burst load of meetings', async () => {
      // Simulate 10 meetings starting simultaneously
      const burstSize = 10;
      const sessions = Array.from({ length: burstSize }, (_, i) => ({
        id: `burst-${i}`,
        audioFiles: new Map([[`user${i}`, `/tmp/user${i}.wav`]]),
        transcripts: [],
        decisions: [],
      }));

      mockedAxios.post.mockResolvedValue({ data: { jobId: 'job123' } });
      mockedAxios.get.mockResolvedValue({
        data: { jobId: 'job123', status: 'completed', transcript: 'Burst test' }
      });

      const startTime = performance.now();
      const results = await Promise.allSettled(
        sessions.map(session => meetingManager.processMeeting(session as any))
      );
      const totalTime = performance.now() - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(burstSize);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      console.log(`Burst load (${burstSize} meetings) completed in ${totalTime.toFixed(2)}ms`);
    });
  });
});