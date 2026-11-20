import { isTauri } from '@tauri-apps/api/core';

export interface StoreCatalogQueueHandlers {
  ready: () => boolean;
  alreadyPresent: (appId: number) => boolean;
  confirm: (appId: number) => boolean;
  add: (appId: number) => Promise<void>;
  onAlreadyPresent: (appId: number) => void;
}

export function parseStoreCatalogAddUrl(raw: string): number | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'steamtoolsnext:' || url.hostname !== 'catalog-add') return null;
    if (url.username || url.password || url.port || (url.pathname !== '' && url.pathname !== '/') || url.hash) return null;
    const values = url.searchParams.getAll('appid');
    if (values.length !== 1 || !/^[1-9]\d{0,9}$/.test(values[0])) return null;
    const appId = Number(values[0]);
    return Number.isSafeInteger(appId) && appId <= 0xffff_ffff ? appId : null;
  } catch {
    return null;
  }
}

export class StoreCatalogImportQueue {
  private readonly pending: number[] = [];
  private readonly active = new Set<number>();
  private processing = false;

  constructor(private readonly handlers: StoreCatalogQueueHandlers) {}

  enqueue(appId: number): void {
    if (!Number.isInteger(appId) || appId <= 0 || appId > 0xffff_ffff) return;
    if (this.pending.includes(appId) || this.active.has(appId)) return;
    this.pending.push(appId);
    void this.drain();
  }

  resume(): void {
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing || !this.handlers.ready()) return;
    this.processing = true;
    try {
      while (this.pending.length && this.handlers.ready()) {
        const appId = this.pending.shift()!;
        this.active.add(appId);
        try {
          if (this.handlers.alreadyPresent(appId)) {
            this.handlers.onAlreadyPresent(appId);
          } else if (this.handlers.confirm(appId)) {
            await this.handlers.add(appId);
          }
        } finally {
          this.active.delete(appId);
        }
      }
    } finally {
      this.processing = false;
      if (this.pending.length && this.handlers.ready()) queueMicrotask(() => void this.drain());
    }
  }
}

export async function listenForStoreCatalogAddLinks(onAppId: (appId: number) => void): Promise<void> {
  if (!isTauri()) return;
  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  const initialUrls = await getCurrent();
  await onOpenUrl(urls => {
    for (const raw of urls) {
      const appId = parseStoreCatalogAddUrl(raw);
      if (appId !== null) onAppId(appId);
    }
  });
  for (const raw of initialUrls ?? []) {
    const appId = parseStoreCatalogAddUrl(raw);
    if (appId !== null) onAppId(appId);
  }
}
