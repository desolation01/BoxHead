# BoxHead Internet Multiplayer (ngrok)

Use this when players are outside your local network.

## 0) Authenticate ngrok once

Create/login to ngrok account and copy your authtoken from dashboard.

```powershell
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
```

If you see `ERR_NGROK_4018`, your token/account setup is incomplete.

## 1) Start the game servers locally

```powershell
npm run host
```

This starts:
- web app on `5173`
- relay websocket server on `3001`

## 2) Start one ngrok tunnel

In one terminal:

```powershell
ngrok http 5173
```

```powershell
You will get one public HTTPS URL for the game page.
The relay websocket is proxied via `/relay`.

## 3) What to share with players

1. Share the ngrok page URL so players can open the game page in browser.
2. In Join Game, players paste the same ngrok page URL into Relay URL/host.

Example:
- page link: `https://cool-page.ngrok-free.app`
- relay input in game: `https://cool-page.ngrok-free.app` (auto-converted to `wss://.../relay`)

## 4) Host flow

1. Host opens page URL and presses `Host Game`.
2. Players open page URL and press `Join Game`.
3. Players enter the same page URL in the relay field and connect.

## Notes

- Keep all host/ngrok terminals running.
- Free ngrok URLs can change each restart.
- If someone cannot connect, verify they entered the full `https://` ngrok page URL in the relay field.
