# Explicit Voice Turns

## Interaction model

FluentLoop uses an explicit, half-duplex learner-turn pattern instead of an
always-on microphone:

1. The learner clicks **Start voice answer**.
2. SpeechRecognition and microphone audio are collected for the current turn.
3. Pauses and browser recognition restarts do not submit partial answers.
4. Final and interim transcript segments remain visible and are accumulated.
5. The learner clicks **Finish answer and send** once the answer is complete.
6. One transcript, one learner-audio segment, and one assessment request are
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

## Verification

The Chromium E2E suite simulates a stalled microphone permission request and a
browser recognition service ending during a learner answer. It verifies that
transcription starts without waiting for audio capture, reconnects, preserves
both speech segments, and sends exactly one explicit learner turn.
