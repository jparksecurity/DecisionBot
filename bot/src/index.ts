import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { observabilityService } from './services/observability';
import { VoiceManager } from './services/voiceManager';
import { MeetingManager } from './services/meetingManager';
import { ByteNiteAdapter } from './services/byteniteAdapter';
import { DecisionExtractor } from './services/decisionExtractor';
import { ConfirmationService } from './services/confirmationService';
import { Publisher } from './services/publisher';

class DecisionBot {
  private client: Client;
  private voiceManager?: VoiceManager;
  private meetingManager?: MeetingManager;
  private confirmationService?: ConfirmationService;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', this.onReady.bind(this));
    this.client.on('error', this.onError.bind(this));
    this.client.on('warn', (warning) => logger.warn('Discord client warning', { warning }));
    
    // Handle graceful shutdown
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
  }

  private async onReady(): Promise<void> {
    if (!this.client.user) return;

    logger.info(`Bot logged in as ${this.client.user.tag}`, {
      userId: this.client.user.id,
      guildCount: this.client.guilds.cache.size
    });

    // Initialize services
    await this.initializeServices();

    // Set bot status
    this.client.user.setActivity('for voice channel activity', { type: 2 }); // LISTENING
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize observability
      observabilityService.initialize();

      // Initialize service dependencies
      const byteniteAdapter = new ByteNiteAdapter();
      const decisionExtractor = new DecisionExtractor();
      this.confirmationService = new ConfirmationService(this.client);
      const publisher = new Publisher(this.client);

      // Initialize main services
      this.meetingManager = new MeetingManager(
        byteniteAdapter,
        decisionExtractor,
        this.confirmationService,
        publisher
      );

      this.voiceManager = new VoiceManager(this.client, this.meetingManager);

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services', error);
      throw error;
    }
  }

  private onError(error: Error): void {
    logger.error('Discord client error', error);
  }

  async start(): Promise<void> {
    try {
      await this.client.login(config.discord.token);
    } catch (error) {
      logger.error('Failed to start bot', error);
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down DecisionBot...');

    try {
      // Cleanup services
      if (this.confirmationService) {
        this.confirmationService.cleanup();
      }

      // Destroy Discord client
      this.client.destroy();

      // Shutdown observability
      observabilityService.shutdown();

      logger.info('DecisionBot shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Start the bot
const bot = new DecisionBot();

bot.start().catch((error) => {
  logger.error('Failed to start DecisionBot', error);
  process.exit(1);
});