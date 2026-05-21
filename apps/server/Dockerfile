FROM oven/bun:1.1.18

WORKDIR /app

# Copy lockfile and package.json files
COPY bun.lock package.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/tui/package.json ./apps/tui/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/core/package.json ./packages/core/

RUN bun install --frozen-lockfile

# Copy the rest of the workspace
COPY . .

WORKDIR /app/apps/server

ENV PORT=1488
EXPOSE 1488

CMD ["bun", "run", "src/index.ts"]
