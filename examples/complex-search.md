# Complex Search Tool Example

## Request 1 (Simple Glob Pattern)
```json
{
  "query": {
    "glob": ["*.md", {"var": "path"}]
  }
}
```

## Response 1
```json
{
  "matches": [
    "README.md",
    "Projects/Project Alpha/Documentation/Requirements.md",
    "Daily Notes/2024-01-25.md",
    "Templates/Meeting Note.md"
  ]
}
```

## Request 2 (Complex Pattern)
```json
{
  "query": {
    "and": [
      {
        "glob": ["Projects/**/*.md", {"var": "path"}]
      },
      {
        "in": [
          "Documentation",
          {"var": "path"}
        ]
      }
    ]
  }
}
```

## Response 2
```json
{
  "matches": [
    "Projects/Project Alpha/Documentation/Requirements.md",
    "Projects/Project Alpha/Documentation/Architecture.md",
    "Projects/Project Beta/Documentation/API.md"
  ]
}
```

## Example Use Cases

1. **File Organization**
   - Find files by pattern matching
   - Filter by path components
   - Combine multiple search criteria

2. **Content Management**
   - Locate files in specific directories
   - Filter by file extensions
   - Find files matching complex patterns

3. **Project Navigation**
   - Search within project directories
   - Find documentation files
   - Filter by file location

## Notes
- Uses JsonLogic for query construction
- Supports glob pattern matching
- Can combine multiple conditions
- Available operations:
  * glob: Pattern matching for paths
  * var: Variable access (path)
  * and/or: Logical operations
  * in: Membership testing
- Path is relative to vault root
- Returns matching file paths
- Useful for complex file filtering

## Common Patterns

1. **Find All Markdown Files**
```json
{
  "glob": ["**/*.md", {"var": "path"}]
}
```

2. **Files in Specific Directory**
```json
{
  "glob": ["Projects/Project Alpha/**/*", {"var": "path"}]
}
```

3. **Multiple Extensions**
```json
{
  "or": [
    {"glob": ["**/*.md", {"var": "path"}]},
    {"glob": ["**/*.txt", {"var": "path"}]}
  ]
}
```

4. **Exclude Pattern**
```json
{
  "and": [
    {"glob": ["**/*.md", {"var": "path"}]},
    {"not": {"glob": ["**/Archive/**", {"var": "path"}]}}
  ]
}