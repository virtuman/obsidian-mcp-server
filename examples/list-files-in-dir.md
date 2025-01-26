# List Files in Directory Tool Example

## Request
```json
{
  "dirpath": "Projects/Project Alpha"
}
```

## Response
```
Documentation/
  Documentation/Requirements.md
  Documentation/Architecture.md
Notes/
  Notes/Meeting Notes.md
  Notes/Research.md
Resources/
  Resources/Images/
  Resources/References/
tasks.md
timeline.md
```

## Example Use Cases

1. **Project Organization**
   - Browse project-specific files and folders
   - Navigate through project documentation
   - Find relevant project resources

2. **Content Discovery**
   - Locate specific project documents
   - Access meeting notes and research
   - Review project structure

3. **Knowledge Management**
   - Organize project materials
   - Track project documentation
   - Maintain clear folder hierarchies

## Notes
- Returns contents of a specific directory path
- Shows both subdirectories and files
- Directory paths end with a forward slash (/)
- Results are alphabetically sorted
- Empty directories are included in the results
- Path is relative to vault root

## Common Directory Structures
The example shows a typical project organization:
- Documentation/ - Project requirements and architecture
- Notes/ - Meeting notes and research findings
- Resources/ - Project assets and references
- Root level files for quick access to important information