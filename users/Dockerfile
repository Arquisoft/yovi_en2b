# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Instalar con --ignore-scripts y recompilar bcrypt de forma controlada
RUN npm ci --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./

# Build
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --omit=dev --omit=optional --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

# Copiar el build del stage anterior
COPY --from=builder /app/dist ./dist
COPY openapi.yaml ./

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/app.js"]
