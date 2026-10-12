// Robust safe storage fallback for iframes and third-party cookie restricted environments

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function createSafeStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      const testKey = '__uper_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch (err) {
    // Third-party cookie blocked or iframe security restriction
    console.warn('[SafeStorage] Direct localStorage blocked by browser security policy. Using memory storage fallback.');
  }
  return new MemoryStorage();
}

export const safeStorage = createSafeStorage();
