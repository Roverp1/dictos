# API Specification

REST API for web frontend and authenticated CLI operations.

**Base URL:** `http://localhost:3000/api` (dev) or `https://api.dictos.com` (prod)

**Content-Type:** `application/json`

## Authentication

### POST /auth/register

Register new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe"  // optional
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-03-21T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - Invalid email format or password too short
- `409` - Email already registered

---

### POST /auth/login

Login existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401` - Invalid credentials

---

### GET /auth/me

Get current user info. Requires auth.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2026-03-21T10:00:00Z"
}
```

**Errors:**
- `401` - Missing or invalid token

---

## Directories

All directory endpoints require auth.

### GET /directories

List user's directories.

**Query params:**
- `parent_id` (optional) - Filter by parent directory
- `include_path` (optional, default: false) - Include full path for each directory

**Response:** `200 OK`
```json
{
  "directories": [
    {
      "id": "uuid",
      "name": "Languages",
      "parent_id": null,
      "is_default": false,
      "path": "/Languages",  // if include_path=true
      "created_at": "2026-03-21T10:00:00Z"
    },
    {
      "id": "uuid",
      "name": "Polish",
      "parent_id": "parent_uuid",
      "is_default": true,
      "path": "/Languages/Polish",
      "created_at": "2026-03-21T10:00:00Z"
    }
  ]
}
```

---

### POST /directories

Create new directory.

**Request:**
```json
{
  "name": "Programming",
  "parent_id": null,  // optional, null for root level
  "is_default": false
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Programming",
  "parent_id": null,
  "is_default": false,
  "created_at": "2026-03-21T10:00:00Z"
}
```

**Errors:**
- `400` - Name required, or parent directory doesn't exist
- `409` - Cannot have multiple default directories

---

### PATCH /directories/:id

Update directory.

**Request:**
```json
{
  "name": "JavaScript",  // optional
  "parent_id": "uuid",   // optional
  "is_default": true     // optional
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "JavaScript",
  "parent_id": "uuid",
  "is_default": true,
  "updated_at": "2026-03-21T11:00:00Z"
}
```

**Errors:**
- `404` - Directory not found
- `409` - Setting default when another default exists

---

### DELETE /directories/:id

Delete directory. Cascades to subdirectories and words.

**Response:** `204 No Content`

**Errors:**
- `404` - Directory not found

---

## Words

All word endpoints require auth.

### GET /words

List user's words with filtering.

**Query params:**
- `directory_id` (optional) - Filter by directory
- `recursive` (optional, default: false) - Include subdirectories
- `search` (optional) - Search in word/definition/example
- `limit` (optional, default: 50, max: 200)
- `offset` (optional, default: 0)
- `sort` (optional, default: created_at desc) - Options: `created_at`, `updated_at`, `word`
- `order` (optional, default: desc) - Options: `asc`, `desc`

**Response:** `200 OK`
```json
{
  "words": [
    {
      "id": "uuid",
      "word": "recursion",
      "definition": "A function calling itself",
      "example": "See: factorial function",
      "source": "Book: SICP",
      "directory_id": "uuid",
      "directory_path": "/Programming/Concepts",
      "created_at": "2026-03-21T10:00:00Z",
      "updated_at": "2026-03-21T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### GET /words/:id

Get single word.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "word": "recursion",
  "definition": "A function calling itself",
  "example": "See: factorial function",
  "source": "Book: SICP",
  "directory_id": "uuid",
  "directory_path": "/Programming/Concepts",
  "created_at": "2026-03-21T10:00:00Z",
  "updated_at": "2026-03-21T10:00:00Z"
}
```

**Errors:**
- `404` - Word not found

---

### POST /words

Create new word.

**Request:**
```json
{
  "word": "polymorphism",
  "definition": "Multiple forms of a single interface",  // optional
  "example": "Method overloading in OOP",               // optional
  "source": "MDN",                                       // optional
  "directory_id": "uuid"                                 // required
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "word": "polymorphism",
  "definition": "Multiple forms of a single interface",
  "example": "Method overloading in OOP",
  "source": "MDN",
  "directory_id": "uuid",
  "created_at": "2026-03-21T10:00:00Z"
}
```

**Errors:**
- `400` - Word and directory_id required
- `404` - Directory not found

---

### PATCH /words/:id

Update word.

**Request:**
```json
{
  "word": "polymorphism (updated)",  // optional
  "definition": "...",                 // optional
  "example": "...",                    // optional
  "source": "...",                     // optional
  "directory_id": "uuid"               // optional
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "word": "polymorphism (updated)",
  "definition": "...",
  "updated_at": "2026-03-21T11:00:00Z"
}
```

**Errors:**
- `404` - Word not found

---

### DELETE /words/:id

Delete word.

**Response:** `204 No Content`

**Errors:**
- `404` - Word not found

---

### POST /words/:id/generate-definition

Generate definition using LLM.

**Request:**
```json
{
  "prompt_id": "uuid"  // optional, uses default prompt if not provided
}
```

**Response:** `200 OK`
```json
{
  "definition": "Generated definition text",
  "prompt_used": "Standard Definition"
}
```

**Errors:**
- `404` - Word or prompt not found
- `500` - LLM API error

**Note:** This doesn't automatically save the definition. Client must call `PATCH /words/:id` to update.

---

## Prompts

### GET /prompts

List available prompts (system presets + user's custom prompts).

**Response:** `200 OK`
```json
{
  "prompts": [
    {
      "id": "uuid",
      "name": "Standard Definition",
      "template": "Define the word or phrase \"{word}\" clearly and concisely.",
      "is_default": true,
      "is_system": true,
      "created_at": "2026-03-21T10:00:00Z"
    },
    {
      "id": "uuid",
      "name": "My Custom Prompt",
      "template": "Explain \"{word}\" like I'm learning it for the first time.",
      "is_default": false,
      "is_system": false,
      "created_at": "2026-03-21T10:00:00Z"
    }
  ]
}
```

---

### POST /prompts

Create custom prompt.

**Request:**
```json
{
  "name": "Advanced Technical",
  "template": "Provide an advanced technical explanation for \"{word}\".",
  "is_default": false
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Advanced Technical",
  "template": "Provide an advanced technical explanation for \"{word}\".",
  "is_default": false,
  "created_at": "2026-03-21T10:00:00Z"
}
```

**Errors:**
- `400` - Name and template required
- `409` - Setting default when another default exists

---

### PATCH /prompts/:id

Update prompt. Cannot edit system prompts.

**Request:**
```json
{
  "name": "Updated Name",      // optional
  "template": "New template",  // optional
  "is_default": true           // optional
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Updated Name",
  "template": "New template",
  "is_default": true,
  "updated_at": "2026-03-21T11:00:00Z"
}
```

**Errors:**
- `403` - Cannot edit system prompts
- `404` - Prompt not found

---

### DELETE /prompts/:id

Delete custom prompt. Cannot delete system prompts.

**Response:** `204 No Content`

**Errors:**
- `403` - Cannot delete system prompts
- `404` - Prompt not found

---

## Import/Export

### POST /import/text

Import words from plain text.

**Request:**
```json
{
  "content": "word1,definition1\nword2,definition2",
  "directory_id": "uuid",
  "delimiter": ",",           // options: ",", "\n", ".", custom
  "has_headers": false,
  "mapping": {
    "word": 0,                // column index
    "definition": 1,
    "example": 2              // optional
  }
}
```

**Response:** `201 Created`
```json
{
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

**Errors:**
- `400` - Invalid format or mapping

---

### POST /import/json

Import from JSON export.

**Request:**
```json
{
  "data": {
    "version": "1.0",
    "directories": [...],
    "words": [...]
  },
  "merge_strategy": "skip_existing"  // or "overwrite", "create_duplicates"
}
```

**Response:** `201 Created`
```json
{
  "directories_created": 3,
  "words_imported": 45,
  "words_skipped": 2,
  "words_updated": 1
}
```

---

### GET /export/text

Export words as plain text.

**Query params:**
- `directory_id` (optional) - Export specific directory
- `recursive` (optional, default: true)
- `delimiter` (optional, default: ",")
- `include_headers` (optional, default: true)
- `fields` (optional, default: "word,definition,example") - Comma-separated list

**Response:** `200 OK`
```
Content-Type: text/plain
Content-Disposition: attachment; filename="words.txt"

word,definition,example
recursion,A function calling itself,See: factorial
```

---

### GET /export/json

Export words as JSON.

**Query params:**
- `directory_id` (optional)
- `recursive` (optional, default: true)

**Response:** `200 OK`
```json
{
  "version": "1.0",
  "exported_at": "2026-03-21T10:00:00Z",
  "directories": [
    {
      "id": "uuid",
      "name": "Programming",
      "parent_id": null,
      "path": "/Programming"
    }
  ],
  "words": [
    {
      "id": "uuid",
      "word": "recursion",
      "definition": "...",
      "example": "...",
      "source": "...",
      "directory_path": "/Programming/Concepts",
      "created_at": "2026-03-21T10:00:00Z",
      "updated_at": "2026-03-21T10:00:00Z"
    }
  ]
}
```

---

### GET /export/anki

Export as Anki-compatible CSV.

**Query params:**
- `directory_id` (optional)
- `recursive` (optional, default: true)

**Response:** `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename="anki-cards.csv"

Front,Back,Example,Tags
recursion,"A function calling itself","See: factorial","Programming::Concepts"
```

**Format:**
- `Front`: word
- `Back`: definition
- `Example`: example (if exists)
- `Tags`: directory path converted to Anki tags (/ → ::)

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": {
      "field": "email",
      "constraint": "required"
    }
  }
}
```

**Common error codes:**
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)

---

## Rate Limiting

**Limits:**
- Auth endpoints: 5 requests/minute
- Definition generation: 20 requests/minute
- Other endpoints: 100 requests/minute

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1679318400
```

When exceeded:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again in 30 seconds.",
    "retry_after": 30
  }
}
```

---

## JWT Token Format

**Payload:**
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "iat": 1679318400,
  "exp": 1679922400
}
```

**Expiration:** 7 days

**Usage:** Include in `Authorization` header:
```
Authorization: Bearer <token>
```

---

## ElysiaJS Implementation Example

```typescript
// apps/backend/src/routes/words.ts
import { Elysia, t } from 'elysia';
import { WordService } from '@dictos/core/services';
import { authMiddleware } from '../middleware/auth';

export const wordsRoute = new Elysia({ prefix: '/words' })
  .use(authMiddleware)
  
  .get('/', async ({ query, user }) => {
    const service = new WordService(db, llm);
    const words = await service.findWords(user.id, query);
    return { words, total: words.length };
  })
  
  .post('/', async ({ body, user }) => {
    const service = new WordService(db, llm);
    const word = await service.createWord({ ...body, userId: user.id });
    return word;
  }, {
    body: t.Object({
      word: t.String(),
      directory_id: t.String(),
      definition: t.Optional(t.String()),
      example: t.Optional(t.String()),
      source: t.Optional(t.String()),
    })
  });
```
