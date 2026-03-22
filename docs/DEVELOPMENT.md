# Development Guide

## Stack

- **Runtime:** Bun
- **Monorepo:** Bun Workspaces
- **ORM:** Drizzle
- **Database:** Turso (libSQL)
- **Backend:** ElysiaJS
- **CLI:** Commander.js
- **Web:** React + Vite
- **Auth:** JWT
- **Validation:** Zod
- **LLM:** OpenAI/Anthropic APIs

## Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash
```

## Project Structure

```
dictos/
├── package.json              # Workspace root
├── bun.lockb
├── tsconfig.json             # Base TypeScript config
│
├── packages/
│   ├── db/                   # Database schema & client
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── schema.ts
│   │   ├── client.ts
│   │   ├── migrations/
│   │   └── adapters/         # Repository implementations
│   │
│   ├── core/                 # Business logic
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── types/
│   │   │   ├── ports.ts      # Interfaces
│   │   │   └── models.ts     # Domain models
│   │   ├── services/
│   │   │   ├── word-service.ts
│   │   │   ├── directory-service.ts
│   │   │   ├── prompt-service.ts
│   │   │   └── import-export-service.ts
│   │   └── utils/
│   │
│   └── shared/               # Common utilities
│       ├── package.json
│       ├── validation.ts     # Zod schemas
│       └── errors.ts
│
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── words.ts
│   │   │   │   ├── directories.ts
│   │   │   │   └── prompts.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   └── error.ts
│   │   │   └── adapters/
│   │   │       └── openai-llm.ts
│   │   └── .env
│   │
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/
│   │   │   │   ├── add.ts
│   │   │   │   ├── list.ts
│   │   │   │   ├── define.ts
│   │   │   │   ├── export.ts
│   │   │   │   └── sync.ts
│   │   │   └── db.ts
│   │   └── .env.local
│   │
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
```

## Setup

### 1. Initialize Monorepo

Root `package.json`:
```json
{
  "name": "dictos",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev:backend": "bun --watch apps/backend/src/index.ts",
    "dev:cli": "bun apps/cli/src/index.ts",
    "dev:web": "bun --cwd apps/web dev",
    "db:generate": "bun --cwd packages/db drizzle-kit generate:sqlite",
    "db:push": "bun --cwd packages/db drizzle-kit push:sqlite",
    "build": "bun run build:packages && bun run build:apps",
    "build:packages": "bun --filter './packages/*' build",
    "build:apps": "bun --filter './apps/*' build"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0"
  }
}
```

Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "paths": {
      "@dictos/core": ["./packages/core/src"],
      "@dictos/db": ["./packages/db/src"],
      "@dictos/shared": ["./packages/shared/src"]
    }
  }
}
```

### 2. Install Dependencies

```bash
bun install
bun add -D drizzle-kit

# In packages/db
cd packages/db
bun add drizzle-orm @libsql/client
bun add -D @types/node

# In packages/core
cd ../core
bun add zod
bun add -D @types/node

# In apps/backend
cd ../../apps/backend
bun add elysia @elysiajs/jwt @elysiajs/cors
bun add bcrypt jsonwebtoken
bun add openai anthropic
bun add -D @types/bcrypt @types/jsonwebtoken

# In apps/cli
cd ../cli
bun add commander chalk ora
```

### 3. Database Setup

```bash
# Create Turso database
turso db create dictos
turso db show dictos
turso db tokens create dictos

# Add to apps/backend/.env
DATABASE_URL=libsql://dictos-yourorg.turso.io
DATABASE_AUTH_TOKEN=your_token_here
JWT_SECRET=your_secret_here
OPENAI_API_KEY=sk-...
```

Drizzle config (`packages/db/drizzle.config.ts`):
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './schema.ts',
  out: './migrations',
  driver: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
```

Generate and push schema:
```bash
cd packages/db
bun run drizzle-kit generate:sqlite
bun run drizzle-kit push:sqlite
```

### 4. Seed System Prompts

```typescript
// packages/db/seed.ts
import { db } from './client';
import { prompts } from './schema';

const systemPrompts = [
  {
    id: crypto.randomUUID(),
    userId: null,
    name: 'Standard Definition',
    template: 'Define the word or phrase "{word}" clearly and concisely.',
    isDefault: true,
  },
  {
    id: crypto.randomUUID(),
    userId: null,
    name: 'Technical Definition',
    template: 'Provide a technical definition for "{word}" suitable for developers.',
    isDefault: false,
  },
  {
    id: crypto.randomUUID(),
    userId: null,
    name: 'ELI5',
    template: 'Explain "{word}" in simple terms, like I\'m five years old.',
    isDefault: false,
  },
];

await db.insert(prompts).values(systemPrompts);
```

Run: `bun packages/db/seed.ts`

## Development Workflow

### Phase 1: Core + Database (Week 1)

1. Define schema in `packages/db/schema.ts`
2. Create port interfaces in `packages/core/types/ports.ts`
3. Implement services in `packages/core/services/`
4. Create Drizzle adapters in `packages/db/adapters/`
5. Write unit tests for services (mock adapters)

### Phase 2: Backend API (Week 2)

1. Set up ElysiaJS server in `apps/backend/src/index.ts`
2. Implement JWT middleware
3. Create auth routes (register, login)
4. Implement CRUD routes for words, directories, prompts
5. Add LLM adapter for OpenAI/Anthropic
6. Test with curl/Postman

### Phase 3: CLI (Week 2-3)

1. Set up Commander in `apps/cli/src/index.ts`
2. Implement local SQLite database
3. Create commands: add, list, define, export
4. Add cloud sync commands (login, push, pull)
5. Test workflow end-to-end

### Phase 4: Web Frontend (Week 3-4)

Your friend handles this once backend API is stable.

1. Set up Vite + React
2. Implement auth flow (login, register)
3. Build directory tree UI
4. Build word list and detail views
5. Integrate with backend API

## Testing

### Unit Tests (Core Services)

```typescript
// packages/core/services/__tests__/word-service.test.ts
import { describe, expect, it, mock } from 'bun:test';
import { WordService } from '../word-service';

describe('WordService', () => {
  it('creates a word', async () => {
    const mockDb = {
      words: {
        insert: mock(() => Promise.resolve({ id: '123', word: 'test' })),
      },
    };
    
    const service = new WordService(mockDb as any, {} as any);
    const result = await service.createWord({ word: 'test', userId: 'user1' });
    
    expect(mockDb.words.insert).toHaveBeenCalled();
    expect(result.word).toBe('test');
  });
});
```

Run: `bun test`

### Integration Tests (Backend)

```typescript
// apps/backend/__tests__/words.test.ts
import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('POST /words', () => {
  it('creates a word', async () => {
    const response = await app.handle(
      new Request('http://localhost/words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_jwt_token',
        },
        body: JSON.stringify({ word: 'test', directoryId: 'dir1' }),
      })
    );
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.word).toBe('test');
  });
});
```

## Environment Variables

### Backend (`apps/backend/.env`)
```bash
DATABASE_URL=libsql://dictos-yourorg.turso.io
DATABASE_AUTH_TOKEN=your_token
JWT_SECRET=your_secret
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

### CLI (`apps/cli/.env.local`)
```bash
MODE=local
DATABASE_URL=file:~/.dictos/local.db
API_URL=http://localhost:3000
API_KEY=  # Optional, for cloud sync
```

## Common Commands

```bash
# Development
bun dev:backend          # Start backend server
bun dev:cli              # Run CLI
bun dev:web              # Start web dev server

# Database
bun db:generate          # Generate migrations
bun db:push              # Push schema to Turso

# Build
bun build                # Build all packages and apps

# Testing
bun test                 # Run all tests
bun test:watch           # Watch mode
```

## Debugging

### Backend
Use Bun's built-in debugger:
```bash
bun --inspect apps/backend/src/index.ts
```

Open `chrome://inspect` in Chrome.

### CLI
Add `debugger;` statements and run:
```bash
bun --inspect apps/cli/src/index.ts <command>
```

## Package Versioning

Use workspace protocol for internal dependencies:

```json
{
  "dependencies": {
    "@dictos/core": "workspace:*",
    "@dictos/db": "workspace:*"
  }
}
```

Bun resolves these to local packages automatically.

## Build Output

```bash
packages/db/dist/
packages/core/dist/
apps/backend/dist/
apps/cli/dist/
apps/web/dist/
```

Each package outputs compiled JS + type declarations.
