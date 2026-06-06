# FluentLoop submission checklist

Use this checklist before the final competition submission. Keep every claim in
the README and demo honest and reproducible from the public `main` branch.

## Required deliverables

- [x] Public GitHub repository
- [x] README with product, architecture, running, testing, dependencies, and originality
- [ ] Publicly accessible demo video link added to the top of `README.md`

## Repository validation

Run from a fresh clone:

```powershell
npm.cmd run check
npm.cmd start
```

Then verify:

- [ ] GitHub Actions is green on `main`
- [ ] `git status` is clean
- [ ] No API keys, credentials, recordings, or personal data are committed
- [ ] Every feature PR targets `main` and has a complete description
- [ ] All commit timestamps are inside the selected competition batch

## Product demo validation

- [ ] Select each available scene
- [ ] Complete the text fallback flow without an API key
- [ ] Complete a microphone flow in current Chrome or Edge
- [ ] Show interim speech transcription and Coach playback controls
- [ ] Explain that browser clarity is a proxy, not phoneme accuracy
- [ ] Show contextual AI mode and the offline fallback label
- [ ] Finish a session and show recording playback, personalized insights, and growth calendar

## Demo video

Record a 4–6 minute video with spoken narration. Follow `docs/DEMO_SCRIPT.md`,
upload the result to an accessible platform, verify it plays without login, and
replace the pending demo-video text at the top of `README.md` with the URL.
