export class ArticleDto {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

export class NewsResponseDto {
  total: number;
  page: number;
  articles: ArticleDto[];
}
