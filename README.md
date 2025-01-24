# Obsidian MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)
[![Version](https://img.shields.io/badge/Version-1.1.0-blue.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Stable-blue.svg)]()

MCP server enabling LLMs to interact with Obsidian vaults through a standardized interface. Provides tools for reading, searching, and modifying notes with built-in security and token management.

The Model Context Protocol (MCP) enables AI models to interact with external tools and resources through a standardized interface. This server implements MCP to provide LLMs with secure, token-aware access to Obsidian vaults.

Requires the Local REST API plugin in Obsidian.

## Features

- **File Operations**: List, read, and modify vault contents
- **Search**: Text-based and JsonLogic queries with context
- **Security**: API key auth, rate limiting, and input validation
- **Token Management**: Automatic counting and smart truncation

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

Optional environment variables:
- `OBSIDIAN_VERIFY_SSL`: Enable SSL verification (default: false)
- `RATE_LIMIT_WINDOW`: Rate limit window in ms (default: 15 minutes)
- `RATE_LIMIT_MAX`: Max requests per window (default: 100)
- `MAX_TOKENS`: Maximum tokens per response (default: 50000)

## Tools

### File Management
```typescript
// List vault contents
obsidian_list_files_in_vault: {}

// List directory contents
obsidian_list_files_in_dir: {
  dirpath: string
}

// Get file contents
obsidian_get_file_contents: {
  filepath: string
}
```

### Search
```typescript
// Text search
obsidian_find_in_file: {
  query: string,
  contextLength?: number
}

// Advanced search
obsidian_complex_search: {
  query: {
    // JsonLogic query
    "glob": ["*.md", {"var": "path"}]
  }
}
```

### Content Modification
```typescript
// Append content
obsidian_append_content: {
  filepath: string,
  content: string
}

// Update content
obsidian_patch_content: {
  filepath: string,
  content: string
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

For bugs and features, create an issue at [https://github.com/cyanheads/obsidian-mcp-server/issues](https://github.com/cyanheads/obsidian-mcp-server/issues).

## License

Apache License 2.0

---

<div align="center">
Built with the Model Context Protocol
</div>
