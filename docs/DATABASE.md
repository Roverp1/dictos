# Database Schema

Uses libSQL (SQLite dialect) via Turso for cloud sync. Drizzle ORM for type-safe queries.

## Tables

### users

```typescript
{
  id: string (uuid, pk)
  email: string (unique, not null)
  password_hash: string (not null)
  name: string (nullable)
  created_at: timestamp (default: now)
  updated_at: timestamp (default: now)
}
```

**Indexes:**
- `email` (unique)

### directories

Hierarchical organization. Self-referencing for tree structure.

```typescript
{
  id: string (uuid, pk)
  user_id: string (fk → users.id, not null)
  name: string (not null)
  parent_id: string (fk → directories.id, nullable)
  is_default: boolean (default: false)
  created_at: timestamp (default: now)
  updated_at: timestamp (default: now)
}
```

**Constraints:**
- One default directory per user: `unique(user_id, is_default) where is_default = true`
- Cannot reference self: `parent_id != id`

**Indexes:**
- `user_id, parent_id` (composite)
- `user_id, is_default` (composite)

**Tree structure example:**
```
/Languages (parent_id: null)
  /Polish (parent_id: languages_id)
    /Verbs (parent_id: polish_id)
/Programming (parent_id: null)
```

### words

Core content storage.

```typescript
{
  id: string (uuid, pk)
  user_id: string (fk → users.id, not null)
  directory_id: string (fk → directories.id, not null)
  word: string (not null)                    // captured text/phrase
  definition: string (nullable)              // generated or manual
  example: string (nullable)                 // usage example
  source: string (nullable)                  // origin metadata
  created_at: timestamp (default: now)
  updated_at: timestamp (default: now)
}
```

**Indexes:**
- `user_id, directory_id` (composite)
- `user_id, created_at` (composite, for recent words)
- `word` (full-text search - depends on libSQL capabilities)

**Notes:**
- `word` can be a single word, phrase, or sentence
- `source` examples: "Book: SICP", "Website: MDN", "Conversation"

### prompts

LLM prompt templates. System presets + user-created.

```typescript
{
  id: string (uuid, pk)
  user_id: string (fk → users.id, nullable)  // null = system preset
  name: string (not null)
  template: string (not null)                // e.g., "Define '{word}' in simple terms"
  is_default: boolean (default: false)
  created_at: timestamp (default: now)
  updated_at: timestamp (default: now)
}
```

**Template variables:** Use `{word}` placeholder. More variables possible later.

**System presets (user_id = null):**
- "Standard Definition": `Define the word or phrase "{word}" clearly and concisely.`
- "Technical Definition": `Provide a technical definition for "{word}" suitable for developers.`
- "ELI5": `Explain "{word}" in simple terms, like I'm five years old.`
- "With Example": `Define "{word}" and provide a practical example of its usage.`

**Constraints:**
- One default prompt per user: `unique(user_id, is_default) where is_default = true and user_id is not null`
- System presets cannot be default

**Indexes:**
- `user_id, is_default` (composite)

## Relationships

```
users 1───┬──── directories (one-to-many)
          ├──── words (one-to-many)
          └──── prompts (one-to-many)

directories 1──── words (one-to-many)
directories 0..1──── directories (self-reference, parent)
```

## Drizzle Schema Example

```typescript
// packages/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const directories = sqliteTable('directories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: text('parent_id').references((): any => directories.id, { onDelete: 'cascade' }),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userParentIdx: index('dir_user_parent_idx').on(table.userId, table.parentId),
  userDefaultIdx: index('dir_user_default_idx').on(table.userId, table.isDefault),
}));

export const words = sqliteTable('words', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  directoryId: text('directory_id').notNull().references(() => directories.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
  definition: text('definition'),
  example: text('example'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userDirIdx: index('word_user_dir_idx').on(table.userId, table.directoryId),
  userCreatedIdx: index('word_user_created_idx').on(table.userId, table.createdAt),
}));

export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  template: text('template').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userDefaultIdx: index('prompt_user_default_idx').on(table.userId, table.isDefault),
}));
```

## Migrations

Use Drizzle Kit for migration generation:

```bash
bun drizzle-kit generate:sqlite
bun drizzle-kit push:sqlite
```

Store migrations in `packages/db/migrations/`.

## Turso Setup

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create dictos

# Get connection details
turso db show dictos

# Create auth token
turso db tokens create dictos
```

**Connection string:**
```
libsql://[db-name]-[org].turso.io
```

**Environment variables:**
```bash
DATABASE_URL=libsql://dictos-yourorg.turso.io
DATABASE_AUTH_TOKEN=eyJhbGc...
```

## Local Development

Use local SQLite file during development:

```typescript
// packages/db/client.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:./local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client);
```

## Data Isolation

All queries must filter by `user_id` to prevent data leaks:

```typescript
// Correct
const words = await db.select()
  .from(wordsTable)
  .where(eq(wordsTable.userId, currentUserId));

// Wrong - exposes all users' data
const words = await db.select().from(wordsTable);
```

Enforce at repository level:

```typescript
export class DrizzleWordRepository implements WordRepository {
  constructor(private db: LibSQLDatabase, private userId: string) {}
  
  async findByDirectory(dirId: string): Promise<Word[]> {
    return this.db.select()
      .from(words)
      .where(
        and(
          eq(words.userId, this.userId),  // Always filter by user
          eq(words.directoryId, dirId)
        )
      );
  }
}
```

## Query Patterns

**Get directory path:**
```typescript
async function getDirectoryPath(dirId: string): Promise<string> {
  const parts: string[] = [];
  let current = await db.select().from(directories).where(eq(directories.id, dirId)).get();
  
  while (current) {
    parts.unshift(current.name);
    if (!current.parentId) break;
    current = await db.select().from(directories).where(eq(directories.id, current.parentId)).get();
  }
  
  return '/' + parts.join('/');
}
```

**Get all words in directory tree:**
```typescript
async function getWordsRecursive(dirId: string, userId: string): Promise<Word[]> {
  // Get all subdirectories
  const subdirs = await getSubdirectoriesRecursive(dirId, userId);
  const dirIds = [dirId, ...subdirs.map(d => d.id)];
  
  return db.select()
    .from(words)
    .where(
      and(
        eq(words.userId, userId),
        inArray(words.directoryId, dirIds)
      )
    );
}
```

## Soft Deletes (Optional)

Not implemented initially. Add `deleted_at` column if needed:

```typescript
deletedAt: integer('deleted_at', { mode: 'timestamp' })
```

Filter out deleted records in repository layer.
