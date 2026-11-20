(() => {
  const rowClass = 'steamtools-next-store-row';
  const buttonClass = 'steamtools-next-store-button';
  const appIdPattern = /^\/app\/([1-9]\d{0,9})(?:\/|$)/;

  function syncButton() {
    const existing = document.querySelector(`.${rowClass}`);
    if (location.hostname !== 'store.steampowered.com') {
      existing?.remove();
      return;
    }
    const match = location.pathname.match(appIdPattern);
    const appId = match ? Number(match[1]) : 0;
    const purchase = document.querySelector('#game_area_purchase');
    const action = purchase?.querySelector('.game_purchase_action');
    if (!appId || appId > 0xffff_ffff || !action) {
      existing?.remove();
      return;
    }

    if (existing?.dataset.appid === String(appId) && existing.parentElement === action.parentElement) return;
    existing?.remove();

    const row = document.createElement('div');
    row.className = rowClass;
    row.dataset.appid = String(appId);

    const link = document.createElement('a');
    link.className = `btn_green_steamui btn_medium ${buttonClass}`;
    link.href = `steamtoolsnext://catalog-add?appid=${appId}`;
    link.textContent = 'SteamTools 入库';
    link.title = '写入 SteamTools Next 本地 Lua 配置；不会添加 Steam 账号许可证。';
    link.setAttribute('aria-label', `将 AppID ${appId} 发送到 SteamTools Next 入库`);
    row.append(link);
    action.insertAdjacentElement('afterend', row);
  }

  const start = () => {
    syncButton();
    new MutationObserver(syncButton).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', syncButton);
    window.addEventListener('hashchange', syncButton);
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
