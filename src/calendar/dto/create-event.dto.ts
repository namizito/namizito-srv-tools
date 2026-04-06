import { IsArray, IsEmail, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  summary: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsISO8601()
  startDateTime: string;

  @IsISO8601()
  endDateTime: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  attendees?: string[];
}
