import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { DecisionCandidate, MeetingSession, DecisionStatus } from '../models/types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { observabilityService } from './observability';

export class Publisher {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async publishDecisions(session: MeetingSession, confirmedDecisions: DecisionCandidate[]): Promise<void> {
    return observabilityService.executeWithSpan(
      'publisher.publish_decisions',
      async () => {
        const channel = await this.getDecisionsChannel();
        
        if (confirmedDecisions.length === 0) {
          await this.publishNoDecisions(channel, session);
        } else {
          await this.publishConfirmedDecisions(channel, session, confirmedDecisions);
        }

        // Publish cancellation notices for any cancelled decisions
        const cancelledDecisions = session.decisions.filter(d => d.status === DecisionStatus.CANCELLED);
        if (cancelledDecisions.length > 0) {
          await this.publishCancellationNotices(channel, session, cancelledDecisions);
        }

        logger.info(`Published ${confirmedDecisions.length} decisions and ${cancelledDecisions.length} cancellation notices`, {
          sessionId: session.id
        });
      },
      { 
        sessionId: session.id, 
        confirmedCount: confirmedDecisions.length,
        cancelledCount: session.decisions.filter(d => d.status === DecisionStatus.CANCELLED).length
      }
    );
  }

  private async getDecisionsChannel(): Promise<TextChannel> {
    const channel = await this.client.channels.fetch(config.discord.decisionsChannelId);
    
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Decisions channel ${config.discord.decisionsChannelId} not found or not a text channel`);
    }
    
    return channel as TextChannel;
  }

  private async publishNoDecisions(channel: TextChannel, session: MeetingSession): Promise<void> {
    const participantMentions = Array.from(session.allParticipants)
      .map(id => `<@${id}>`)
      .join(', ');

    const embed = new EmbedBuilder()
      .setTitle('📝 Meeting Summary')
      .setDescription('No decisions detected (confirmed by participants)')
      .addFields([
        { name: 'Participants', value: participantMentions, inline: false },
        { name: 'Duration', value: this.formatDuration(session), inline: true },
        { name: 'Date', value: session.startTime.toLocaleDateString(), inline: true },
        { name: 'Time', value: session.startTime.toLocaleTimeString(), inline: true }
      ])
      .setColor(0x6C757D) // Gray color for no decisions
      .setTimestamp()
      .setFooter({ text: `Meeting ID: ${session.id}` });

    await channel.send({ embeds: [embed] });
  }

  private async publishConfirmedDecisions(
    channel: TextChannel, 
    session: MeetingSession, 
    decisions: DecisionCandidate[]
  ): Promise<void> {
    const participantMentions = Array.from(session.allParticipants)
      .map(id => `<@${id}>`)
      .join(', ');

    const embed = new EmbedBuilder()
      .setTitle('✅ Meeting Decisions')
      .setDescription(`${decisions.length} decision${decisions.length === 1 ? '' : 's'} confirmed from your meeting:`)
      .addFields([
        { name: 'Participants', value: participantMentions, inline: false },
        { name: 'Duration', value: this.formatDuration(session), inline: true },
        { name: 'Date', value: session.startTime.toLocaleDateString(), inline: true },
        { name: 'Time', value: session.startTime.toLocaleTimeString(), inline: true }
      ])
      .setColor(0x00AE86) // Green color for confirmed decisions
      .setTimestamp()
      .setFooter({ text: `Meeting ID: ${session.id}` });

    // Add each decision as a field
    decisions.forEach((decision, index) => {
      const speakerMention = `<@${decision.speakerId}>`;
      embed.addFields([{
        name: `Decision ${index + 1}`,
        value: `**"${decision.text}"**\n*Proposed by: ${speakerMention}*`,
        inline: false
      }]);
    });

    await channel.send({ embeds: [embed] });

    // Mark decisions as published
    decisions.forEach(decision => {
      decision.status = DecisionStatus.PUBLISHED;
    });
  }

  private async publishCancellationNotices(
    channel: TextChannel,
    session: MeetingSession,
    cancelledDecisions: DecisionCandidate[]
  ): Promise<void> {
    for (const decision of cancelledDecisions) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Decision Cancelled')
        .setDescription(`The following decision was cancelled by a participant:`)
        .addFields([
          { 
            name: 'Cancelled Decision', 
            value: `**"${decision.text}"**\n*Originally proposed by: <@${decision.speakerId}>*`, 
            inline: false 
          }
        ])
        .setColor(0xDC3545) // Red color for cancelled decisions
        .setTimestamp()
        .setFooter({ text: `Meeting ID: ${session.id}` });

      await channel.send({ embeds: [embed] });
    }
  }

  async publishError(sessionId: string, error: Error): Promise<void> {
    return observabilityService.executeWithSpan(
      'publisher.publish_error',
      async () => {
        try {
          const logsChannel = await this.client.channels.fetch(config.discord.logsChannelId);
          
          if (logsChannel && logsChannel.isTextBased() && 'send' in logsChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🚨 DecisionBot Error')
              .setDescription(`An error occurred while processing meeting ${sessionId}`)
              .addFields([
                { name: 'Error', value: error.message, inline: false },
                { name: 'Session ID', value: sessionId, inline: true },
                { name: 'Timestamp', value: new Date().toISOString(), inline: true }
              ])
              .setColor(0xDC3545)
              .setTimestamp();

            await logsChannel.send({ embeds: [embed] });
          }
        } catch (publishError) {
          logger.error('Failed to publish error to logs channel', publishError);
        }
      },
      { sessionId, errorMessage: error.message }
    );
  }

  async publishManualFollowupRequest(sessionId: string, participants: Set<string>): Promise<void> {
    return observabilityService.executeWithSpan(
      'publisher.publish_manual_followup',
      async () => {
        const channel = await this.getDecisionsChannel();
        
        const participantMentions = Array.from(participants)
          .map(id => `<@${id}>`)
          .join(', ');

        const embed = new EmbedBuilder()
          .setTitle('🔍 Manual Review Requested')
          .setDescription('A participant indicated that decisions were made but not automatically detected.')
          .addFields([
            { name: 'Participants', value: participantMentions, inline: false },
            { name: 'Action Required', value: 'Please manually review the meeting and add any missed decisions', inline: false }
          ])
          .setColor(0xFFA500) // Orange color for manual review
          .setTimestamp()
          .setFooter({ text: `Meeting ID: ${sessionId}` });

        await channel.send({ embeds: [embed] });
      },
      { sessionId }
    );
  }

  private formatDuration(session: MeetingSession): string {
    if (!session.endTime) return 'Ongoing';
    
    const durationMs = session.endTime.getTime() - session.startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}