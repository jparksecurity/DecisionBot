import axios, { AxiosResponse } from 'axios';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';
import { TranscriptResult, DecisionCandidate, GMIDecisionResponse, DecisionStatus } from '../models/types';

export class DecisionExtractor {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries = 3;

  constructor() {
    this.baseUrl = config.services.gmiBaseUrl;
    this.apiKey = config.services.gmiApiKey;
  }

  async extractDecisions(transcripts: TranscriptResult[]): Promise<DecisionCandidate[]> {
    return observabilityService.executeWithSpan(
      'decision_extractor.extract_decisions',
      async () => {
        // First try GMI Cloud API
        try {
          return await this.callGMIAPI(transcripts);
        } catch (error) {
          logger.error('GMI Cloud API failed, falling back to regex', error);
          return await this.regexFallback(transcripts);
        }
      },
      { transcriptCount: transcripts.length }
    );
  }

  private async callGMIAPI(transcripts: TranscriptResult[]): Promise<DecisionCandidate[]> {
    return observabilityService.executeWithSpan(
      'decision_extractor.call_gmi_api',
      async () => {
        const combinedTranscript = this.combineTranscripts(transcripts);
        
        let lastError: Error | undefined;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const response: AxiosResponse<GMIDecisionResponse> = await axios.post(
              `${this.baseUrl}/decision-extractor-v1`,
              {
                transcript: combinedTranscript,
                extractionMode: 'meeting_decisions',
                includeConfidence: true,
              },
              {
                headers: {
                  'Authorization': `Bearer ${this.apiKey}`,
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              }
            );

            const decisions = response.data.decisions || [];
            
            logger.info(`GMI extracted ${decisions.length} decisions`, { attempt });
            
            return decisions.map((decision, index) => ({
              id: `decision-${Date.now()}-${index}`,
              text: decision.text,
              speakerId: decision.speakerId,
              status: DecisionStatus.PENDING,
              confirmationMessageIds: new Map(),
            }));

          } catch (error) {
            lastError = error as Error;
            logger.warn(`GMI API attempt ${attempt} failed`, error);
            
            if (attempt < this.maxRetries) {
              const backoffMs = Math.pow(2, attempt - 1) * 1000;
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }

        throw new Error(`GMI API failed after ${this.maxRetries} attempts: ${lastError?.message}`);
      },
      {}
    );
  }

  private async regexFallback(transcripts: TranscriptResult[]): Promise<DecisionCandidate[]> {
    return observabilityService.executeWithSpan(
      'decision_extractor.regex_fallback',
      () => {
        const combinedTranscript = this.combineTranscripts(transcripts);
        const decisions: DecisionCandidate[] = [];

        // Regex patterns for common decision phrases
        const decisionPatterns = [
          /(?:let's|we'll|we will|we should|we need to|decided to|going to|plan to)\s+([^.!?]+)/gi,
          /(?:decision|decide|agreed|agree)\s+(?:to|that|on)\s+([^.!?]+)/gi,
          /(?:ship|release|deploy|launch)\s+([^.!?]+?)(?:\s+(?:by|on|in)\s+[\w\s]+)?/gi,
          /(?:adopt|use|implement|switch to|move to)\s+([^.!?]+)/gi,
          /(?:cancel|postpone|delay|skip)\s+([^.!?]+)/gi,
        ];

        let decisionIndex = 0;
        
        for (const pattern of decisionPatterns) {
          let match;
          while ((match = pattern.exec(combinedTranscript)) !== null) {
            const decisionText = match[0].trim();
            
            // Skip very short or generic matches
            if (decisionText.length < 10 || this.isGenericPhrase(decisionText)) {
              continue;
            }

            // Try to determine speaker (simplified approach)
            const speakerId = this.determineSpeaker(transcripts, match.index);

            decisions.push({
              id: `fallback-decision-${Date.now()}-${decisionIndex++}`,
              text: decisionText,
              speakerId: speakerId || 'unknown',
              status: DecisionStatus.PENDING,
              confirmationMessageIds: new Map(),
            });
          }
        }

        logger.info(`Regex fallback extracted ${decisions.length} potential decisions`);
        
        // Remove duplicates based on similar text
        return this.deduplicateDecisions(decisions);
      },
      {}
    );
  }

  private combineTranscripts(transcripts: TranscriptResult[]): string {
    // Sort by start time and combine
    const sorted = transcripts.sort((a, b) => a.startTime - b.startTime);
    return sorted.map(t => `[${t.userId}]: ${t.transcript}`).join('\n');
  }

  private determineSpeaker(transcripts: TranscriptResult[], matchIndex: number): string | null {
    // Simple approach: find which transcript section this match likely belongs to
    // In a real implementation, this would be more sophisticated
    let currentPos = 0;
    
    for (const transcript of transcripts) {
      const sectionEnd = currentPos + transcript.transcript.length;
      if (matchIndex >= currentPos && matchIndex <= sectionEnd) {
        return transcript.userId;
      }
      currentPos = sectionEnd + 1; // +1 for newline
    }
    
    return null;
  }

  private isGenericPhrase(text: string): boolean {
    const genericPhrases = [
      'we should do',
      'we need to',
      'let\'s go',
      'going to be',
      'decided to go',
      'agree with',
    ];
    
    const lowerText = text.toLowerCase();
    return genericPhrases.some(phrase => lowerText.includes(phrase));
  }

  private deduplicateDecisions(decisions: DecisionCandidate[]): DecisionCandidate[] {
    const unique: DecisionCandidate[] = [];
    
    for (const decision of decisions) {
      const isDuplicate = unique.some(existing => 
        this.calculateSimilarity(existing.text, decision.text) > 0.8
      );
      
      if (!isDuplicate) {
        unique.push(decision);
      }
    }
    
    return unique;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity based on words
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}