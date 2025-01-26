# Patch Content Tool Example

## Request 1 (Update Existing Note)
```json
{
  "filepath": "Projects/Project Alpha/Documentation/Architecture.md",
  "content": "---\ntitle: System Architecture\ntags: [architecture, documentation]\nstatus: [complete]\nmodified: 2024-01-25\n---\n\n# System Architecture\n\n## Overview\nThis document describes the high-level architecture of Project Alpha.\n\n## Components\n\n### Frontend\n- React-based web application\n- Material UI components\n- Redux state management\n\n### Backend\n- Node.js REST API\n- PostgreSQL database\n- Redis caching layer\n\n### Infrastructure\n- AWS cloud hosting\n- Docker containerization\n- CI/CD pipeline\n\n## System Diagram\n![[architecture-diagram.png]]\n\n## Integration Points\n- Authentication service\n- Payment processing\n- Email service\n- Analytics platform\n\n#project-alpha #architecture #technical"
}
```

## Response 1
```json
{
  "success": true,
  "message": "File content updated successfully"
}
```

## Request 2 (Create New Note)
```json
{
  "filepath": "Templates/Meeting Note.md",
  "content": "---\ntitle: {{title}}\ndate: {{date}}\nattendees: \ntags: [meeting]\nstatus: [draft]\n---\n\n# {{title}}\n\n## Agenda\n1. \n2. \n3. \n\n## Discussion Points\n- \n\n## Decisions\n- \n\n## Action Items\n- [ ] \n- [ ] \n- [ ] \n\n## Next Steps\n- \n\n## Notes\n- "
}
```

## Response 2
```json
{
  "success": true,
  "message": "File created successfully"
}
```

## Example Use Cases

1. **Document Updates**
   - Complete revision of documentation
   - Update outdated content
   - Replace temporary content with final version

2. **Template Creation**
   - Create note templates
   - Define standardized formats
   - Set up reusable structures

3. **Content Migration**
   - Move and reformat content
   - Update note structure
   - Implement new organization systems

## Notes
- Replaces entire file content or creates new file
- Supports YAML frontmatter
- Handles template variables
- Preserves markdown formatting
- Creates parent directories if needed
- Validates content structure
- File path is relative to vault root
- Useful for major content revisions