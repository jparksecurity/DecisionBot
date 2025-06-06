import { MeetingSession, MeetingStatus } from '../models/types';
import { ByteNiteAdapter } from './byteniteAdapter';
import { DecisionExtractor } from './decisionExtractor';
import { ConfirmationService } from './confirmationService';
import { Publisher } from './publisher';
import { RecorderService } from './recorder';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';

export class MeetingManager {
  private byteniteAdapter: ByteNiteAdapter;
  private decisionExtractor: DecisionExtractor;
  private confirmationService: ConfirmationService;
  private publisher: Publisher;

  constructor(
    byteniteAdapter: ByteNiteAdapter,
    decisionExtractor: DecisionExtractor,
    confirmationService: ConfirmationService,
    publisher: Publisher
  ) {
    this.byteniteAdapter = byteniteAdapter;
    this.decisionExtractor = decisionExtractor;
    this.confirmationService = confirmationService;
    this.publisher = publisher;
  }

  async processMeeting(session: MeetingSession): Promise<void> {
    const traceId = observabilityService.createMeetingTraceId(session.guildId, session.startTime.getTime());
    
    return observabilityService.executeWithSpan(
      'meeting_manager.process_meeting',
      async () => {
        try {
          logger.info(`Processing meeting ${session.id}`, {
            participantCount: session.allParticipants.size,
            audioFileCount: session.audioFiles.size
          });

          // Step 1: Transcribe audio files
          session.status = MeetingStatus.PROCESSING;
          await this.transcribeAudio(session);

          // Step 2: Extract decisions
          await this.extractDecisions(session);

          // Step 3: Confirm decisions with participants
          session.status = MeetingStatus.CONFIRMING;
          const confirmedDecisions = await this.confirmationService.confirmDecisions(session);

          // Step 4: Publish results
          session.status = MeetingStatus.PUBLISHING;
          await this.publisher.publishDecisions(session, confirmedDecisions);

          // Step 5: Cleanup
          await this.cleanupMeeting(session);

          session.status = MeetingStatus.COMPLETED;
          logger.info(`Meeting ${session.id} processed successfully`, {
            confirmedDecisions: confirmedDecisions.length,
            totalDecisions: session.decisions.length
          });

        } catch (error) {
          session.status = MeetingStatus.FAILED;
          logger.error(`Failed to process meeting ${session.id}`, error);
          
          // Publish error and cleanup
          await this.publisher.publishError(session.id, error as Error);
          await this.cleanupMeeting(session);
          
          throw error;
        }
      },
      { 
        sessionId: session.id,
        traceId,
        meetingId: session.id,
        guildId: session.guildId 
      }
    );
  }

  private async transcribeAudio(session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'meeting_manager.transcribe_audio',
      async () => {
        if (session.audioFiles.size === 0) {
          logger.warn(`No audio files found for session ${session.id}`);
          return;
        }

        try {
          // Try ByteNite service first
          session.transcripts = await this.byteniteAdapter.transcribeAudioFiles(session.audioFiles);
          
          logger.info(`Transcription completed for session ${session.id}`, {
            transcriptCount: session.transcripts.length
          });

        } catch (error) {
          logger.warn(`ByteNite transcription failed for session ${session.id}, using fallback`, error);
          
          // Fallback to local processing
          session.transcripts = await this.byteniteAdapter.generateFallbackTranscript(session.audioFiles);
        }
      },
      { 
        sessionId: session.id,
        audioFileCount: session.audioFiles.size 
      }
    );
  }

  private async extractDecisions(session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'meeting_manager.extract_decisions',
      async () => {
        if (session.transcripts.length === 0) {
          logger.warn(`No transcripts available for decision extraction in session ${session.id}`);
          return;
        }

        session.decisions = await this.decisionExtractor.extractDecisions(session.transcripts);
        
        logger.info(`Decision extraction completed for session ${session.id}`, {
          decisionCount: session.decisions.length
        });
      },
      { 
        sessionId: session.id,
        transcriptCount: session.transcripts.length 
      }
    );
  }

  private async cleanupMeeting(session: MeetingSession): Promise<void> {
    return observabilityService.executeWithSpan(
      'meeting_manager.cleanup',
      async () => {
        // The RecorderService cleanup is handled by VoiceManager
        // This is for any additional cleanup needed
        
        logger.info(`Cleanup completed for session ${session.id}`);
      },
      { sessionId: session.id }
    );
  }
}