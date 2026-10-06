# Frontend budowany natywnie na maszynie CI (bez emulacji) — dist nie zależy od architektury.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
RUN npm i -g pnpm@12.9.1
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter web build

# Zależności produkcyjne serwera — na docelowej architekturze (natywne moduły, np. SQLite w przyszłości).
FROM node:24-slim AS deps
RUN npm i -g pnpm@12.9.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/games/package.json packages/games/
COPY apps/server/package.json apps/server/
RUN pnpm install --prod --frozen-lockfile --filter server...

FROM node:24-slim
WORKDIR /app
COPY --from=deps /app ./
COPY packages/games/src packages/games/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
ENV NODE_ENV=production PORT=2567
EXPOSE 2567
CMD ["node", "apps/server/src/index.ts"]
