# Obsidian MCP Server Tool Examples

This directory contains example requests and responses for each tool provided by the obsidian-mcp-server. These examples demonstrate the capabilities and expected output format of each tool.

## Tools

### 1. [List Files in Vault](list-files-in-vault.md)
Lists all files and directories in the root directory of your Obsidian vault. Returns a hierarchical structure of files and folders, including metadata like file type.

### 2. [List Files in Directory](list-files-in-dir.md)
Lists all files and directories that exist in a specific Obsidian directory. Returns a hierarchical structure showing files, folders, and their relationships.

### 3. [Get File Contents](get-file-contents.md)
Return the content of a single file in your vault. Supports markdown files, text files, and other readable formats.

### 4. [Find in File](find-in-file.md)
Full-text search across all files in the vault. Returns matching files with surrounding context for each match.

### 5. [Append Content](append-content.md)
Append content to a new or existing file in the vault. Useful for adding new sections, notes, or updates to existing documents.

### 6. [Patch Content](patch-content.md)
Update the entire content of an existing note or create a new one. Provides complete control over file contents.

### 7. [Complex Search](complex-search.md)
File path pattern matching using JsonLogic queries. Supports operations like glob pattern matching and variable access.

### 8. [Get Properties](get-properties.md)
Get properties (title, tags, status, etc.) from an Obsidian note's YAML frontmatter. Returns all available properties including custom fields.

### 9. [Update Properties](update-properties.md)
Update properties in an Obsidian note's YAML frontmatter. Intelligently merges arrays and handles custom fields.

## Resources

### Direct Resources
- obsidian://tags - List of all tags used across the Obsidian vault with their usage counts

## Production Readiness

All tools have been tested and demonstrate:
- Proper input validation and error handling
- Comprehensive and well-structured responses
- Consistent output formatting
- Practical applicability to real-world Obsidian vault management
- Deep integration with Obsidian's features and capabilities

The examples serve as both documentation and test cases, showing the expected behavior and quality of responses for each tool.