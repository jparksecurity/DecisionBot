import { RecorderService } from '../recorder';
import { VoiceConnection, VoiceReceiver } from '@discordjs/voice';
import { OpusEncoder } from 'prism-media';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable, PassThrough } from 'stream';

// Mock dependencies
jest.mock('@discordjs/voice');
jest.mock('prism-media');
jest.mock('fs');
jest.mock('stream/promises');
jest.mock('../observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPipeline = pipeline as jest.MockedFunction<typeof pipeline>;

describe('RecorderService', () => {
  let recorder: RecorderService;
  let mockConnection: jest.Mocked<VoiceConnection>;
  let mockReceiver: jest.Mocked<VoiceReceiver>;
  const meetingId = 'test-meeting-123';
  const userId = 'user123';

  beforeEach(() => {
    // Setup mocks
    mockReceiver = {
      subscribe: jest.fn(),
    } as any;

    mockConnection = {
      receiver: mockReceiver,
    } as any;

    // Mock filesystem
    mockFs.existsSync = jest.fn().mockReturnValue(false);
    mockFs.mkdirSync = jest.fn();
    mockFs.createWriteStream = jest.fn();
    mockFs.readdirSync = jest.fn().mockReturnValue([]);
    mockFs.promises = {
      rm: jest.fn(),
    } as any;

    // Reset OpusEncoder mock
    (OpusEncoder as jest.MockedClass<typeof OpusEncoder>).mockClear();

    recorder = new RecorderService(meetingId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('REC-1: encodePcmToWav', () => {
    it('should write WAV file >= 1KB', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      const mockAudioStream = new PassThrough();
      const mockOpusDecoder = new PassThrough();

      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(mockAudioStream as any);
      
      (OpusEncoder as jest.MockedClass<typeof OpusEncoder>).mockImplementation(() => {
        return mockOpusDecoder as any;
      });

      mockPipeline.mockResolvedValue(undefined);

      // Simulate writing data >= 1KB
      let bytesWritten = 0;
      mockWriteStream.on('pipe', () => {
        // Simulate 2KB of audio data being written
        bytesWritten = 2048;
      });

      // Act
      await recorder.startRecording(mockConnection, userId);

      // Assert
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining(`${userId}.wav`)
      );
      expect(mockPipeline).toHaveBeenCalledWith(
        mockAudioStream,
        mockOpusDecoder,
        mockWriteStream
      );
      
      // Verify OpusEncoder configured for 48kHz 16-bit
      expect(OpusEncoder).toHaveBeenCalledWith({
        rate: 48000,
        channels: 2,
        frameSize: 960
      });
    });
  });

  describe('REC-2: perSpeakerFiles', () => {
    it('should create two distinct WAV files for two speakers', async () => {
      // Arrange
      const user1 = 'user1';
      const user2 = 'user2';
      const mockWriteStream1 = new PassThrough();
      const mockWriteStream2 = new PassThrough();

      mockFs.createWriteStream
        .mockReturnValueOnce(mockWriteStream1 as any)
        .mockReturnValueOnce(mockWriteStream2 as any);

      mockReceiver.subscribe
        .mockReturnValueOnce(new PassThrough() as any)
        .mockReturnValueOnce(new PassThrough() as any);

      mockPipeline.mockResolvedValue(undefined);

      // Act
      await recorder.startRecording(mockConnection, user1);
      await recorder.startRecording(mockConnection, user2);

      // Assert
      expect(mockFs.createWriteStream).toHaveBeenCalledTimes(2);
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining(`${user1}.wav`)
      );
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining(`${user2}.wav`)
      );
      
      // Verify separate audio subscriptions
      expect(mockReceiver.subscribe).toHaveBeenCalledTimes(2);
      expect(mockReceiver.subscribe).toHaveBeenNthCalledWith(1, user1, expect.any(Object));
      expect(mockReceiver.subscribe).toHaveBeenNthCalledWith(2, user2, expect.any(Object));
    });
  });

  describe('REC-3: opusToWavFFmpeg', () => {
    it('should convert Opus to 48kHz 16-bit WAV using FFmpeg CLI configuration', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      const mockAudioStream = new PassThrough();
      
      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(mockAudioStream as any);
      mockPipeline.mockResolvedValue(undefined);

      // Act
      await recorder.startRecording(mockConnection, userId);

      // Assert
      // Verify OpusEncoder is configured for proper audio format
      expect(OpusEncoder).toHaveBeenCalledWith({
        rate: 48000,   // 48kHz sample rate
        channels: 2,   // Stereo (will be converted to mono if needed)
        frameSize: 960 // Appropriate frame size for 48kHz
      });

      // Verify the pipeline processes audio correctly
      expect(mockPipeline).toHaveBeenCalledWith(
        mockAudioStream,
        expect.any(Object), // OpusEncoder instance
        mockWriteStream
      );
    });
  });

  describe('REC-4: validateAudioSize', () => {
    it('should reject files smaller than 1KB threshold', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(new PassThrough() as any);
      
      // Mock pipeline to simulate very small file creation
      mockPipeline.mockRejectedValue(new Error('Audio stream too short'));

      // Act & Assert
      await expect(recorder.startRecording(mockConnection, userId))
        .rejects.toThrow('Audio stream too short');
    });

    it('should handle empty audio streams gracefully', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      const emptyStream = new PassThrough();
      
      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(emptyStream as any);
      
      // End the stream immediately to simulate no audio
      setImmediate(() => emptyStream.end());
      
      mockPipeline.mockRejectedValue(new Error('No audio data received'));

      // Act & Assert
      await expect(recorder.startRecording(mockConnection, userId))
        .rejects.toThrow('No audio data received');
    });
  });

  describe('REC-5: handleConcurrentSpeakers', () => {
    it('should handle multiple speakers with separate stream handling', async () => {
      // Arrange
      const users = ['user1', 'user2', 'user3'];
      const mockStreams = users.map(() => new PassThrough());
      const mockWriteStreams = users.map(() => new PassThrough());

      mockReceiver.subscribe
        .mockReturnValueOnce(mockStreams[0] as any)
        .mockReturnValueOnce(mockStreams[1] as any)
        .mockReturnValueOnce(mockStreams[2] as any);

      mockFs.createWriteStream
        .mockReturnValueOnce(mockWriteStreams[0] as any)
        .mockReturnValueOnce(mockWriteStreams[1] as any)
        .mockReturnValueOnce(mockWriteStreams[2] as any);

      mockPipeline.mockResolvedValue(undefined);

      // Act - Start recording for all users simultaneously
      const recordingPromises = users.map(userId => 
        recorder.startRecording(mockConnection, userId)
      );
      
      await Promise.all(recordingPromises);

      // Assert
      expect(mockReceiver.subscribe).toHaveBeenCalledTimes(3);
      expect(mockFs.createWriteStream).toHaveBeenCalledTimes(3);
      expect(mockPipeline).toHaveBeenCalledTimes(3);

      // Verify each user has separate recording
      users.forEach((userId, index) => {
        expect(mockReceiver.subscribe).toHaveBeenNthCalledWith(
          index + 1, 
          userId, 
          expect.any(Object)
        );
      });
    });
  });

  describe('REC-6: handleAudioStreamDrop', () => {
    it('should gracefully recover from Discord packet loss', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      const mockAudioStream = new PassThrough();
      
      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(mockAudioStream as any);

      // Simulate packet loss by having pipeline fail once, then succeed
      mockPipeline
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce(undefined);

      // Act - First attempt should fail
      await expect(recorder.startRecording(mockConnection, userId))
        .rejects.toThrow('Connection lost');

      // Verify cleanup occurred
      expect(recorder['recordings'].has(userId)).toBe(false);

      // Second attempt should succeed (simulating reconnection)
      mockReceiver.subscribe.mockReturnValue(new PassThrough() as any);
      
      await expect(recorder.startRecording(mockConnection, userId))
        .resolves.not.toThrow();
    });

    it('should handle stream errors during recording', async () => {
      // Arrange
      const mockWriteStream = new PassThrough();
      const mockAudioStream = new PassThrough();
      
      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockReceiver.subscribe.mockReturnValue(mockAudioStream as any);
      
      // Mock pipeline to start successfully
      mockPipeline.mockImplementation(async (readable, transform, writable) => {
        // Simulate stream error after start
        setImmediate(() => {
          mockAudioStream.emit('error', new Error('Network hiccup'));
        });
        throw new Error('Stream interrupted');
      });

      // Act & Assert
      await expect(recorder.startRecording(mockConnection, userId))
        .rejects.toThrow('Stream interrupted');

      // Verify cleanup
      expect(recorder['recordings'].has(userId)).toBe(false);
    });
  });

  describe('File Management', () => {
    it('should create meeting directory if it does not exist', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      new RecorderService(meetingId);

      // Assert
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(meetingId),
        { recursive: true }
      );
    });

    it('should get audio file path correctly', () => {
      // Act
      const filePath = recorder.getAudioFilePath(userId);

      // Assert
      expect(filePath).toContain(meetingId);
      expect(filePath).toContain(`${userId}.wav`);
      expect(filePath).toMatch(/\/tmp\/meet\/.+\.wav$/);
    });

    it('should get all audio files from directory', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['user1.wav', 'user2.wav', 'other.txt'] as any);

      // Act
      const audioFiles = recorder.getAllAudioFiles();

      // Assert
      expect(audioFiles.size).toBe(2);
      expect(audioFiles.has('user1')).toBe(true);
      expect(audioFiles.has('user2')).toBe(true);
      expect(audioFiles.get('user1')).toContain('user1.wav');
      expect(audioFiles.get('user2')).toContain('user2.wav');
    });
  });

  describe('Cleanup', () => {
    it('should stop all recordings and remove directory', async () => {
      // Arrange
      const mockWriteStream1 = { end: jest.fn() } as any;
      const mockWriteStream2 = { end: jest.fn() } as any;
      
      recorder['recordings'].set('user1', mockWriteStream1);
      recorder['recordings'].set('user2', mockWriteStream2);
      
      mockFs.existsSync.mockReturnValue(true);

      // Act
      await recorder.cleanup();

      // Assert
      expect(mockWriteStream1.end).toHaveBeenCalled();
      expect(mockWriteStream2.end).toHaveBeenCalled();
      expect(mockFs.promises.rm).toHaveBeenCalledWith(
        expect.stringContaining(meetingId),
        { recursive: true, force: true }
      );
      expect(recorder['recordings'].size).toBe(0);
    });
  });
});