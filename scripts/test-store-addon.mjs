import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const script = await readFile(new URL('../addons/millennium/steamtools-next-store-button/steamtools-next-store-button.js', import.meta.url), 'utf8');
const purchaseContent = '<div class="game_area_purchase_game"><div class="game_purchase_action"><div class="game_purchase_action_bg"><div class="game_purchase_price price">$9.99</div><div class="btn_addtocart"><a class="btn_green_steamui btn_medium" role="button"><span>Add to Cart</span></a></div></div></div></div>';
const playContent = '<div class="game_area_purchase_game"><div class="game_purchase_action"><div class="game_purchase_action_bg"><a class="btn_green_steamui btn_medium" role="button"><span>Play Game</span></a></div></div></div>';
const purchaseMarkup = `<div id="game_area_purchase">${purchaseContent}</div>`;

function createSteamPage(url, markup = purchaseMarkup) {
  const window = new Window({ url });
  window.document.body.innerHTML = markup;
  window.eval(script);
  return window;
}

test('injects one SteamTools button directly below the cart action', async () => {
  const window = createSteamPage('https://store.steampowered.com/app/3883050/Monkeys/');
  try {
    const row = window.document.querySelector('.steamtools-next-store-row');
    assert.ok(row);
    assert.equal(row.previousElementSibling?.className, 'game_purchase_action');
    assert.equal(row.dataset.appid, '3883050');
    assert.equal(row.querySelector('a')?.href, 'steamtoolsnext://catalog-add?appid=3883050');
    assert.match(row.querySelector('a')?.title || '', /本地 Lua/);
    await window.happyDOM.whenAsyncComplete();
    assert.equal(window.document.querySelectorAll('.steamtools-next-store-row').length, 1);
  } finally {
    window.happyDOM.abort();
  }
});

test('injects below a play action when the page has no cart button', () => {
  const window = createSteamPage('https://store.steampowered.com/app/440/Team_Fortress_2/', `<div id="game_area_purchase">${playContent}</div>`);
  try {
    const row = window.document.querySelector('.steamtools-next-store-row');
    assert.ok(row);
    assert.equal(row.previousElementSibling?.className, 'game_purchase_action');
    assert.equal(row.dataset.appid, '440');
  } finally {
    window.happyDOM.abort();
  }
});

test('waits for Steam purchase content rendered after the page script', async () => {
  const window = createSteamPage('https://store.steampowered.com/app/3883050/Monkeys/', '<div id="game_area_purchase"></div>');
  try {
    assert.equal(window.document.querySelector('.steamtools-next-store-row'), null);
    window.document.querySelector('#game_area_purchase').innerHTML = purchaseContent;
    await window.happyDOM.whenAsyncComplete();
    assert.equal(window.document.querySelector('.steamtools-next-store-row')?.dataset.appid, '3883050');
  } finally {
    window.happyDOM.abort();
  }
});

test('does not inject outside Steam store product pages', () => {
  const window = createSteamPage('https://example.com/app/3883050/Monkeys/');
  try {
    assert.equal(window.document.querySelector('.steamtools-next-store-row'), null);
  } finally {
    window.happyDOM.abort();
  }
});

test('removes the old button when a store route stops being a product page', async () => {
  const window = createSteamPage('https://store.steampowered.com/app/3883050/Monkeys/');
  try {
    window.history.pushState({}, '', '/search/?term=monkeys');
    window.document.querySelector('#game_area_purchase').remove();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(window.document.querySelector('.steamtools-next-store-row'), null);
  } finally {
    window.happyDOM.abort();
  }
});
