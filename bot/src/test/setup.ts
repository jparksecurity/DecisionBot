import { jest } from '@jest/globals';

// Mock Discord.js before any imports
jest.mock('discord.js', () => ({
  Client: jest.fn(),
  GatewayIntentBits: {
    Guilds: 1,
    GuildVoiceStates: 2,
    GuildMessages: 4,
    DirectMessages: 8,
    MessageContent: 16,
  },
  Partials: {
    Channel: 'channel',
    Message: 'message',
  },
  EmbedBuilder: jest.fn(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
}));

// Mock @discordjs/voice
jest.mock('@discordjs/voice', () => ({
  joinVoiceChannel: jest.fn(),
  VoiceConnectionStatus: {
    Ready: 'ready',
    Disconnected: 'disconnected',
  },
  getVoiceConnection: jest.fn(),
  EndBehaviorType: {
    AfterSilence: 'afterSilence',
  },
}));

// Mock prism-media
jest.mock('prism-media', () => ({
  OpusEncoder: jest.fn(),
}));

// Mock external HTTP calls
jest.mock('axios');
jest.mock('node-fetch');

// Mock file system operations where needed
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn(),
  createReadStream: jest.fn(),
}));

// Setup fake timers by default
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});