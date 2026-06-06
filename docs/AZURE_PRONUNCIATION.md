# Azure Speech pronunciation assessment

FluentLoop can use Azure Speech Pronunciation Assessment for real word- and
phoneme-level feedback. The browser creates a 16 kHz mono PCM WAV for each
finalized utterance and sends it to the local `/api/pronunciation` endpoint.
The Azure subscription key never reaches the browser.

## Enable the provider

Create an Azure Speech resource, then set its key and region before starting:

```powershell
$env:AZURE_SPEECH_KEY="your-speech-resource-key"
$env:AZURE_SPEECH_REGION="eastus"
$env:AZURE_SPEECH_LANGUAGE="en-US"
npm.cmd start
```

`AZURE_SPEECH_LANGUAGE` is optional and defaults to `en-US`. The `/health`
endpoint reports `"pronunciation": true` when key and region are configured.

## Returned diagnostics

- overall pronunciation score
- accuracy, fluency, completeness, and prosody
- word-level accuracy and error type
- low-scoring IPA phonemes for each word

The UI highlights low-scoring words and phonemes beneath the learner answer. If
Azure is not configured or temporarily unavailable, FluentLoop explicitly
falls back to the browser clarity proxy so the practice session can continue.

Official reference:
[Azure Pronunciation Assessment](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment).
