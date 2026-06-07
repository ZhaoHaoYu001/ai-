# Explicit Voice Turns

## Phone-call mode

The default interaction now presents the existing explicit learner turns as a
continuous AI phone call:

1. Entering a scene connects the call and plays the Coach opening.
2. When Coach playback ends, FluentLoop automatically starts the learner turn.
3. A local voice-activity gate requires roughly 750 ms of sustained speech or
   a live transcript, keeps the turn open for at least 2.5 seconds, then treats
   roughly 2.4 seconds of silence as the end of the answer.
4. The completed turn is transcribed, assessed, corrected, and sent to the AI.
5. The AI response is played and the next learner turn starts automatically.

Short noise bursts and brief thinking pauses do not immediately submit the
turn. The gate never submits silence before the learner has spoken. A manual
**Finish turn** control remains available when background noise prevents clean
silence detection. **Hang up and view report** ends the call and generates the
same measurable learning report, recording playback, and next-step guidance.

When the live transcript already contains at least eight words and the learner
has spoken for more than four seconds, the silence window adapts from roughly
2.4 seconds to 1.8 seconds. Short answers and turns without a transcript retain
the safer 2.4-second window.

Grammar, expression, and pronunciation feedback appears only after the learner
finishes a turn, so coaching remains precise without interrupting speech.

If the learner hangs up while a voice turn, transcription, pronunciation
assessment, or Coach analysis is still active, FluentLoop finishes and saves
that last turn before generating the report. It does not play another Coach
reply while the session is closing.

## Interaction model

FluentLoop uses an explicit, half-duplex learner-turn pattern instead of an
always-on microphone:

1. The learner clicks **Start voice answer**.
2. Browser SpeechRecognition and microphone audio are collected for the current turn.
3. Pauses and browser recognition restarts do not submit partial answers.
4. Final and interim transcript segments remain visible and are accumulated.
5. The learner clicks **Finish answer and send** once the answer is complete.
6. If browser recognition returned no text, the recorded WAV turn is sent to
   the protected server transcription endpoint.
7. One transcript, one learner-audio segment, and one assessment request are
   submitted to the AI Coach.

This interaction is similar to push-to-talk and voice-assistant turn taking. It
is more predictable in classrooms, shared rooms, and other environments where
an always-on microphone can capture unrelated speech.

## In-turn speaking scaffold

Starting a recording does not remove learning support. A persistent reference
card remains visible above the controls and provides:

- the current Coach question;
- correct sentence starters for structuring an answer;
- useful scenario vocabulary;
- one natural example answer.

The reference card is read-only during recording, so it cannot overwrite or
submit the learner's active voice turn. The separate correction-demo button is
disabled during recording because it intentionally contains mistakes for
showing the feedback system.

## Recognition lifecycle

The Web Speech API exposes `continuous`, but browser recognition services may
still end a recognition session. FluentLoop treats that as an internal
transport event:

- the visible learner turn remains active;
- finalized transcript text remains in the turn buffer;
- any interim text is preserved before reconnecting;
- recognition restarts silently after a short delay;
- only an explicit learner action sends the answer.

This avoids the old start/stop UI loop and prevents one spoken answer from
becoming several short AI messages.

When supported by the browser, FluentLoop prepares the `en-US` on-device
recognition language pack and sets `processLocally`. This avoids depending on
the browser vendor's remote recognition service. If browser recognition still
returns no text, the server automatically falls back to Azure Speech-to-Text
using the same 16 kHz WAV segment used for pronunciation assessment.

References:

- [Web Speech API specification](https://webaudio.github.io/web-speech-api/)
- [MDN SpeechRecognition](https://developer.mozilla.org/docs/Web/API/SpeechRecognition)

## Audio boundaries and feedback

Microphone permission is requested only when the learner starts a voice answer.
The audio-capture adapter marks the start of each learner turn, so
pronunciation assessment receives only that turn rather than Coach playback or
waiting time. Coach text-to-speech is disabled while a learner turn is active.

Speech transcription starts immediately from the learner's click. Microphone
audio capture is initialized in parallel because a browser permission prompt or
slow device startup must not block transcript collection. The UI reports
whether audio capture is connecting, ready, or unavailable.

If a microphone request remains unresolved for eight seconds, FluentLoop
degrades pronunciation assessment for that turn and closes any media stream
that arrives after the timeout. Speech transcription and the text-input
fallback remain available.

When microphone audio capture is unavailable but browser speech recognition
still works, FluentLoop keeps the transcript flow usable and clearly explains
that pronunciation evidence is unavailable. Text input remains the final
fallback.

Configure the mature server fallback with `AZURE_SPEECH_KEY` and
`AZURE_SPEECH_REGION`. Secrets remain on the server; learner audio is uploaded
only after the learner explicitly finishes a voice answer.

## Verification

The Chromium E2E suite simulates a stalled microphone permission request and a
browser recognition service ending during a learner answer. It verifies that
transcription starts without waiting for audio capture, reconnects, preserves
both speech segments, and sends exactly one explicit learner turn.
