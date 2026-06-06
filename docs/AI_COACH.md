# Contextual AI Coach

FluentLoop uses a server-side, provider-neutral AI adapter for open-ended
role-play and contextual language feedback. The browser never receives an API
credential.

## Enable Anthropic-compatible AI

The preferred configuration supports Anthropic Messages API-compatible
providers, including the `mimo-v2.5` model:

```powershell
$env:ANTHROPIC_BASE_URL="https://your-compatible-endpoint/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="your-token"
$env:ANTHROPIC_MODEL="mimo-v2.5"
npm.cmd start
```

`ANTHROPIC_API_KEY` is also accepted as an alias for `ANTHROPIC_AUTH_TOKEN`.

The adapter calls `${ANTHROPIC_BASE_URL}/v1/messages`, supports normal and
streaming responses, and sends both `Authorization: Bearer` and `x-api-key`
headers for compatibility with official and proxied Messages API endpoints.

Never commit a real token. `.env` files are ignored by Git, and credentials
should be injected through the server process environment or a deployment
secret manager.

## OpenAI alternative

When `ANTHROPIC_AUTH_TOKEN` is absent, FluentLoop can use the OpenAI Responses
API:

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-5.4-mini"
npm.cmd start
```

When both provider credentials exist, Anthropic-compatible AI takes priority.
The `/health` endpoint reports `ai`, `aiProvider`, and `aiModel` so a reviewer
can confirm the active model without exposing credentials.

## Per-turn contract

The browser sends the selected scene, training goal, latest learner answer, and
up to 12 recent conversation messages to `/api/coach/stream`. The server asks
the model for a structured response containing:

- a short in-character follow-up based on the conversation;
- a Chinese translation;
- contextual grammar and vocabulary scores;
- up to three material corrections with Chinese explanations;
- answer-specific encouragement.

The server forwards model text deltas as NDJSON and ends with a validated final
event. The UI shows the active provider/model and records first-byte time, AI
completion time, pronunciation-assessment time, and total turn latency.

Local measurable signals such as WPM and speech evidence remain calculated
outside the language model. AI feedback augments those metrics instead of
fabricating pronunciation evidence.

## Privacy and failure behavior

- Credentials stay in the server process environment.
- Audio is not sent to the AI Coach endpoint.
- Only transcript text and recent conversation context are sent.
- Failed model calls automatically fall back to the local deterministic coach.
- Browser requests time out after 60 seconds instead of blocking the session.
- Consecutive learner answers are queued, and late replies from a finished
  session are ignored.
- Strict JSON output is requested; a narrow trailing-comma repair handles a
  known compatible-provider formatting edge case.

## Verification

```powershell
npm.cmd run check
npm.cmd run test:e2e
```

Unit tests cover OpenAI and Anthropic-compatible normal/streaming adapters,
credential isolation, structured feedback, malformed-compatible JSON recovery,
and browser fallback behavior.
