/**
 * Browser storage keys. The preview build (/next/) shares an origin with the
 * live site, so it sets VITE_STORAGE_PREFIX to keep its own keys apart.
 */
export const storageKey = (name: string) => `${import.meta.env.VITE_STORAGE_PREFIX ?? ''}aesthetics:${name}`
