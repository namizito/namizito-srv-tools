export interface NewsApiSource {
  name: string;
}

export interface NewsApiArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: NewsApiSource;
}

export interface NewsApiResponse {
  totalResults: number;
  articles: NewsApiArticle[];
}
