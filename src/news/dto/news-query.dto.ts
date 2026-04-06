import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NewsQueryDto {
  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  lang?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsString()
  @IsOptional()
  category?: string;
}
