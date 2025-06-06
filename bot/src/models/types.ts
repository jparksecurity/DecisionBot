export interface MeetingSession {
  id: string;
  guildId: string;
  channelId: string;
  startTime: Date;
  endTime?: Date;
  allParticipants: Set<string>;
  audioFiles: Map<string, string>; // userId -> filePath
  transcripts: TranscriptResult[];
  decisions: DecisionCandidate[];
  status: MeetingStatus;
}

export interface TranscriptResult {
  userId: string;
  transcript: string;
  startTime: number;
  endTime: number;
}

export interface DecisionCandidate {
  id: string;
  text: string;
  speakerId: string;
  status: DecisionStatus;
  confirmationMessageIds: Map<string, string>; // userId -> messageId
}

export interface ByteNiteJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  transcript?: string;
  error?: string;
}

export interface GMIDecisionResponse {
  decisions: Array<{
    text: string;
    speakerId: string;
    confidence: number;
  }>;
}

export enum MeetingStatus {
  RECORDING = 'recording',
  PROCESSING = 'processing',
  CONFIRMING = 'confirming',
  PUBLISHING = 'publishing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum DecisionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  PUBLISHED = 'published'
}

export interface Config {
  discord: {
    token: string;
    clientId: string;
    guildId: string;
    decisionsChannelId: string;
    logsChannelId: string;
  };
  services: {
    byteniteUrl: string;
    gmiApiKey: string;
    gmiBaseUrl: string;
  };
  observability: {
    langtraceApiKey: string;
    langtraceEndpoint: string;
  };
}