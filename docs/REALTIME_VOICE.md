# Real-time Voice Conversation

## Controls

- Continuous transcription starts with the training session and can be disabled
  from the conversation header.
- Interim English speech is shown live before a sentence becomes final.
- Final speech is converted into a user message and analyzed automatically.
- Coach speech can be played, paused, resumed, or stopped at any time.
- Chinese translation appears below every Coach message.

## Echo and latency strategy

The browser microphone pauses while Coach text-to-speech is playing to avoid
recognizing speaker audio as the learner's answer. When Coach speech ends or is
stopped, continuous transcription resumes automatically.

This implementation uses browser Web Speech and Speech Synthesis APIs, so it
requires microphone permission and works best in current Chrome or Edge.
