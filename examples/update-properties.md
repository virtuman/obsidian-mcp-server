# Update Properties Tool Example

## Request 1 (Update Multiple Properties)
```json
{
  "filepath": "Projects/Project Alpha/Documentation/Requirements.md",
  "properties": {
    "status": ["in-review"],
    "tags": ["project", "requirements", "documentation", "technical"],
    "modified": "2024-01-25",
    "reviewers": ["Tech Lead", "Product Manager", "Security Team"],
    "version": "1.1"
  }
}
```

## Response 1
```json
{
  "success": true,
  "message": "Properties updated successfully"
}
```

## Request 2 (Merge Array Properties)
```json
{
  "filepath": "Projects/Project Beta/Specifications.md",
  "properties": {
    "tags": ["api", "backend"],
    "status": ["draft"]
  },
  "replace": false
}
```

## Response 2
```json
{
  "success": true,
  "message": "Properties merged successfully"
}
```

## Example Use Cases

1. **Document Management**
   - Update document status
   - Add or remove tags
   - Track document versions
   - Manage review process

2. **Project Tracking**
   - Update task status
   - Assign reviewers
   - Track modifications
   - Version control

3. **Content Organization**
   - Categorize content
   - Update metadata
   - Manage document lifecycle
   - Track document history

## Notes
- Updates YAML frontmatter properties
- Supports property merging or replacement
- Handles various property types:
  * Strings
  * Arrays
  * Dates
  * Numbers
  * Boolean values
- Preserves existing properties not specified in update
- Automatically updates modified timestamp
- Creates properties if they don't exist

## Property Handling

1. **Array Merging (replace: false)**
```yaml
# Original
tags: [project, draft]
status: [review]

# Update
tags: [technical, draft]
status: [complete]

# Result
tags: [project, draft, technical]
status: [review, complete]
```

2. **Array Replacement (replace: true)**
```yaml
# Original
reviewers: [Alice, Bob]
tags: [draft]

# Update (replace: true)
reviewers: [Charlie]
tags: [final]

# Result
reviewers: [Charlie]
tags: [final]
```

3. **Property Types**
```yaml
# String properties
title: "Updated Title"
author: "New Author"

# Date properties
modified: 2024-01-25
due: 2024-02-01

# Number properties
version: 2.0
priority: 1

# Boolean properties
published: true
confidential: false