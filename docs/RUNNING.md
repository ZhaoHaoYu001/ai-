# Running FluentLoop locally

## Windows quick start

Double-click `start-fluentloop.cmd` and keep the terminal window open. Then visit:

- App: `http://127.0.0.1:4173`
- Health check: `http://127.0.0.1:4173/health`

Closing the terminal stops the local server, so the browser will show
`ERR_CONNECTION_REFUSED`.

## Command-line start

```powershell
npm.cmd start
```

Keep the command running while using FluentLoop. If port `4173` is already
occupied, the server prints a clear diagnostic instead of silently exiting.

## Verification

```powershell
npm.cmd run check
```

This runs unit tests, server integration tests, and JavaScript syntax checks.
