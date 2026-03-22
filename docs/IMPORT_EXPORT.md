# Import/Export Formats

Specifications for data interchange formats.

## Plain Text Import

Import delimited text files.

### Format Options

**Delimiters:**
- `,` (comma) - CSV style
- `\n` (newline) - one word per line
- `.` (period) - sentence-separated
- `\t` (tab) - TSV style
- Custom string

**Column Mapping:**
Maps file columns to word fields by index (0-based).

### Examples

**CSV with headers:**
```
word,definition,example,source
recursion,A function calling itself,See factorial,Book: SICP
polymorphism,Multiple forms,Method overloading,MDN
```

Import config:
```json
{
  "delimiter": ",",
  "has_headers": true,
  "mapping": {
    "word": 0,
    "definition": 1,
    "example": 2,
    "source": 3
  }
}
```

**Newline-delimited (word only):**
```
recursion
polymorphism
inheritance
encapsulation
```

Import config:
```json
{
  "delimiter": "\n",
  "has_headers": false,
  "mapping": {
    "word": 0
  }
}
```

**Custom delimiter:**
```
recursion | A function calling itself | See factorial
polymorphism | Multiple forms | Method overloading
```

Import config:
```json
{
  "delimiter": " | ",
  "has_headers": false,
  "mapping": {
    "word": 0,
    "definition": 1,
    "example": 2
  }
}
```

### Implementation

```typescript
// packages/core/services/import-export-service.ts
interface TextImportOptions {
  content: string;
  delimiter: string;
  hasHeaders: boolean;
  mapping: {
    word: number;
    definition?: number;
    example?: number;
    source?: number;
  };
}

export class ImportExportService {
  async importText(
    options: TextImportOptions,
    directoryId: string,
    userId: string
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    const lines = options.content.split('\n');
    const startIndex = options.hasHeaders ? 1 : 0;
    
    const results = { imported: 0, failed: 0, errors: [] };
    
    for (let i = startIndex; i < lines.length; i++) {
      const columns = lines[i].split(options.delimiter);
      
      try {
        const word = columns[options.mapping.word]?.trim();
        if (!word) continue;
        
        await this.wordService.createWord({
          word,
          definition: columns[options.mapping.definition]?.trim(),
          example: columns[options.mapping.example]?.trim(),
          source: columns[options.mapping.source]?.trim(),
          directoryId,
          userId,
        });
        
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Line ${i + 1}: ${error.message}`);
      }
    }
    
    return results;
  }
}
```

---

## Plain Text Export

Export words to delimited text.

### Format

**Default (CSV with headers):**
```
word,definition,example,source
recursion,A function calling itself,See factorial,Book: SICP
polymorphism,Multiple forms,Method overloading,MDN
```

**Custom delimiter:**
```
recursion | A function calling itself | See factorial | Book: SICP
polymorphism | Multiple forms | Method overloading | MDN
```

**Word only (newline-delimited):**
```
recursion
polymorphism
inheritance
```

### Export Options

```typescript
interface TextExportOptions {
  delimiter: string;           // default: ","
  includeHeaders: boolean;     // default: true
  fields: string[];            // default: ["word", "definition", "example"]
  directoryId?: string;        // optional
  recursive: boolean;          // default: true
}
```

### Implementation

```typescript
export class ImportExportService {
  async exportText(
    options: TextExportOptions,
    userId: string
  ): Promise<string> {
    const words = await this.wordService.findWords(userId, {
      directoryId: options.directoryId,
      recursive: options.recursive,
    });
    
    const lines: string[] = [];
    
    if (options.includeHeaders) {
      lines.push(options.fields.join(options.delimiter));
    }
    
    for (const word of words) {
      const values = options.fields.map(field => {
        const value = word[field] || '';
        // Escape delimiter if present in value
        return value.includes(options.delimiter) 
          ? `"${value}"` 
          : value;
      });
      lines.push(values.join(options.delimiter));
    }
    
    return lines.join('\n');
  }
}
```

---

## JSON Format

Structured export/import with full fidelity.

### Schema

```typescript
interface JSONExport {
  version: string;              // "1.0"
  exported_at: string;          // ISO 8601 timestamp
  directories: Directory[];
  words: Word[];
}

interface Directory {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;                 // computed, e.g., "/Languages/Polish"
}

interface Word {
  id: string;
  word: string;
  definition: string | null;
  example: string | null;
  source: string | null;
  directory_path: string;       // for import mapping
  created_at: string;           // ISO 8601
  updated_at: string;
}
```

### Example

```json
{
  "version": "1.0",
  "exported_at": "2026-03-21T10:00:00Z",
  "directories": [
    {
      "id": "dir-1",
      "name": "Languages",
      "parent_id": null,
      "path": "/Languages"
    },
    {
      "id": "dir-2",
      "name": "Polish",
      "parent_id": "dir-1",
      "path": "/Languages/Polish"
    }
  ],
  "words": [
    {
      "id": "word-1",
      "word": "dziękuję",
      "definition": "thank you",
      "example": "Dziękuję bardzo",
      "source": "Duolingo",
      "directory_path": "/Languages/Polish",
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-03-01T10:00:00Z"
    },
    {
      "id": "word-2",
      "word": "recursion",
      "definition": "A function calling itself",
      "example": "See factorial function",
      "source": "Book: SICP",
      "directory_path": "/Programming/Concepts",
      "created_at": "2026-03-15T14:30:00Z",
      "updated_at": "2026-03-15T14:30:00Z"
    }
  ]
}
```

### Import Behavior

**Merge strategies:**

1. **skip_existing** (default): Skip words with same ID
2. **overwrite**: Update existing words with same ID
3. **create_duplicates**: Create new IDs for all words

**Directory handling:**
- Recreate directory structure from `path` field
- Match by path, not ID (allows cross-user imports)
- Create missing parent directories automatically

### Implementation

```typescript
interface JSONImportOptions {
  data: JSONExport;
  mergeStrategy: 'skip_existing' | 'overwrite' | 'create_duplicates';
}

export class ImportExportService {
  async importJSON(
    options: JSONImportOptions,
    userId: string
  ): Promise<{
    directories_created: number;
    words_imported: number;
    words_skipped: number;
    words_updated: number;
  }> {
    const results = {
      directories_created: 0,
      words_imported: 0,
      words_skipped: 0,
      words_updated: 0,
    };
    
    // Create directory structure
    const dirPathMap = new Map<string, string>(); // path -> new ID
    for (const dir of options.data.directories) {
      const existing = await this.directoryService.findByPath(dir.path, userId);
      if (existing) {
        dirPathMap.set(dir.path, existing.id);
      } else {
        const created = await this.directoryService.create({
          name: dir.name,
          parentId: dir.parent_id ? dirPathMap.get(getParentPath(dir.path)) : null,
          userId,
        });
        dirPathMap.set(dir.path, created.id);
        results.directories_created++;
      }
    }
    
    // Import words
    for (const word of options.data.words) {
      const directoryId = dirPathMap.get(word.directory_path);
      if (!directoryId) continue;
      
      const existing = options.mergeStrategy === 'create_duplicates' 
        ? null 
        : await this.wordService.findById(word.id);
      
      if (existing && options.mergeStrategy === 'skip_existing') {
        results.words_skipped++;
      } else if (existing && options.mergeStrategy === 'overwrite') {
        await this.wordService.update(word.id, { ...word, directoryId });
        results.words_updated++;
      } else {
        await this.wordService.createWord({
          ...word,
          id: options.mergeStrategy === 'create_duplicates' ? generateId() : word.id,
          directoryId,
          userId,
        });
        results.words_imported++;
      }
    }
    
    return results;
  }
  
  async exportJSON(
    options: { directoryId?: string; recursive: boolean },
    userId: string
  ): Promise<JSONExport> {
    const words = await this.wordService.findWords(userId, options);
    const directories = await this.directoryService.findAll(userId);
    
    return {
      version: "1.0",
      exported_at: new Date().toISOString(),
      directories: directories.map(d => ({
        id: d.id,
        name: d.name,
        parent_id: d.parentId,
        path: d.path,
      })),
      words: words.map(w => ({
        id: w.id,
        word: w.word,
        definition: w.definition,
        example: w.example,
        source: w.source,
        directory_path: w.directoryPath,
        created_at: w.createdAt.toISOString(),
        updated_at: w.updatedAt.toISOString(),
      })),
    };
  }
}
```

---

## Anki Format

CSV format compatible with Anki import.

### Structure

```
Front,Back,Example,Tags
word,definition,example,directory::path
```

**Fields:**
- `Front`: The word/phrase (appears on card front)
- `Back`: Definition (appears on card back)
- `Example`: Usage example (optional, shown on back)
- `Tags`: Directory path converted to Anki tags (`/` → `::`)

### Example

```
Front,Back,Example,Tags
dziękuję,thank you,Dziękuję bardzo,Languages::Polish
recursion,A function calling itself,See factorial function,Programming::Concepts
polymorphism,Multiple forms of a single interface,Method overloading,Programming::OOP
```

### Tag Conversion

Directory paths become Anki tags:
- `/Languages/Polish` → `Languages::Polish`
- `/Programming` → `Programming`
- `/Web/Frontend/React` → `Web::Frontend::React`

### Anki Import Settings

In Anki:
1. File → Import
2. Select exported CSV
3. Set field mapping:
   - Field 1 → Front
   - Field 2 → Back
   - Field 3 → Example (add to card template if needed)
4. Tags are automatically imported

### Implementation

```typescript
export class ImportExportService {
  async exportAnki(
    options: { directoryId?: string; recursive: boolean },
    userId: string
  ): Promise<string> {
    const words = await this.wordService.findWords(userId, options);
    
    const lines: string[] = ['Front,Back,Example,Tags'];
    
    for (const word of words) {
      const front = this.escapeCSV(word.word);
      const back = this.escapeCSV(word.definition || '');
      const example = this.escapeCSV(word.example || '');
      const tags = this.pathToAnkiTag(word.directoryPath);
      
      lines.push(`${front},${back},${example},${tags}`);
    }
    
    return lines.join('\n');
  }
  
  private pathToAnkiTag(path: string): string {
    return path.replace(/^\//, '').replace(/\//g, '::');
  }
  
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
```

---

## Readera Format

Placeholder for Readera backup JSON import.

### Structure (TBD)

Will be documented once you provide the actual Readera backup format.

Expected fields to map:
- Highlighted text → word
- User note → definition or example
- Book metadata → source
- Timestamp → created_at

### Implementation Stub

```typescript
interface ReaderaBackup {
  // Structure to be defined
  highlights: Array<{
    text: string;
    note?: string;
    book: {
      title: string;
      author: string;
    };
    timestamp: string;
  }>;
}

export class ImportExportService {
  async importReadera(
    backup: ReaderaBackup,
    directoryId: string,
    userId: string
  ): Promise<{ imported: number }> {
    // Implementation once format is known
    throw new Error('Not yet implemented - awaiting Readera format spec');
  }
}
```

### Next Steps

1. Export a sample Readera backup
2. Analyze JSON structure
3. Map fields to word schema
4. Implement import logic
5. Add to API endpoint

---

## CLI Examples

```bash
# Import plain text
dictos import --file words.txt --delimiter "," --directory Programming

# Import JSON
dictos import --file backup.json --merge overwrite

# Export to CSV
dictos export --format text --delimiter "," --output words.csv

# Export to JSON
dictos export --format json --directory Languages --recursive

# Export to Anki
dictos export --format anki --directory Languages/Polish --output anki.csv
```

---

## API Examples

**Import CSV:**
```bash
curl -X POST http://localhost:3000/api/import/text \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "word,definition\nrecursion,A function calling itself",
    "directory_id": "uuid",
    "delimiter": ",",
    "has_headers": true,
    "mapping": { "word": 0, "definition": 1 }
  }'
```

**Export JSON:**
```bash
curl -X GET "http://localhost:3000/api/export/json?directory_id=uuid" \
  -H "Authorization: Bearer <token>" \
  -o backup.json
```

**Export Anki:**
```bash
curl -X GET "http://localhost:3000/api/export/anki?recursive=true" \
  -H "Authorization: Bearer <token>" \
  -o anki.csv
```
