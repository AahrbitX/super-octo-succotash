# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source and config files
COPY src ./src
COPY drizzle ./drizzle
COPY package.json tsconfig.json drizzle.config.ts ./

EXPOSE 4000

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
