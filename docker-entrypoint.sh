#!/bin/sh
set -e

# Validate required environment variables at startup
required_vars="NEWSAPI_BASE_URL NEWSAPI_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI"

for var in $required_vars; do
  val=$(eval echo "\$$var")
  if [ -z "$val" ]; then
    echo "[entrypoint] ERROR: required environment variable '$var' is not set" >&2
    exit 1
  fi
done

echo "[entrypoint] All required environment variables are set."

# Start NestJS in the background (internal port 3000)
node dist/main &
NODE_PID=$!

# Forward SIGTERM/SIGINT to child processes for graceful shutdown
trap 'echo "[entrypoint] Shutting down..."; kill "$NODE_PID" 2>/dev/null; nginx -s quit 2>/dev/null; exit 0' TERM INT

# Start nginx in the foreground (PID 1 receives signals)
exec nginx -g "daemon off;"
