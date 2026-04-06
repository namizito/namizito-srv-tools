import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CalendarService } from './calendar.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserContext } from '../common/dto/user-context.dto.js';
import { HEADERS } from '../common/constants/headers.js';

@Controller('calendar/events')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  listEvents(
    @CurrentUser() _user: UserContext,
    @Headers(HEADERS.GOOGLE_TOKEN) googleToken: string,
  ) {
    return this.calendarService.listEvents(googleToken);
  }

  @Post()
  createEvent(
    @CurrentUser() _user: UserContext,
    @Headers(HEADERS.GOOGLE_TOKEN) googleToken: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.calendarService.createEvent(googleToken, dto);
  }

  @Get(':id')
  getEvent(
    @CurrentUser() _user: UserContext,
    @Headers(HEADERS.GOOGLE_TOKEN) googleToken: string,
    @Param('id') eventId: string,
  ) {
    return this.calendarService.getEvent(googleToken, eventId);
  }
}
