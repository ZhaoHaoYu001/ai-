# Speech and pronunciation architecture

## Trust levels

FluentLoop never creates a pronunciation score from typed text.

| Level | Evidence | Product label |
| --- | --- | --- |
| None | Typed text only | Not assessed |
| Browser proxy | Speech-recognition confidence plus microphone signal | Browser clarity proxy |
| Professional | Audio evaluated by a phoneme-capable provider | Phoneme-level assessment |

The browser proxy is useful for detecting weak/quiet audio and low recognition
confidence. It must not be interpreted as accent, phoneme, stress, or intonation
accuracy.

## Replaceable service contract

`createSpeechAssessmentClient` accepts an optional endpoint. Each finalized
transcript is paired with the audio chunks captured since the previous
utterance. Without an endpoint
it returns browser evidence. With an endpoint and a real utterance audio blob,
it posts multipart audio plus transcript and normalizes provider results into:

- overall clarity/accuracy
- confidence and signal quality
- word-level diagnostics
- phoneme-level diagnostics
- provider and evidence level

This boundary allows Azure Speech, SpeechSuper, or another pronunciation
provider to be connected without changing the Coach scoring or UI model. If a
configured provider fails, the session continues with an explicitly labeled
browser proxy result.

## Audio lifecycle and privacy

- The browser captures microphone signal with echo cancellation, noise
  suppression, and automatic gain control.
- Session audio is recorded for immediate learner playback.
- Audio remains in an in-memory object URL and is cleared on refresh.
- No audio is uploaded unless a professional assessment endpoint is explicitly
  configured.

## Production next steps

For truly full-duplex conversation, deploy a WebRTC/WebSocket gateway with
streaming STT, an LLM dialogue service, low-latency TTS, and server-side echo
control. The browser implementation remains an offline-friendly fallback.
