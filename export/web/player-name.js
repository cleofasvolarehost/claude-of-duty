/**
 * Title-screen callsign. The match currently registers the human as "YOU";
 * this is the local half that lets a player type something else and keep it
 * across visits. Like play-counter.js it holds no DOM, so it tests in node
 * with a fake storage. Blocked or missing storage falls back to YOU rather
 * than taking the frontend down.
 */

const STORAGE_KEY = 'vibeslops:callsign';
export const DEFAULT_NAME = 'YOU';
export const MAX_NAME_LENGTH = 16;

export function sanitizeName(value) {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned || DEFAULT_NAME;
}

export class PlayerName {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.display = this.read();
  }

  read() {
    try {
      return sanitizeName(this.storage?.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_NAME;
    }
  }

  set(value) {
    this.display = sanitizeName(value);
    try {
      this.storage?.setItem(STORAGE_KEY, this.display);
    } catch {
      // Keep the in-memory name; they simply type it again next visit.
    }
    return this.display;
  }
}

export default PlayerName;
