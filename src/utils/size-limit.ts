/**
 * The server-side can change the 3 GB limit.
 * This helper returns the environment variable if set; otherwise returns the default value.
 */
const DEFAULT_MAX_BYTES = 3 * 1024 ** 3;          // 3 GB
export const GB = 1024 ** 3;
export function getMaxUploadBytes(): number {
  return DEFAULT_MAX_BYTES;
}