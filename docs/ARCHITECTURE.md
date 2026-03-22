# Architecture

Dictos uses hexagonal architecture (ports & adapters pattern). Core business logic is isolated from external dependencies - database, UI, APIs.

## Core Principle

Dependencies point inward. `core` package never imports from `apps` or infrastructure. Apps provide concrete implementations of interfaces that core defines.

## Monorepo Structure

```
dictos/
├── packages/
│   ├── db/              # Schema definitions (Drizzle ORM)
│   ├── core/            # Business logic (platform-agnostic)
│   └── shared/          # Common utilities
├── apps/
│   ├── backend/         # ElysiaJS API server
│   ├── cli/             # Command-line interface
│   └── web/             # React frontend
```

**Rules:**
- `packages` cannot import from `apps`
- `core` defines interfaces (ports), `apps` provide implementations (adapters)
- Core uses only pure TypeScript, no platform-specific APIs (no `window`, no `fs`)

## Ports & Adapters

Core defines what it needs, apps provide how it works.

### Port (Interface)

```typescript
// packages/core/types/ports.ts
export interface DatabasePort {
  words: WordRepository;
  directories: DirectoryRepository;
}

export interface LLMPort {
  generate(template: string, vars: Record<string, string>): Promise<string>;
}

export interface WordRepository {
  insert(data: CreateWordInput): Promise<Word>;
  findById(id: string): Promise<Word | null>;
  findByDirectory(dirId: string): Promise<Word[]>;
  update(id: string, data: Partial<Word>): Promise<Word>;
  delete(id: string): Promise<void>;
}
```

### Service (Core Logic)

```typescript
// packages/core/services/word-service.ts
export class WordService {
  constructor(
    private db: DatabasePort,
    private llm: LLMPort
  ) {}

  async createWord(input: CreateWordInput): Promise<Word> {
    return this.db.words.insert(input);
  }

  async generateDefinition(word: string, promptId?: string): Promise<string> {
    const prompt = await this.db.prompts.findById(promptId);
    return this.llm.generate(prompt.template, { word });
  }
}
```

### Adapter (Implementation)

```typescript
// packages/db/adapters/drizzle-repository.ts
export class DrizzleWordRepository implements WordRepository {
  constructor(private db: LibSQLDatabase) {}
  
  async insert(data: CreateWordInput): Promise<Word> {
    const [word] = await this.db.insert(words).values(data).returning();
    return word;
  }
}
```

```typescript
// apps/backend/adapters/openai-llm.ts
export class OpenAILLM implements LLMPort {
  constructor(private apiKey: string) {}
  
  async generate(template: string, vars: Record<string, string>): Promise<string> {
    const prompt = this.interpolate(template, vars);
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });
    return response.choices[0].message.content;
  }
}
```

## Usage Across Apps

Same service, different adapters.

### Backend (ElysiaJS)

```typescript
// apps/backend/routes/words.ts
import { WordService } from '@dictos/core/services';
import { drizzleDb } from '@dictos/db';
import { OpenAILLM } from '../adapters/openai-llm';

export const wordsRoute = new Elysia()
  .post('/words', async ({ body, user }) => {
    const service = new WordService(drizzleDb, new OpenAILLM(process.env.OPENAI_API_KEY));
    return service.createWord({ ...body, userId: user.id });
  });
```

### CLI (Local SQLite)

```typescript
// apps/cli/commands/add.ts
import { WordService } from '@dictos/core/services';
import { getLocalDb } from '../db';
import { OllamaLLM } from '../adapters/ollama-llm';

export async function addWord(word: string) {
  const db = await getLocalDb();
  const service = new WordService(db, new OllamaLLM());
  
  await service.createWord({ word, userId: getCurrentUserId() });
  console.log(`Added "${word}"`);
}
```

### Web (via API)

Web doesn't use core directly - it calls backend API. Backend handles all core logic.

## Benefits

**Testability:** Mock adapters for unit tests
```typescript
const mockDb = new MockDatabase();
const mockLLM = new MockLLM();
const service = new WordService(mockDb, mockLLM);
```

**Swappable:** Switch databases (SQLite → Postgres), LLMs (OpenAI → Anthropic), UIs (CLI → Mobile) without touching core

**Reusability:** Same `WordService` works in backend, CLI, future mobile app

## Package Dependencies

```
core → (nothing)
db → drizzle-orm, libsql
shared → zod

backend → core, db, shared, elysia
cli → core, db, shared, commander
web → (calls backend API only)
```

## Data Flow

**CLI/Backend:**
```
User input → App layer → Service (core) → Repository adapter → Database
                                       → LLM adapter → API
```

**Web:**
```
User input → React component → API call → Backend → Service (core) → ...
```

## Key Architectural Decisions

1. **Directories over categories:** Hierarchical organization with `parent_id` self-reference
2. **Standard word fields:** `word`, `definition`, `example`, `source` (no dynamic schemas yet)
3. **Preset + custom prompts:** Ship with defaults, users can create named variants
4. **JWT auth:** Stateless, works across all clients
5. **ElysiaJS backend:** Fast, type-safe, Bun-native
6. **Turso database:** SQLite dialect with built-in sync
7. **Cloud LLM:** OpenAI/Anthropic APIs (not local models)

## Future Extensions

- Mobile app: Reuse `@dictos/core`, write React Native UI + minimal native modules
- Offline web: Add service worker + IndexedDB adapter
- Different LLM: Implement new `LLMPort` adapter (Ollama, Claude)
- Postgres: Implement new Drizzle adapter for `DatabasePort`
