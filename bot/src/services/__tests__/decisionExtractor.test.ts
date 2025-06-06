import { DecisionExtractor } from '../decisionExtractor';
import { TranscriptResult } from '../../models/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../../utils/config', () => ({
  config: {
    services: {
      gmiBaseUrl: 'https://api.gmi.test',
      gmiApiKey: 'test-key',
    },
  },
}));

// Mock observability
jest.mock('../observability', () => ({
  observabilityService: {
    executeWithSpan: jest.fn((name, fn) => fn()),
  },
}));

describe('DecisionExtractor', () => {
  let extractor: DecisionExtractor;
  
  beforeEach(() => {
    extractor = new DecisionExtractor();
    jest.clearAllMocks();
  });

  describe('extractDecisions', () => {
    const mockTranscripts: TranscriptResult[] = [
      {
        userId: 'user1',
        transcript: 'I think we should ship API v2 on June 20th',
        startTime: 0,
        endTime: 10,
      },
      {
        userId: 'user2',
        transcript: 'Let me agree with that decision',
        startTime: 10,
        endTime: 15,
      },
    ];

    it('should extract decisions from GMI API successfully', async () => {
      // DE-1: callGMI() returns two decisions
      const mockResponse = {
        data: {
          decisions: [
            { text: 'Ship API v2 on June 20th', speakerId: 'user1', confidence: 0.9 },
            { text: 'Upgrade to Node 20', speakerId: 'user2', confidence: 0.8 },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const decisions = await extractor.extractDecisions(mockTranscripts);

      expect(decisions).toHaveLength(2);
      expect(decisions[0].text).toBe('Ship API v2 on June 20th');
      expect(decisions[0].speakerId).toBe('user1');
      expect(decisions[0].status).toBe('pending');
      expect(decisions[1].text).toBe('Upgrade to Node 20');
      expect(decisions[1].speakerId).toBe('user2');
    });

    it('should handle empty response from GMI API', async () => {
      // DE-2: emptyResponse() sets noDecision==true
      const mockResponse = {
        data: {
          decisions: [],
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const decisions = await extractor.extractDecisions(mockTranscripts);

      expect(decisions).toHaveLength(0);
    });

    it('should fallback to regex when GMI API fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const transcriptsWithDecision: TranscriptResult[] = [
        {
          userId: 'user1',
          transcript: 'We decided to adopt Dark Mode by Q3 for better UX',
          startTime: 0,
          endTime: 10,
        },
      ];

      const decisions = await extractor.extractDecisions(transcriptsWithDecision);

      // Should find decision through regex fallback
      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].text).toContain('adopt Dark Mode by Q3');
    });

    it('should retry GMI API calls with exponential backoff', async () => {
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            decisions: [{ text: 'Test decision', speakerId: 'user1', confidence: 0.9 }],
          },
        });

      const decisions = await extractor.extractDecisions(mockTranscripts);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(decisions).toHaveLength(1);
    });
  });

  describe('regex fallback', () => {
    it('should extract decisions using regex patterns', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API down'));

      const transcripts: TranscriptResult[] = [
        {
          userId: 'user1',
          transcript: 'We should implement the new authentication system next sprint',
          startTime: 0,
          endTime: 10,
        },
        {
          userId: 'user2',
          transcript: 'Let\'s ship the feature by Friday',
          startTime: 10,
          endTime: 15,
        },
      ];

      const decisions = await extractor.extractDecisions(transcripts);

      expect(decisions.length).toBeGreaterThan(0);
      const decisionTexts = decisions.map(d => d.text);
      expect(decisionTexts.some(text => text.includes('implement'))).toBe(true);
    });

    it('should filter out generic phrases', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API down'));

      const transcripts: TranscriptResult[] = [
        {
          userId: 'user1',
          transcript: 'We should do something about this issue',
          startTime: 0,
          endTime: 10,
        },
      ];

      const decisions = await extractor.extractDecisions(transcripts);

      // Should not extract generic "we should do" phrase
      expect(decisions).toHaveLength(0);
    });

    it('should deduplicate similar decisions', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API down'));

      const transcripts: TranscriptResult[] = [
        {
          userId: 'user1',
          transcript: 'We should implement the new feature next week',
          startTime: 0,
          endTime: 10,
        },
        {
          userId: 'user2',
          transcript: 'Let\'s implement the new feature next week',
          startTime: 10,
          endTime: 15,
        },
      ];

      const decisions = await extractor.extractDecisions(transcripts);

      // Should only have one decision due to deduplication
      expect(decisions).toHaveLength(1);
    });
  });
});