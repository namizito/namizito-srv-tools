# Tools Service — Implementation Plan (NestJS)

## Context

You have full context of this project's architecture. This is a microservices system where:
- The API Gateway validates JWT tokens via Auth Service before forwarding requests
- Requests arrive at internal services already authenticated, with headers:
  - `X-User-Id` (UUID)
  - `X-User-Email` (string)
  - `X-User-Role` (string)
- The Tools Service is called by the AI Agent Service to fetch external data
- No database — this service is stateless
- Exposes HTTP on port **10091**

The Tools Service integrates with two external APIs:
- **Google Calendar API** — OAuth2 per user, read/create events
- **NewsAPI** — API key based, search and top headlines

---

## Tech Stack

- **NestJS** with **Fastify** adapter
- **@nestjs/axios** for HTTP calls to external APIs
- **googleapis** for Google Calendar OAuth2
- **@nestjs/cache-manager** for news response caching
- **class-validator + class-transformer** for DTO validation
- **@nestjs/config** for environment variables
- **@nestjs/terminus** for health check

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
│
├── common/
│   ├── guards/
│   │   └── internal-request.guard.ts   # Checks X-User-Id header exists
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── timeout.interceptor.ts      # Global 10s timeout
│   ├── decorators/
│   │   └── current-user.decorator.ts   # Extracts X-User-* headers
│   └── dto/
│       └── user-context.dto.ts         # { userId, email, role }
│
├── calendar/
│   ├── calendar.module.ts
│   ├── calendar.controller.ts
│   ├── calendar.service.ts
│   └── dto/
│       ├── create-event.dto.ts
│       └── event-response.dto.ts
│
├── news/
│   ├── news.module.ts
│   ├── news.controller.ts
│   ├── news.service.ts
│   └── dto/
│       ├── news-query.dto.ts
│       └── news-response.dto.ts
│
└── health/
    └── health.controller.ts
```

---

## Environment Variables

Create `.env` and `.env.example`:

```env
PORT=10091

# Google Calendar OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# NewsAPI
NEWSAPI_KEY=
NEWSAPI_BASE_URL=https://newsapi.org/v2

# Auth Service base URL (to fetch user OAuth tokens if needed)
AUTH_SERVICE_URL=http://auth-service:8081

# Cache TTL in seconds (default: 10 minutes)
NEWS_CACHE_TTL=600
```

---

## Implementation — Step by Step

### Step 1 — Project Scaffold

- Init NestJS project with Fastify adapter (not Express)
- Install all dependencies:

```bash
npm i @nestjs/platform-fastify
npm i @nestjs/axios axios
npm i @nestjs/config class-validator class-transformer
npm i googleapis
npm i @nestjs/cache-manager cache-manager
npm i @nestjs/terminus
```

- Configure `main.ts`:
  - Use `FastifyAdapter`
  - Enable `ValidationPipe` globally with `whitelist: true` and `transform: true`
  - Listen on `0.0.0.0:10091`

- Configure `AppModule`:
  - `ConfigModule.forRoot({ isGlobal: true })`
  - `CacheModule.register({ isGlobal: true, ttl: NEWS_CACHE_TTL })`
  - `HttpModule` globally available

**Verify:** `npm run start:dev` boots on port 10091 with no errors.

---

### Step 2 — Common Layer

Implement in this order:

**`user-context.dto.ts`**
```ts
export class UserContext {
  userId: string;
  email: string;
  role: string;
}
```

**`current-user.decorator.ts`**
```ts
// Extracts X-User-Id, X-User-Email, X-User-Role from request headers
// Returns a UserContext object
export const CurrentUser = createParamDecorator(...)
```

**`internal-request.guard.ts`**
```ts
// Checks that X-User-Id header is present and non-empty
// Returns 401 if missing: { statusCode: 401, message: "Missing internal user context" }
@Injectable()
export class InternalRequestGuard implements CanActivate { ... }
```

**`logging.interceptor.ts`**
```ts
// Logs: [METHOD] /path → status in Xms
```

**`timeout.interceptor.ts`**
```ts
// Throws 408 if handler takes longer than 10 seconds
```

Apply `InternalRequestGuard`, `LoggingInterceptor`, and `TimeoutInterceptor` globally in `AppModule`.

**Verify:** Make a request without `X-User-Id` header → should receive 401.

---

### Step 3 — Health Endpoint

Create `HealthController`:

```
GET /health → { status: "ok", timestamp: ISO string }
```

- This endpoint must be **excluded from InternalRequestGuard** — the API Gateway calls it without user headers
- No auth required

**Verify:** `GET http://localhost:10091/health` returns 200.

---

### Step 4 — News Module

**`news-query.dto.ts`**
```ts
export class NewsQueryDto {
  @IsString() @IsOptional() topic?: string;
  @IsString() @IsOptional() lang?: string;       // default: 'pt'
  @IsNumber() @IsOptional() @Min(1) page?: number; // default: 1
  @IsString() @IsOptional() category?: string;    // for top headlines
}
```

**`news-response.dto.ts`**
```ts
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
```

**`news.service.ts`**
- Inject `HttpService` and `CacheManager`
- `searchNews(query: NewsQueryDto): Promise<NewsResponseDto>`
  - Cache key: `news:search:${topic}:${lang}:${page}`
  - Calls `GET ${NEWSAPI_BASE_URL}/everything?q=${topic}&language=${lang}&page=${page}&apiKey=${NEWSAPI_KEY}`
- `getTopHeadlines(query: NewsQueryDto): Promise<NewsResponseDto>`
  - Cache key: `news:top:${category}:${lang}`
  - Calls `GET ${NEWSAPI_BASE_URL}/top-headlines?category=${category}&language=${lang}&apiKey=${NEWSAPI_KEY}`
- Both methods check cache before calling NewsAPI
- Map raw NewsAPI response to `NewsResponseDto`

**`news.controller.ts`**
```
GET /news?topic=&lang=pt&page=1     → searchNews()
GET /news/top?category=tech&lang=pt → getTopHeadlines()
```

Both routes protected by `InternalRequestGuard` (already global).
Inject `@CurrentUser()` even if not used yet — keeps the pattern consistent.

**Verify:**
- `GET /news?topic=futebol` with `X-User-Id: test-uuid` → returns articles
- Same call twice within 10 min → second call does not hit NewsAPI (cache working)

---

### Step 5 — Calendar Module

**`create-event.dto.ts`**
```ts
export class CreateEventDto {
  @IsString() summary: string;
  @IsString() @IsOptional() description?: string;
  @IsISO8601() startDateTime: string;  // ISO 8601
  @IsISO8601() endDateTime: string;
  @IsString() @IsOptional() location?: string;
  @IsArray() @IsEmail({}, { each: true }) @IsOptional() attendees?: string[];
}
```

**`event-response.dto.ts`**
```ts
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
```

**`calendar.service.ts`**

Use `googleapis` OAuth2 client:

```ts
// getOAuth2Client(googleRefreshToken: string): OAuth2Client
//   - Creates google.auth.OAuth2 with client credentials
//   - Sets credentials: { refresh_token: googleRefreshToken }
//   - Returns client (googleapis auto-refreshes access token)

// listEvents(googleRefreshToken: string): Promise<EventResponseDto[]>
//   - Gets OAuth2Client
//   - Calls calendar.events.list({ calendarId: 'primary', timeMin: now, maxResults: 20, singleEvents: true, orderBy: 'startTime' })
//   - Maps to EventResponseDto[]

// createEvent(googleRefreshToken: string, dto: CreateEventDto): Promise<EventResponseDto>
//   - Gets OAuth2Client
//   - Calls calendar.events.insert({ calendarId: 'primary', requestBody: { ... } })
//   - Maps response to EventResponseDto

// getEvent(googleRefreshToken: string, eventId: string): Promise<EventResponseDto>
//   - Calls calendar.events.get({ calendarId: 'primary', eventId })
```

> **Important:** `googleRefreshToken` comes from the `X-User-Google-Token` header for now.
> In the future this will be fetched from Auth Service using `X-User-Id`.
> Design the service to accept it as a parameter so the source can change without refactoring.

**`calendar.controller.ts`**
```
GET  /calendar/events         → listEvents()
POST /calendar/events         → createEvent()
GET  /calendar/events/:id     → getEvent()
```

All routes use `@CurrentUser()` and extract `X-User-Google-Token` from headers for OAuth2.

**Error handling in CalendarService:**
- If Google returns 401 → throw `UnauthorizedException('Google token invalid or expired')`
- If Google returns 404 → throw `NotFoundException('Event not found')`
- Wrap all Google API calls in try/catch

**Verify:**
- `POST /calendar/events` with valid `X-User-Google-Token` and body → event created in Google Calendar
- `GET /calendar/events` → returns list of upcoming events

---

### Step 6 — Global Exception Filter

Create `AllExceptionsFilter` and apply globally:

```ts
// Catches all exceptions and returns:
{
  statusCode: number,
  message: string,
  timestamp: string,    // ISO
  path: string
}
```

Special cases:
- `AxiosError` from external APIs → map to 502 with message `"External API error: ${api_name}"`
- `HttpException` → use its status and message
- Everything else → 500 `"Internal server error"`

---

### Step 7 — Dockerfile

Multi-stage build:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 10091
CMD ["node", "dist/main"]
```

No nginx needed — NestJS with Fastify is production-ready to receive direct traffic.

---

## Deliverables Per Step

After each step, confirm before proceeding:

| Step | Deliverable | Verify |
|------|-------------|--------|
| 1 | Project boots on 10091 | `curl localhost:10091` |
| 2 | Guard blocks missing headers | `curl` without X-User-Id → 401 |
| 3 | Health endpoint works | `GET /health` → 200 |
| 4 | News endpoints return data | `GET /news?topic=test` → articles |
| 5 | Calendar endpoints work | `GET /calendar/events` → list |
| 6 | Errors are structured JSON | invalid request → structured error |
| 7 | Docker build succeeds | `docker build` → no errors |

---

## Important Rules

- Never hardcode API keys or secrets — always use `ConfigService`
- Never expose the raw response from NewsAPI or Google directly — always map to internal DTOs
- All controller methods must use `@CurrentUser()` decorator even if not using all fields
- `/health` must work WITHOUT `X-User-Id` header
- All external HTTP calls must have a timeout (10s max)
- Cache only GET responses, never POST
