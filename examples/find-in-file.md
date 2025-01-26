# Find in File Tool Example

## Request 1 (Many Results)
```json
{
  "query": "tags:",
  "contextLength": 20
}
```

## Response 1
```json
{
  "message": "Found 34 files with matches. Showing file names only:",
  "results": [
    {
      "filename": "Projects/Project Alpha/Documentation/Requirements.md",
      "matchCount": 1
    },
    {
      "filename": "Projects/Project Beta/Specifications.md",
      "matchCount": 2
    },
    {
      "filename": "Daily Notes/2024-01-25.md",
      "matchCount": 1
    }
  ]
}
```

## Request 2 (Few Results)
```json
{
  "query": "priority: high",
  "contextLength": 50
}
```

## Response 2
```json
{
  "results": [
    {
      "filename": "Projects/Project Alpha/tasks.md",
      "matches": [
        {
          "line": 15,
          "content": "---\ntitle: Critical Tasks\ntags: [tasks, urgent]\npriority: high\n---\n\n# High Priority Tasks",
          "matchStart": 45,
          "matchEnd": 57
        }
      ]
    },
    {
      "filename": "Areas/Work/Deadlines.md",
      "matches": [
        {
          "line": 8,
          "content": "## Q1 Deliverables\n- [ ] Feature launch (priority: high)\n- [ ] Security audit",
          "matchStart": 35,
          "matchEnd": 47
        }
      ]
    }
  ]
}
```

## Example Use Cases

1. **Content Search**
   - Find notes with specific tags or properties
   - Search for keywords across the vault
   - Locate specific metadata patterns

2. **Task Management**
   - Find high-priority tasks
   - Search for incomplete items
   - Locate notes with specific status

3. **Knowledge Discovery**
   - Find related content across notes
   - Search for specific topics or references
   - Identify patterns in note metadata

## Notes
- Returns either file list or detailed matches based on result count
- Provides line numbers for precise location
- Shows surrounding context for each match
- Context length is customizable
- Supports searching in frontmatter and note content
- Results include match position information
- Can search across all vault files