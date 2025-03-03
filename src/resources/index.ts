/**
 * Resources module exports
 */
export * from './types.js';
export * from './tags.js';

import { ObsidianClient } from '../obsidian/client.js';
import { TagResource } from './tags.js';

/**
 * Create and return the tag resource
 * @param client The ObsidianClient instance
 * @returns The tag resource
 */
export function createTagResource(client: ObsidianClient): TagResource {
  return new TagResource(client);
}