/**
 * File operation tools exports
 */
export * from './list.js';
export * from './content.js';

import { ObsidianClient } from '../../obsidian/client.js';
import { 
  ListFilesInVaultToolHandler, 
  ListFilesInDirToolHandler 
} from './list.js';
import { 
  GetFileContentsToolHandler, 
  AppendContentToolHandler, 
  PatchContentToolHandler 
} from './content.js';

/**
 * Create all file-related tool handlers
 * @param client The ObsidianClient instance
 * @returns Array of file tool handlers
 */
export function createFileToolHandlers(client: ObsidianClient) {
  return [
    new ListFilesInVaultToolHandler(client),
    new ListFilesInDirToolHandler(client),
    new GetFileContentsToolHandler(client),
    new AppendContentToolHandler(client),
    new PatchContentToolHandler(client)
  ];
}