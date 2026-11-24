# URJA implementation progress

## Completed

- **Phase 1 — Audit and rebrand:** Rebranded the app and server-facing product text to URJA / URJA AI, updated metadata and setup guidance, and set the package name.
- **Phase 2 — Core UI:** Removed scripted classroom narration, fixed checkpoint scoring and notes behavior, and disabled unfinished account and profile controls with clear availability labels.
- **Phase 3 — Urja AI:** Added a server-side `/api/urja` endpoint using `@google/genai` and `gemini-3.8-flash`. The server reads `GEMINI_API_KEY` from `.env` or the process environment; the client never receives it. Requests include the server-owned Physics lesson, teaching approach, language, and bounded follow-up history, with request-size and per-IP rate limits.
- **AI voice tutor:** Added browser speech recognition for spoken questions, with transcripts inserted into the question field, plus server-generated Gemini voice playback for tutor replies and an optional auto-voice toggle.
- **Mobile classroom fix:** Closing the lesson outline now removes it from hit testing so it cannot block the Ask URJA AI control on narrow screens.
- Preserved the warm ivory, cream, terracotta, and charcoal design.

## Remaining

- A live text tutoring request reached Gemini but the model returned HTTP 503 for temporary high demand. URJA now shows a clear retry message; a successful live text answer and follow-up are still pending model availability.
- Automated browser checks confirmed the microphone control is available, but actual speech capture was not exercised because the test browser did not grant microphone access.
- Later phases such as authentication, persistent profiles and notes, generated lessons, and production deployment are outside this pass.

## Verification

- `corepack pnpm typecheck` passes.
- `corepack pnpm build` passes.
- Browser-tested empty-input validation and the friendly live upstream-error state.
- Browser-tested conversation follow-up history and Hinglish context using a controlled response; verified the request includes the current lesson and selected language.
- Live `/api/urja/voice` returned HTTP 200 with `audio/wav` output; the browser tutor-voice flow also received HTTP 200.
- The Vite dev server is available at `http://127.0.0.1:8443/`.

## Run locally

```powershell
corepack pnpm dev
```
