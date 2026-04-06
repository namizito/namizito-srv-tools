import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NewsController } from './news.controller.js';
import { NewsService } from './news.service.js';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
