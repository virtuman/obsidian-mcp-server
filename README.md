# Obsidian MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)
[![Version](https://img.shields.io/badge/Version-1.1.0-blue.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Stable-blue.svg)]()
[![GitHub](https://img.shields.io/github/stars/cyanheads/obsidian-mcp-server?style=social)](https://github.com/cyanheads/obsidian-mcp-server)

A high-performance Model Context Protocol server designed for LLMs to interact with Obsidian vaults. Built with TypeScript and featuring secure API communication, efficient file operations, and comprehensive search capabilities, it enables AI assistants to seamlessly manage knowledge bases through a clean, flexible tool interface.

## Table of Contents

- [Overview](#overview)
  - [Architecture & Components](#architecture--components)
- [Features](#features)
  - [File Operations](#file-operations)
  - [Search System](#search-system)
  - [Security & Performance](#security--performance)
- [Installation](#installation)
- [Configuration](#configuration)
- [Tools](#tools)
  - [File Management](#file-management)
  - [Search Operations](#search-operations)
  - [Content Modification](#content-modification)
- [Best Practices](#best-practices)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Obsidian MCP Server implements the Model Context Protocol (MCP), enabling standardized communication between LLMs and external systems through:

- **Clients**: Claude Desktop, IDEs, and other MCP-compatible clients
- **Server**: Tools and resources for vault interaction and management
- **LLM Agents**: AI models that leverage the server's knowledge management capabilities

Key capabilities:

- **File System Operations**: Intuitive path-based access with automatic validation
- **Search Functionality**: Text-based and JsonLogic-powered queries with context control
- **Content Management**: Atomic operations with targeted modifications
- **Security Features**: API key authentication, rate limiting, and comprehensive validation
- **Performance Focus**: Efficient caching, token management, and health monitoring

## Features

### File Operations

- **Hierarchical Access**: Path-based file and directory management
- **Content Operations**: Efficient read and write capabilities
- **Atomic Updates**: Safe content modifications
- **Path Validation**: Automatic traversal prevention
- **Resource Management**: Proper cleanup and monitoring

### Search System

- **Text Search**: Efficient full-text search across vaults
- **Complex Queries**: JsonLogic-based advanced filtering
- **Context Control**: Configurable result boundaries
- **Token Management**: Automatic response optimization
- **Performance**: Optimized query processing

### Security & Performance

- **Authentication**: Secure API key validation
- **Rate Limiting**: Configurable request management
- **SSL Security**: Flexible verification options
- **Token Control**: Automatic counting and truncation
- **Resource Cleanup**: Proper shutdown procedures
- **Health Monitoring**: Operation tracking and logging

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

Environment configuration:
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

### Search Operations
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

## License

Apache License 2.0

---

<div align="center">
Built with the Model Context Protocol
</div>
