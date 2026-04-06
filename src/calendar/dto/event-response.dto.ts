export class EventResponseDto {
  id: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  attendees: string[];
  htmlLink: string;
  status: string;
}
