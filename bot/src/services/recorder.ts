import { 
  VoiceConnection, 
  VoiceReceiver,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@discordjs/voice';
import { OpusEncoder } from 'prism-media';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';

export class RecorderService {
  private recordings = new Map<string, fs.WriteStream>(); // userId -> WriteStream
  private meetingDir: string;

  constructor(meetingId: string) {
    this.meetingDir = path.join('/tmp/meet', meetingId);
    this.ensureMeetingDirectory();
  }

  private ensureMeetingDirectory(): void {
    if (!fs.existsSync(this.meetingDir)) {
      fs.mkdirSync(this.meetingDir, { recursive: true });
    }
  }

  async startRecording(connection: VoiceConnection, userId: string): Promise<void> {
    return observabilityService.executeWithSpan(
      'recorder.start_recording',
      async () => {
        const receiver = connection.receiver;
        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        });

        const outputPath = path.join(this.meetingDir, `${userId}.wav`);
        const writeStream = fs.createWriteStream(outputPath);
        
        // Store the stream for later cleanup
        this.recordings.set(userId, writeStream);

        // Convert Opus to 48kHz 16-bit WAV
        const opusDecoder = new OpusEncoder({ 
          rate: 48000, 
          channels: 2, 
          frameSize: 960 
        });

        try {
          await pipeline(
            audioStream,
            opusDecoder,
            writeStream
          );
          
          logger.info(`Recording started for user ${userId}`, { 
            outputPath,
            meetingDir: this.meetingDir 
          });
        } catch (error) {
          logger.error(`Failed to start recording for user ${userId}`, error);
          this.stopRecording(userId);
          throw error;
        }
      },
      { userId, meetingDir: this.meetingDir }
    );
  }

  stopRecording(userId: string): void {
    const stream = this.recordings.get(userId);
    if (stream) {
      stream.end();
      this.recordings.delete(userId);
      logger.info(`Recording stopped for user ${userId}`);
    }
  }

  stopAllRecordings(): void {
    for (const [userId, stream] of this.recordings) {
      stream.end();
      logger.info(`Recording stopped for user ${userId}`);
    }
    this.recordings.clear();
  }

  getAudioFilePath(userId: string): string {
    return path.join(this.meetingDir, `${userId}.wav`);
  }

  getAllAudioFiles(): Map<string, string> {
    const files = new Map<string, string>();
    if (fs.existsSync(this.meetingDir)) {
      const dirContents = fs.readdirSync(this.meetingDir);
      for (const filename of dirContents) {
        if (filename.endsWith('.wav')) {
          const userId = filename.replace('.wav', '');
          files.set(userId, path.join(this.meetingDir, filename));
        }
      }
    }
    return files;
  }

  async cleanup(): Promise<void> {
    return observabilityService.executeWithSpan(
      'recorder.cleanup',
      async () => {
        this.stopAllRecordings();
        
        if (fs.existsSync(this.meetingDir)) {
          await fs.promises.rm(this.meetingDir, { recursive: true, force: true });
          logger.info(`Cleaned up meeting directory: ${this.meetingDir}`);
        }
      },
      { meetingDir: this.meetingDir }
    );
  }
}