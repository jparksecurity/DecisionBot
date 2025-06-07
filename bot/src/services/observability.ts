import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

class ObservabilityService {
  private tracer = trace.getTracer('decision-bot');
  private sdk?: NodeSDK;

  initialize(): void {
    try {
      const traceExporter = new OTLPTraceExporter({
        url: `${config.observability.langtraceEndpoint}/v1/traces`,
        headers: {
          'Authorization': `Bearer ${config.observability.langtraceApiKey}`,
        },
      });

      this.sdk = new NodeSDK({
        traceExporter,
        instrumentations: [],
      });

      this.sdk.start();
      logger.info('Observability service initialized');
    } catch (error) {
      logger.error('Failed to initialize observability service', error);
    }
  }

  async executeWithSpan<T>(
    spanName: string,
    operation: () => Promise<T> | T,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    return this.tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, async (span) => {
      try {
        // Add custom attributes
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttributes({ [key]: value });
        });

        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  createMeetingTraceId(guildId: string, startTs: number): string {
    return `meeting:${guildId}:${startTs}`;
  }

  shutdown(): void {
    this.sdk?.shutdown();
  }
}

export const observabilityService = new ObservabilityService();