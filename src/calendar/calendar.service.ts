import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventResponseDto } from './dto/event-response.dto.js';

type CalendarClient = ReturnType<typeof google.calendar>;

interface GoogleApiError {
  response?: { status?: number };
}

@Injectable()
export class CalendarService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    this.clientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    this.redirectUri = config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
  }

  private getCalendarClient(googleRefreshToken: string): CalendarClient {
    const auth = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    auth.setCredentials({ refresh_token: googleRefreshToken });
    return google.calendar({ version: 'v3', auth });
  }

  async listEvents(googleRefreshToken: string): Promise<EventResponseDto[]> {
    const calendar = this.getCalendarClient(googleRefreshToken);
    try {
      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 20,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return (data.items ?? []).map((e) => this.mapEvent(e));
    } catch (err) {
      this.handleGoogleError(err);
    }
  }

  async createEvent(googleRefreshToken: string, dto: CreateEventDto): Promise<EventResponseDto> {
    const calendar = this.getCalendarClient(googleRefreshToken);
    try {
      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: dto.summary,
          description: dto.description,
          location: dto.location,
          start: { dateTime: dto.startDateTime },
          end: { dateTime: dto.endDateTime },
          attendees: dto.attendees?.map((email) => ({ email })),
        },
      });
      return this.mapEvent(data);
    } catch (err) {
      this.handleGoogleError(err);
    }
  }

  async getEvent(googleRefreshToken: string, eventId: string): Promise<EventResponseDto> {
    const calendar = this.getCalendarClient(googleRefreshToken);
    try {
      const { data } = await calendar.events.get({ calendarId: 'primary', eventId });
      return this.mapEvent(data);
    } catch (err) {
      this.handleGoogleError(err);
    }
  }

  private mapEvent(e: calendar_v3.Schema$Event): EventResponseDto {
    return {
      id: e.id ?? '',
      summary: e.summary ?? '',
      description: e.description ?? undefined,
      startDateTime: e.start?.dateTime ?? e.start?.date ?? '',
      endDateTime: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location ?? undefined,
      attendees: (e.attendees ?? []).map((a) => a.email ?? '').filter(Boolean),
      htmlLink: e.htmlLink ?? '',
      status: e.status ?? '',
    };
  }

  private handleGoogleError(err: unknown): never {
    const status = (err as GoogleApiError).response?.status;
    if (status === 401) throw new UnauthorizedException('Google token invalid or expired');
    if (status === 404) throw new NotFoundException('Event not found');
    throw err;
  }
}
