# Phase 4.1: Bot HTML Audit Report (`KSHEtra-Smart-Farming-AI.html` / `fieldwise-mobile.html`)

## 1. Discovered Bot Files

1. **Primary Mobile & Assistant HTML (`fieldwise-mobile.html`)**:
   - **Locations Found**:
     - `C:\Users\Rocky\Documents\fieldwise-mobile.html`
     - `C:\Users\Rocky\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState\sessions\...\transfers\2026-46\fieldwise-mobile.html`
   - **Sanitized Archive Copy**: `docs/legacy/bot.html`
2. **Mission Control HTML (`KSHETRA -mission control.html`)**:
   - **Location Found**: `...\transfers\2026-46\KSHETRA -mission control.html`
3. **Companion Assistant Engine (`Feildwise AI`)**:
   - **Locations Found**:
     - `C:\Users\Rocky\Downloads\Feildwise AI\Feildwise AI\backend\app\engines\assistant.py`
     - `C:\Users\Rocky\Downloads\Feildwise AI\Feildwise AI\frontend\src\components\AssistantChat.tsx`

---

## 2. Technical Audit of Original Bot Implementation

| Dimension | Original Implementation Details | Production Upgrade in Kshetra |
| :--- | :--- | :--- |
| **UI & Layout** | Single-file HTML (`fieldwise-mobile.html`) with `.msgs` scroll container, `.m.u` (user bubble, right-aligned navy) and `.m.a` (assistant bubble, left-aligned cream card), quick-access pill bar, and search input (`id="q"`). | Rebuilt as `frontend/src/components/AssistantChat.tsx` matching Kshetra's forest-green & cream-parchment design system with quick-question chips, parcel-context chips ("Ask about my field"), voice mic input, and read-aloud button. |
| **Provider & Model** | `AgronomicAssistant` in `assistant.py` supports Google Gemini (`gemini-1.5-flash` via `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`), OpenAI (`gpt-4o-mini` via `api.openai.com/v1/chat/completions`), and a deterministic rule-based agronomic fallback (`rule_based_deterministic`). | Preserved all 3 providers (Gemini, OpenAI, and deterministic grounded agronomic engine) plus local Ollama (`OLLAMA_HOST`) behind a clean `AssistantProviderAdapter` interface in `backend/app/services/assistant_service.py`. |
| **System Prompt & Grounding** | Grounds answers in farm coordinates, area, irrigation source, NASA POWER precipitation/temperature/dry-spell observations, ISRIC SoilGrids clay/silt/sand/pH/SOC, and top crop rotation scores. Forbids inventing numbers or recommending chemical pesticide dosages; mandates KVK validation. | Upgraded to ground directly in the authenticated farmer's real parcels, live Open-Meteo & NASA POWER weather snapshots, root-zone soil moisture, crop suitability scores, and APMC market rates, with explicit source & timestamp citations on every message. |
| **History Handling** | In-memory JavaScript array `S.chat = []` inside the browser tab (lost on page reload). | Persisted server-side in SQLite/PostgreSQL (`assistant_messages` table) with 90-day retention, `GET /api/v1/assistant/history`, `DELETE /api/v1/assistant/history`, and full erasure via Profile -> Delete My Data. |
| **Voice & Markdown** | Plain text `white-space: pre-wrap` with manual HTML escaping (`esc()`), no voice input or TTS in the HTML bot. | Added Web Speech API voice input (`webkitSpeechRecognition` / `SpeechRecognition` for `mr-IN`, `hi-IN`, `en-IN`), `speechSynthesis` read-aloud per reply, safe Markdown rendering sanitized with `DOMPurify`, and persistent thumbs up/down feedback per assistant message. |
| **API Key Handling** | No API keys were hard-coded in the HTML files (`fieldwise-mobile.html` calls `POST /api/assistant/chat`). In the companion backend, `GEMINI_API_KEY` and `OPENAI_API_KEY` are read from environment variables. | Browser never calls any external AI provider directly. All requests go through authenticated `POST /api/v1/assistant/chat` with per-farmer rate limiting (20 messages/hour) and daily token budget (15,000 tokens/day). |
