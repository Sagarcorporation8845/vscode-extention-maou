export const log = {
  info: (...args: unknown[]) => console.log('[Maou]', ...args),
  warn: (...args: unknown[]) => console.warn('[Maou]', ...args),
  error: (...args: unknown[]) => console.error('[Maou]', ...args),
};