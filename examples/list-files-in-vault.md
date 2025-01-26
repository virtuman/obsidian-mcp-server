# List Files in Vault Tool Example

## Request
```json
{
  "type": "object",
  "properties": {}
}
```

## Response
```
Areas/
  Areas/Work/
  Areas/Personal/
  Areas/Projects/
Resources/
  Resources/Templates/
  Resources/Attachments/
Daily Notes/
  Daily Notes/2024-01-25.md
Projects/
  Projects/Project Alpha/
  Projects/Project Beta/
Archive/
README.md
index.md
```

## Example Use Cases

1. **Vault Organization**
   - Get a complete overview of your vault structure
   - Identify main areas and categories
   - Plan content organization

2. **Content Management**
   - Find important directories and files
   - Review vault hierarchy
   - Locate specific resources

3. **Navigation**
   - Quick access to key areas
   - Browse through project directories
   - Find templates and resources

## Notes
- The tool returns both files and directories at the root level
- Directory paths end with a forward slash (/)
- File extensions are preserved in the output
- Results are alphabetically sorted
- Special characters in filenames are preserved
- Provides a hierarchical view of your vault structure