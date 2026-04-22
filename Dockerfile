FROM node:20-bookworm-slim AS base

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    wget \
    gnupg \
    openssl \
    --no-install-recommends && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
    apt-get update && apt-get install -y \
    google-chrome-stable \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]