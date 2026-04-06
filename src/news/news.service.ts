import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { NewsQueryDto } from './dto/news-query.dto.js';
import { ArticleDto, NewsResponseDto } from './dto/news-response.dto.js';
import { NewsApiResponse } from './types/newsapi.types.js';

@Injectable()
export class NewsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('NEWSAPI_BASE_URL');
    this.apiKey = this.config.getOrThrow<string>('NEWSAPI_KEY');
  }

  async searchNews(query: NewsQueryDto): Promise<NewsResponseDto> {
    const topic = query.topic ?? '';
    const lang = query.lang ?? 'pt';
    const page = query.page ?? 1;

    return this.withCache(`news:search:${topic}:${lang}:${page}`, async () => {
      const { data } = await firstValueFrom(
        this.http.get<NewsApiResponse>(`${this.baseUrl}/everything`, {
          params: { q: topic, language: lang, page, apiKey: this.apiKey },
        }),
      );
      return this.mapResponse(data, page);
    });
  }

  async getTopHeadlines(query: NewsQueryDto): Promise<NewsResponseDto> {
    const lang = query.lang ?? 'pt';
    const category = query.category ?? '';

    return this.withCache(`news:top:${category}:${lang}`, async () => {
      const { data } = await firstValueFrom(
        this.http.get<NewsApiResponse>(`${this.baseUrl}/top-headlines`, {
          params: { category, language: lang, apiKey: this.apiKey },
        }),
      );
      return this.mapResponse(data, 1);
    });
  }

  private async withCache<T>(key: string, fetch: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;
    const result = await fetch();
    await this.cache.set(key, result);
    return result;
  }

  private mapResponse(data: NewsApiResponse, page: number): NewsResponseDto {
    return {
      total: data.totalResults,
      page,
      articles: data.articles.map((a): ArticleDto => ({
        title: a.title,
        description: a.description,
        url: a.url,
        publishedAt: a.publishedAt,
        source: a.source?.name ?? '',
      })),
    };
  }
}
