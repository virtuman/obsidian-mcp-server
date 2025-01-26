# Get File Contents Tool Example

## Request
```json
{
  "filepath": "Projects/Project Alpha/Documentation/Requirements.md"
}
```

## Response
```markdown
---
title: Project Requirements
tags: [project, requirements, documentation]
status: [in-progress]
created: 2024-01-20
modified: 2024-01-25
---

# Project Requirements Document

## Overview
This document outlines the key requirements for Project Alpha.

## Features
1. User Authentication
   - [ ] Login system
   - [ ] Password recovery
   - [ ] Two-factor authentication

2. Data Management
   - [ ] Database integration
   - [ ] Backup system
   - [x] Data validation

## Related Documents
- [[Architecture Overview]]
- [[Technical Specifications]]
- [[Meeting Notes/Kickoff Meeting]]

## References
![[project-diagram.png]]

#project-alpha #documentation #requirements
```

## Example Use Cases

1. **Content Retrieval**
   - Access note contents for reading or processing
   - Extract metadata from YAML frontmatter
   - Parse markdown formatting

2. **Document Analysis**
   - Review document structure
   - Extract links and references
   - Process task lists and status

3. **Integration**
   - Import content into other systems
   - Process notes programmatically
   - Extract specific sections or metadata

## Notes
- Returns raw markdown content including YAML frontmatter
- Preserves all formatting, links, and special syntax
- Handles various Obsidian-specific markdown features:
  * Wiki-style links: [[Page Name]]
  * Tags: #tag-name
  * Embedded content: ![[file.png]]
  * Task lists: - [ ] todo item
- File path is relative to vault root