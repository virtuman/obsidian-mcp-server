# Obsidian MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)
[![Version](https://img.shields.io/badge/Version-1.1.1-blue.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Stable-blue.svg)]()
[![GitHub](https://img.shields.io/github/stars/cyanheads/obsidian-mcp-server?style=social)](https://github.com/cyanheads/obsidian-mcp-server)

A Model Context Protocol server designed for LLMs to interact with Obsidian vaults. Built with TypeScript and featuring secure API communication, efficient file operations, and comprehensive search capabilities, it enables AI assistants to seamlessly manage knowledge bases through a clean, flexible tool interface.

The Model Context Protocol (MCP) enables AI models to interact with external tools and resources through a standardized interface.

Requires the Local REST API plugin in Obsidian.

## Features

### File Operations
- Path-based file/directory management with atomic updates
- Content read/write operations with validation
- Resource monitoring and cleanup

### Search System
- Full-text and JsonLogic-based complex search
- Configurable context boundaries and token limits
- Optimized query processing

### Security & Performance
- API key authentication and rate limiting
- SSL verification options
- Resource management and health monitoring

## Installation

1. Install Node.js (LTS recommended)
2. Enable Local REST API plugin in Obsidian
3. Clone and build:
```bash
git clone git@github.com:cyanheads/obsidian-mcp-server.git
cd obsidian-mcp-server
npm install
npm run build
```

Or install from npm:
```bash
npm install obsidian-mcp-server
```

## Configuration

Add to your MCP client settings:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/obsidian-mcp-server/build/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here",
        "NODE_ENV": "production"
      }
    }
  }
}
```

Environment configuration:
- `OBSIDIAN_VERIFY_SSL`: Enable SSL verification (default: false)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in ms (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 200)
- `MAX_TOKENS`: Maximum tokens per response (default: 20000)
- `TOOL_TIMEOUT_MS`: Tool execution timeout (default: 60000)

## Tools

### File Management
```typescript
// List vault contents
obsidian_list_files_in_vault: {}

// List directory contents
obsidian_list_files_in_dir: {
  dirpath: string  // Path relative to vault root
}

// Get file contents
obsidian_get_file_contents: {
  filepath: string  // Path relative to vault root
}
```

### Search Operations
```typescript
// Text search with context
obsidian_find_in_file: {
  query: string,
  contextLength?: number  // Default: 10
}

// Advanced search with JsonLogic
obsidian_complex_search: {
  query: JsonLogicQuery  // Example: {"glob": ["*.md", {"var": "path"}]}
}
```

### Content Modification
```typescript
// Append to file
obsidian_append_content: {
  filepath: string,  // Path relative to vault root
  content: string    // Content to append
}

// Update file content
obsidian_patch_content: {
  filepath: string,  // Path relative to vault root
  content: string    // New content (replaces existing)
}
```

## Best Practices

### File Operations
- Use atomic operations
- Validate content before modifications
- Implement proper error handling
- Monitor operation performance

### Search Implementation
- Optimize query specificity
- Control context boundaries
- Handle large result sets
- Consider token limits

### Error Prevention
- Validate inputs thoroughly
- Handle API errors gracefully
- Monitor error patterns
- Check rate limits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

For bugs and features, create an issue at [https://github.com/cyanheads/obsidian-mcp-server/issues](https://github.com/cyanheads/obsidian-mcp-server/issues).

## Publishing

The package is automatically published to npm when version tags are pushed:

```bash
# Update version in package.json
npm version patch  # or minor, or major
git push --follow-tags
```

This will trigger the GitHub Action to build and publish the package.

## License

Apache License 2.0

---

<div align="center">
Built with the Model Context Protocol
</div>
