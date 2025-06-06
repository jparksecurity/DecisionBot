import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as FormData from 'form-data';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';
import { ByteNiteJobResponse, TranscriptResult } from '../models/types';

export class ByteNiteAdapter {
  private baseUrl: string;
  private maxRetries = 3;
  private pollIntervalMs = 10000; // 10 seconds
  private maxPollAttempts = 30; // 5 minutes total

  constructor() {
    this.baseUrl = config.services.byteniteUrl;
  }

  async transcribeAudioFiles(audioFiles: Map<string, string>): Promise<TranscriptResult[]> {
    return observabilityService.executeWithSpan(
      'bytenite.transcribe_audio_files',
      async () => {
        const results: TranscriptResult[] = [];
        const uploadPromises: Promise<{ userId: string; jobId: string }>[] = [];

        // Upload all files in parallel
        for (const [userId, filePath] of audioFiles) {
          uploadPromises.push(this.uploadFile(userId, filePath));
        }

        const uploads = await Promise.all(uploadPromises);
        const jobIds = new Map(uploads.map(u => [u.userId, u.jobId]));

        // Poll for completion of all jobs
        const transcriptPromises: Promise<TranscriptResult>[] = [];
        for (const [userId, jobId] of jobIds) {
          transcriptPromises.push(this.pollForTranscript(userId, jobId));
        }

        const transcripts = await Promise.all(transcriptPromises);
        results.push(...transcripts);

        return results;
      },
      { fileCount: audioFiles.size }
    );
  }

  private async uploadFile(userId: string, filePath: string): Promise<{ userId: string; jobId: string }> {
    return observabilityService.executeWithSpan(
      'bytenite.upload_file',
      async () => {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('userId', userId);

        let lastError: Error | undefined;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const response: AxiosResponse<{ jobId: string }> = await axios.post(
              `${this.baseUrl}/transcribe`,
              formData,
              {
                headers: {
                  ...formData.getHeaders(),
                },
                timeout: 30000, // 30 second timeout
              }
            );

            logger.info(`File uploaded successfully for user ${userId}`, {
              jobId: response.data.jobId,
              attempt
            });

            return { userId, jobId: response.data.jobId };
          } catch (error) {
            lastError = error as Error;
            logger.warn(`Upload attempt ${attempt} failed for user ${userId}`, error);
            
            if (attempt < this.maxRetries) {
              const backoffMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }

        throw new Error(`Failed to upload file for user ${userId} after ${this.maxRetries} attempts: ${lastError?.message}`);
      },
      { userId, filePath }
    );
  }

  private async pollForTranscript(userId: string, jobId: string): Promise<TranscriptResult> {
    return observabilityService.executeWithSpan(
      'bytenite.poll_for_transcript',
      async () => {
        for (let attempt = 1; attempt <= this.maxPollAttempts; attempt++) {
          try {
            const response: AxiosResponse<ByteNiteJobResponse> = await axios.get(
              `${this.baseUrl}/job/${jobId}/status`,
              { timeout: 10000 }
            );

            const job = response.data;

            if (job.status === 'completed' && job.transcript) {
              logger.info(`Transcription completed for user ${userId}`, { jobId, attempt });
              
              return {
                userId,
                transcript: job.transcript,
                startTime: 0, // Will be set by caller if needed
                endTime: 0,   // Will be set by caller if needed
              };
            } else if (job.status === 'failed') {
              throw new Error(`Transcription failed for user ${userId}: ${job.error}`);
            }

            // Still processing, wait and retry
            logger.debug(`Transcription still processing for user ${userId}`, { 
              jobId, 
              status: job.status, 
              attempt 
            });

            if (attempt < this.maxPollAttempts) {
              await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
            }
          } catch (error) {
            if (attempt === this.maxPollAttempts) {
              throw new Error(`Failed to get transcription for user ${userId} after ${this.maxPollAttempts} attempts: ${(error as Error).message}`);
            }
            
            logger.warn(`Poll attempt ${attempt} failed for user ${userId}`, error);
            await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
          }
        }

        throw new Error(`Transcription polling timed out for user ${userId} after ${this.maxPollAttempts} attempts`);
      },
      { userId, jobId }
    );
  }

  async generateFallbackTranscript(audioFiles: Map<string, string>): Promise<TranscriptResult[]> {
    return observabilityService.executeWithSpan(
      'bytenite.fallback_transcript',
      async () => {
        logger.warn('Using fallback regex-based transcript generation');
        
        const results: TranscriptResult[] = [];
        
        // Simple fallback: create placeholder transcripts that can be processed by regex
        // In a real implementation, this might use local Whisper or other fallback
        for (const [userId, filePath] of audioFiles) {
          const stats = await fs.promises.stat(filePath);
          const durationEstimate = Math.max(stats.size / 32000, 10); // Rough estimate
          
          results.push({
            userId,
            transcript: `[Audio content from ${userId} - fallback mode]`,
            startTime: 0,
            endTime: durationEstimate,
          });
        }

        return results;
      },
      { fileCount: audioFiles.size }
    );
  }
}