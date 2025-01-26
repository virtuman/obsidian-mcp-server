# Append Content Tool Example

## Request 1 (Append to Existing Note)
```json
{
  "filepath": "Projects/Project Alpha/Notes/Meeting Notes.md",
  "content": "\n\n## Team Meeting - 2024-01-25\n\n### Discussion Points\n- Reviewed project timeline\n- Discussed technical challenges\n- Assigned new tasks\n\n### Action Items\n- [ ] Update documentation\n- [ ] Schedule follow-up meeting\n- [ ] Share progress report"
}
```

## Response 1
```json
{
  "success": true,
  "message": "Content appended successfully"
}
```

## Request 2 (Create New Note)
```json
{
  "filepath": "Daily Notes/2024-01-25.md",
  "content": "---\ntitle: Daily Note - January 25, 2024\ntags: [daily-notes]\ndate: 2024-01-25\n---\n\n# Daily Notes\n\n## Tasks\n- [ ] Review project updates\n- [ ] Team meeting at 2 PM\n- [ ] Update documentation\n\n## Notes\n- Started work on new feature\n- Discussed timeline with team\n- Reviewed technical specifications"
}
```

## Response 2
```json
{
  "success": true,
  "message": "File created and content appended successfully"
}
```

## Example Use Cases

1. **Meeting Notes**
   - Add new meeting minutes to existing notes
   - Create structured meeting summaries
   - Track action items and decisions

2. **Daily Notes**
   - Create daily journal entries
   - Add to existing daily logs
   - Maintain consistent note structure

3. **Project Documentation**
   - Add new sections to documentation
   - Update progress logs
   - Append new requirements or specifications

## Notes
- Can append to existing files or create new ones
- Preserves existing content in the file
- Maintains proper markdown formatting
- Supports YAML frontmatter
- Handles various content types:
  * Meeting notes
  * Daily logs
  * Task lists
  * Documentation updates
- File path is relative to vault root
- Creates parent directories if needed