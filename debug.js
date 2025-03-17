#!/usr/bin/env node

// Debug script to run the server with verbose logging
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory from import.meta
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file stream
const logFile = path.join(logsDir, `debug-server-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

console.log(`Starting Obsidian MCP Server in debug mode...`);
console.log(`Logs will be written to: ${logFile}`);

// Environment variables from MCP settings
const env = {
  ...process.env,
  DEBUG_JSONRPC: 'true',
  NODE_ENV: 'development',
  // Required environment variables from MCP settings
  OBSIDIAN_API_KEY: '9bde5e9fb07951daa75819a1704ce75fd597955205141d3b39e5e1423ddbc97c',
  VERIFY_SSL: 'false',
  OBSIDIAN_PROTOCOL: 'https',
  OBSIDIAN_HOST: '127.0.0.1',
  OBSIDIAN_PORT: '27124',
  REQUEST_TIMEOUT: '5000',
  MAX_CONTENT_LENGTH: String(50 * 1024 * 1024),
  MAX_BODY_LENGTH: String(50 * 1024 * 1024),
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '200',
  TOOL_TIMEOUT_MS: '60000'
};

// Start the server process
const serverProcess = spawn('node', ['build/index.js'], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log process output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  logStream.write(`[STDOUT] ${output}`);
});

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  logStream.write(`[STDERR] ${output}`);
});

// Handle process exit
serverProcess.on('exit', (code) => {
  const message = `Server process exited with code ${code}`;
  console.log(message);
  logStream.write(`${message}\n`);
  logStream.end();
});

// Handle errors
serverProcess.on('error', (err) => {
  const message = `Error starting server: ${err.message}`;
  console.error(message);
  logStream.write(`[ERROR] ${message}\n`);
  logStream.end();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  const message = `Uncaught exception: ${err.message}\n${err.stack}`;
  console.error(message);
  logStream.write(`[UNCAUGHT] ${message}\n`);
  logStream.end();
  process.exit(1);
});

// Set up cleanup
const cleanup = () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  logStream.end();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);