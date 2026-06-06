# Contextual AI Coach

FluentLoop uses a server-side AI adapter for open-ended role-play and contextual
language feedback. The browser never receives the API key.

## Enable the AI mode

Set the key before starting the local server:

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-5.4-mini"
npm.cmd start
```

`OPENAI_MODEL` is optional. The default is `gpt-5.4-mini`.

The `/health` endpoint reports `"ai": true` when the server-side key is
configured. If the model request fails or no key is configured, the browser
switches to a clearly labeled offline fallback so the demo remains usable.

## Per-turn contract

The browser sends the selected scene, training goal, latest learner answer, and
up to 12 recent conversation messages to `/api/coach`. The server asks the
model for a strict structured response containing:

- a short in-character follow-up based on the conversation;
- a Chinese translation;
- contextual grammar and vocabulary scores;
- up to three material corrections with Chinese explanations;
- answer-specific encouragement.

Local measurable signals such as WPM and speech clarity remain calculated in
the browser. AI feedback augments those metrics instead of fabricating speech
evidence.

## Privacy and failure behavior

- The API key stays in the server process environment.
- Audio is not sent to the AI Coach endpoint.
- Only transcript text and recent conversation context are sent.
- Failed model calls automatically fall back to the local deterministic coach.
- Browser requests time out after 12 seconds and fall back instead of blocking the session.
- Consecutive learner answers are queued, and late replies from a finished session are ignored.
