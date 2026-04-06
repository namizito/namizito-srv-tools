import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface HttpExceptionResponse {
  message?: string | string[];
}

interface ErrorResolution {
  statusCode: number;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, message } = this.resolve(exception);

    this.logger.error(
      `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    reply.status(statusCode).send({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolve(exception: unknown): ErrorResolution {
    if (isAxiosError(exception)) {
      const apiName = this.extractApiName(exception.config?.url);
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: `External API error: ${apiName}`,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as HttpExceptionResponse).message
              ?.toString()
              ?.split(',')[0] ?? exception.message;

      return { statusCode: exception.getStatus(), message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private extractApiName(url?: string): string {
    if (!url) return 'unknown';
    if (url.includes('newsapi.org')) return 'NewsAPI';
    if (url.includes('googleapis.com')) return 'Google Calendar';
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
}
