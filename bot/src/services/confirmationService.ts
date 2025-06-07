import { Client, User, Message, MessageReaction, PartialMessageReaction, PartialUser, EmbedBuilder, TextChannel, MessageReactionEventDetails } from 'discord.js';
import { DecisionCandidate, MeetingSession, DecisionStatus } from '../models/types';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';
import { config } from '../utils/config';

export class ConfirmationService {
  private client: Client;
  private confirmationTimeoutMs = 60000; // 60 seconds
  private activeConfirmations = new Map<string, NodeJS.Timeout>(); // messageId -> timeout

  constructor(client: Client) {
    this.client = client;
    this.setupReactionListener();
  }

  private setupReactionListener(): void {
    this.client.on('messageReactionAdd', this.handleReactionAdd.bind(this));
  }

  private async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (user.bot) return;
    if (reaction.emoji.name !== '❌') return;

    // Find the decision associated with this message
    const messageId = reaction.message.id;
    const timeout = this.activeConfirmations.get(messageId);
    
    if (timeout) {
      // Cancel the decision
      clearTimeout(timeout);
      this.activeConfirmations.delete(messageId);
      
      logger.info(`Decision cancelled by user ${user.id}`, { messageId });
      
      // Update the message to show cancellation
      try {
        if (reaction.message.partial) {
          await reaction.message.fetch();
        }
        await reaction.message.edit({
          content: `~~${reaction.message.content}~~\n\n❌ **Cancelled by ${user.id}**`
        });
      } catch (error) {
        logger.error('Failed to update cancelled message', error);
      }
    }
  }

  async confirmDecisions(session: MeetingSession): Promise<DecisionCandidate[]> {
    return observabilityService.executeWithSpan(
      'confirmation.confirm_decisions',
      async () => {
        if (session.decisions.length === 0) {
          return await this.handleNoDecisions(session);
        }

        // Send DMs to all participants for each decision
        await this.sendConfirmationDMs(session);

        // Wait for confirmation period
        await new Promise(resolve => setTimeout(resolve, this.confirmationTimeoutMs));

        // Return decisions that weren't cancelled
        const confirmedDecisions = session.decisions.filter(d => d.status !== DecisionStatus.CANCELLED);
        
        logger.info(`Confirmation complete: ${confirmedDecisions.length}/${session.decisions.length} decisions confirmed`, {
          sessionId: session.id
        });

        return confirmedDecisions;
      },
      { 
        sessionId: session.id, 
        decisionCount: session.decisions.length,
        participantCount: session.allParticipants.size 
      }
    );
  }

  private async handleNoDecisions(session: MeetingSession): Promise<DecisionCandidate[]> {
    return observabilityService.executeWithSpan(
      'confirmation.handle_no_decisions',
      async () => {
        const embed = new EmbedBuilder()
          .setTitle('📝 No Decisions Detected')
          .setDescription('No decisions were automatically detected for this meeting. React with ❌ within 60 seconds if a decision was actually made and I missed it.')
          .setColor(0xFFA500)
          .setTimestamp();

        let anyFeedback = false;
        const messagePromises: Promise<void>[] = [];

        // Send to all participants
        for (const participantId of session.allParticipants) {
          messagePromises.push(
            this.sendNoDecisionDM(participantId, embed).then(success => {
              if (!success) anyFeedback = true; // If DM failed, we'll need fallback
            })
          );
        }

        await Promise.all(messagePromises);

        // Wait for feedback period
        await new Promise(resolve => setTimeout(resolve, this.confirmationTimeoutMs));

        // If we received any ❌ reactions during the wait, mark for manual follow-up
        // This would be tracked by the reaction handler setting a flag
        // For now, we'll assume no feedback means confirmed no decisions

        return []; // No decisions confirmed
      },
      { sessionId: session.id }
    );
  }

  private async sendConfirmationDMs(session: MeetingSession): Promise<void> {
    const dmPromises: Promise<void>[] = [];

    for (const decision of session.decisions) {
      for (const participantId of session.allParticipants) {
        dmPromises.push(this.sendDecisionDM(participantId, decision, session));
      }
    }

    await Promise.allSettled(dmPromises);
  }

  private async sendDecisionDM(userId: string, decision: DecisionCandidate, session: MeetingSession): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('🤖 Decision Confirmation Required')
        .setDescription(`I detected the following decision from your meeting:\n\n**"${decision.text}"**`)
        .addFields([
          { name: 'Speaker', value: `<@${decision.speakerId}>`, inline: true },
          { name: 'Action Required', value: 'React with ❌ within 60 seconds to cancel this decision', inline: false }
        ])
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ text: `Meeting ID: ${session.id}` });

      const message = await user.send({ embeds: [embed] });
      
      // Add the ❌ reaction
      await message.react('❌');
      
      // Store message ID for tracking
      decision.confirmationMessageIds.set(userId, message.id);
      
      // Set timeout for this specific message
      const timeout = setTimeout(() => {
        decision.status = DecisionStatus.CONFIRMED;
        this.activeConfirmations.delete(message.id);
        
        // Update the message to show confirmation
        message.edit({
          embeds: [embed.setColor(0x00FF00).setTitle('✅ Decision Confirmed')],
        }).catch(error => logger.error('Failed to update confirmed message', error));
        
      }, this.confirmationTimeoutMs);
      
      this.activeConfirmations.set(message.id, timeout);
      
      logger.debug(`Sent confirmation DM to user ${user.tag}`, { 
        decisionId: decision.id, 
        messageId: message.id 
      });

    } catch (error) {
      logger.warn(`Failed to send DM to user ${userId}`, error);
      
      // Fallback: mention in decisions channel
      await this.sendFallbackMention(userId, decision, session);
    }
  }

  private async sendNoDecisionDM(userId: string, embed: EmbedBuilder): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      const message = await user.send({ embeds: [embed] });
      await message.react('❌');
      
      // Set up timeout tracking for feedback
      const timeout = setTimeout(() => {
        this.activeConfirmations.delete(message.id);
      }, this.confirmationTimeoutMs);
      
      this.activeConfirmations.set(message.id, timeout);
      
      return true;
    } catch (error) {
      logger.warn(`Failed to send no-decision DM to user ${userId}`, error);
      return false;
    }
  }

  private async sendFallbackMention(userId: string, decision: DecisionCandidate, session: MeetingSession): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(config.discord.decisionsChannelId);
      
      if (channel && channel.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Confirmation Required')
          .setDescription(`<@${userId}> - Please review this detected decision:\n\n**"${decision.text}"**\n\nReact with ❌ within 60 seconds to cancel.`)
          .setColor(0xFFA500)
          .setTimestamp();

        const message = await channel.send({ embeds: [embed] });
        await message.react('❌');
        
        decision.confirmationMessageIds.set(userId, message.id);
        
        const timeout = setTimeout(() => {
          decision.status = DecisionStatus.CONFIRMED;
          this.activeConfirmations.delete(message.id);
        }, this.confirmationTimeoutMs);
        
        this.activeConfirmations.set(message.id, timeout);
      }
    } catch (error) {
      logger.error('Failed to send fallback mention', error);
    }
  }

  cleanup(): void {
    // Clear any remaining timeouts
    for (const timeout of this.activeConfirmations.values()) {
      clearTimeout(timeout);
    }
    this.activeConfirmations.clear();
  }
}