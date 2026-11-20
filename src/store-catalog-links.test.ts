import { describe, expect, it, vi } from 'vitest';
import { parseStoreCatalogAddUrl, StoreCatalogImportQueue } from './store-catalog-links';

describe('Steam store catalog deep links',()=>{
  it('accepts one bounded positive AppID on the dedicated scheme and host',()=>{
    expect(parseStoreCatalogAddUrl('steamtoolsnext://catalog-add?appid=3883050')).toBe(3883050);
    expect(parseStoreCatalogAddUrl('steamtoolsnext://catalog-add?appid=4294967295')).toBe(4294967295);
  });

  it.each([
    'https://store.steampowered.com/app/3883050/',
    'steamtoolsnext://other?appid=42',
    'steamtoolsnext://catalog-add/extra?appid=42',
    'steamtoolsnext://catalog-add?appid=42&appid=43',
    'steamtoolsnext://catalog-add?appid=0',
    'steamtoolsnext://catalog-add?appid=-42',
    'steamtoolsnext://catalog-add?appid=4294967296',
    'steamtoolsnext://user@catalog-add?appid=42',
  ])('rejects malformed or out-of-scope URL %s',url=>{
    expect(parseStoreCatalogAddUrl(url)).toBeNull();
  });

  it('waits for initialization and prevents overwriting an existing AppID',async()=>{
    let ready=false;
    const add=vi.fn(async()=>{});
    const onAlreadyPresent=vi.fn();
    const queue=new StoreCatalogImportQueue({
      ready:()=>ready,
      alreadyPresent:appId=>appId===100,
      confirm:()=>true,
      add,
      onAlreadyPresent,
    });
    queue.enqueue(42);
    queue.enqueue(42);
    queue.enqueue(100);
    expect(add).not.toHaveBeenCalled();
    ready=true;
    queue.resume();
    await vi.waitFor(()=>expect(add).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledWith(42);
    expect(onAlreadyPresent).toHaveBeenCalledWith(100);
  });

  it('honors the explicit confirmation decision',async()=>{
    const add=vi.fn(async()=>{});
    const confirm=vi.fn(()=>false);
    const queue=new StoreCatalogImportQueue({ready:()=>true,alreadyPresent:()=>false,confirm,add,onAlreadyPresent:vi.fn()});
    queue.enqueue(42);
    await vi.waitFor(()=>expect(confirm).toHaveBeenCalledWith(42));
    expect(add).not.toHaveBeenCalled();
  });
});
