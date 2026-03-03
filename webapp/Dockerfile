# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy sources
COPY . .

# Accept build-time API url (defaults to localhost:3000)
ARG VITE_API_URL="http://localhost:3000"
RUN export VITE_API_URL=${VITE_API_URL} && npm run build

# Production image
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/snippets/ /etc/nginx/snippets/
COPY nginx/nginx.prod.conf /etc/nginx/prod.conf
COPY nginx/nginx.dev.conf /etc/nginx/dev.conf

# Copy entrypoint script
COPY nginx/start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# Remove default nginx config and dependant scripts
RUN rm -f /etc/nginx/conf.d/default.conf
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

EXPOSE 80 443

ENTRYPOINT ["/start-nginx.sh"]