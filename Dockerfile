# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache nginx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Node listens on 3000 internally; nginx proxies from 10091
ENV PORT=3000

EXPOSE 10091
ENTRYPOINT ["./docker-entrypoint.sh"]
