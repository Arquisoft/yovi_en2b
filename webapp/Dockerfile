# Build stage
# Context is the repo root (set in docker-compose.yml) so we can access the root .env
FROM node:22-alpine AS builder

# /app is the parent dir — root .env will live here so vite.config.ts finds it at ../
RUN mkdir -p /app/webapp
WORKDIR /app/webapp

# Install deps
COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci --silent

# Copy webapp sources and root .env (Vite reads it from ../ at build time)
COPY webapp/ .
COPY .env /app/.env

RUN npm run build

# Production image
FROM nginx:stable-alpine
COPY --from=builder /app/webapp/dist /usr/share/nginx/html

# Copy nginx config
COPY webapp/nginx/snippets/ /etc/nginx/snippets/
COPY webapp/nginx/nginx.prod.conf /etc/nginx/prod.conf
COPY webapp/nginx/nginx.dev.conf /etc/nginx/dev.conf

# Copy entrypoint script
COPY webapp/nginx/start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Remove default nginx config and dependant scripts
RUN rm -f /etc/nginx/conf.d/default.conf
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

EXPOSE 80 443

ENTRYPOINT ["/start-nginx.sh"]
