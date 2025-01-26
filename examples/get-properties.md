# Get Properties Tool Example

## Request
```json
{
  "filepath": "Projects/Project Alpha/Documentation/Requirements.md"
}
```

## Response
```json
{
  "properties": {
    "title": "Project Requirements",
    "tags": ["project", "requirements", "documentation"],
    "status": ["in-progress"],
    "created": "2024-01-20",
    "modified": "2024-01-25",
    "type": ["technical", "specification"],
    "author": "Team Lead",
    "version": "1.0",
    "reviewers": ["Tech Lead", "Product Manager"],
    "priority": "high"
  }
}
```

## Example Use Cases

1. **Metadata Management**
   - Extract note properties
   - Review document metadata
   - Track document status

2. **Content Organization**
   - Get tags for categorization
   - Check document status
   - Review creation/modification dates

3. **Project Tracking**
   - Monitor document versions
   - Track review status
   - Identify document owners

## Notes
- Extracts YAML frontmatter from markdown files
- Returns structured JSON object
- Supports various property types:
  * Strings
  * Arrays
  * Dates
  * Numbers
  * Boolean values
- Common properties:
  * title: Document title
  * tags: Categorization tags
  * status: Document status
  * created/modified: Timestamps
  * type: Content type
  * author: Content creator
  * version: Document version
  * custom fields: Any additional metadata

## Property Types
1. **Basic Properties**
   ```yaml
   title: "Document Title"
   author: "John Doe"
   version: 1.0
   ```

2. **Array Properties**
   ```yaml
   tags: [project, documentation]
   status: [draft, review]
   reviewers: [Alice, Bob]
   ```

3. **Date Properties**
   ```yaml
   created: 2024-01-20
   due: 2024-02-01
   ```

4. **Custom Properties**
   ```yaml
   priority: high
   department: Engineering
   confidential: true