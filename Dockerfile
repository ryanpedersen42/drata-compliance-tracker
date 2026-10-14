FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---- full deps (build-time, includes devDependencies) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build the app ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- production-only deps ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- final runtime image ----
FROM base AS runner
ENV NODE_ENV=production
ENV DATABASE_URL="file:./data/app.db"

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./prisma7.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
