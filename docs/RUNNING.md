# Running FluentLoop locally

## Windows quick start

Double-click `start-fluentloop.cmd`. The launcher will:

1. Check whether FluentLoop is already running.
2. Start it safely in the background when needed.
3. Wait for the `/health` endpoint to report ready.
4. Open `http://127.0.0.1:4173` in the default browser.

The launcher window can be closed after it reports ready. Running the launcher
again will reuse the healthy existing service instead of failing because port
`4173` is occupied.

## Command-line start

```powershell
npm.cmd start
```

Keep the command running while using FluentLoop. This foreground command is
useful when you want to see server logs.

## Verification

```powershell
npm.cmd run check
```

This runs unit tests, server integration tests, and JavaScript syntax checks.
