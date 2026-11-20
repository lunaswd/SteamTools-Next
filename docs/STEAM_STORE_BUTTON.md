# Steam Store Button

The optional Millennium theme adds a `SteamTools 入库` button below the cart action on Steam product pages. It sends only the page AppID to SteamTools Next; the desktop app shows a confirmation and then uses its existing catalog import settings.

## Install

1. Install Millennium for the Steam client and close Steam.
2. Download and extract `steamtools-next-store-button-<version>.zip` from the SteamTools Next GitHub Release. Copy the extracted `steamtools-next-store-button` folder into `<Steam folder>/millennium/themes/`.
3. Start Steam and enable **SteamTools Next Store Button** in Millennium's Themes page. Reload the Steam UI if prompted.
4. Start the updated SteamTools Next app once. On Windows it registers the `steamtoolsnext://` link handler for the current executable.

The button appears only on `store.steampowered.com/app/<AppID>/` pages where Steam renders a purchase or play action. It is placed immediately below that action area. A click opens SteamTools Next and asks for confirmation before importing.

## Behavior

- Uses the selected Steam directory and the existing depot-key or remote-package import mode.
- Does not overwrite an existing Lua entry for the AppID.
- Imports a local Lua configuration only; it does not purchase a game or add an official license to a Steam account.
- The app accepts only the `steamtoolsnext://catalog-add?appid=<number>` link shape. Paths, other query values, and non-AppID input are discarded.

## Remove

Disable the theme in Millennium, then remove the `steamtools-next-store-button` folder from its `themes` directory. The URI handler remains registered while SteamTools Next is installed because the desktop app uses it for the add-on handoff.
