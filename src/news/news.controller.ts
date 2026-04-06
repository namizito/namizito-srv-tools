import { Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './news.service.js';
import { NewsQueryDto } from './dto/news-query.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserContext } from '../common/dto/user-context.dto.js';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  searchNews(@Query() query: NewsQueryDto, @CurrentUser() _user: UserContext) {
    return this.newsService.searchNews(query);
  }

  @Get('top')
  getTopHeadlines(@Query() query: NewsQueryDto, @CurrentUser() _user: UserContext) {
    return this.newsService.getTopHeadlines(query);
  }
}
