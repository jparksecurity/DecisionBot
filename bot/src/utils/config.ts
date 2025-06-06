import dotenv from 'dotenv';
import { Config } from '../models/types';

dotenv.config();

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export const config: Config = {
  discord: {
    token: getRequiredEnv('DISCORD_BOT_TOKEN'),
    clientId: getRequiredEnv('DISCORD_CLIENT_ID'),
    guildId: getRequiredEnv('DISCORD_GUILD_ID'),
    decisionsChannelId: getRequiredEnv('DECISIONS_CHANNEL_ID'),
    logsChannelId: getRequiredEnv('LOGS_CHANNEL_ID'),
  },
  services: {
    byteniteUrl: process.env.BYTENITE_SERVICE_URL || 'http://localhost:8000',
    gmiApiKey: getRequiredEnv('GMI_CLOUD_API_KEY'),
    gmiBaseUrl: process.env.GMI_CLOUD_BASE_URL || 'https://api.gmi.cloud',
  },
  observability: {
    langtraceApiKey: getRequiredEnv('LANGTRACE_API_KEY'),
    langtraceEndpoint: process.env.LANGTRACE_ENDPOINT || 'https://cloud.langtrace.ai',
  },
};