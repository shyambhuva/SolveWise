# LeetCode Complexity Analyzer

A Chrome extension for LeetCode with three features:

1. **Analyze** — click the floating "Analyze" button on any problem page to get an AI (Groq) comparison of your code's time/space complexity vs. the standard optimal approach, plus a plain-English explanation of your logic and a tip to close the gap.
2. **Hide difficulty** — the Easy/Medium/Hard label is replaced with a "🔒 Reveal difficulty" badge until you choose to click it.
3. **Timer-locked hints** — set a focus timer (default 15 min, editable). A countdown widget appears bottom-left; clicking anything that looks like a "Hint" is blocked until time's up.

## Install (unpacked, for development/personal use)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`leetcode-analyzer`).
4. Click the extension's icon in your toolbar → paste a free Groq API key from [console.groq.com/keys](https://console.groq.com/keys) → **Save settings**.
5. Go to any `leetcode.com/problems/...` page. You'll see the Analyze button (bottom-right) and the hint timer (bottom-left).

## How it works / architecture

- `manifest.json` — Manifest V3 config.
- `content.js` + `content.css` — injected into LeetCode problem pages; extracts your code from the editor, the problem description, blurs the difficulty label, and renders the hint-lock timer and analysis side panel.
- `background.js` — the service worker that actually calls the Groq API (`api.groq.com`). Keeping the network call here (not in the content script) avoids LeetCode's page CSP and keeps your API key out of page-context JS.
- `popup.html/js/css` — the settings screen (API key, model, timer length, per-feature toggles), styled as a small dark "console."

Your API key is stored via `chrome.storage.sync` (local to your Chrome profile/account) — it's never sent anywhere except directly to `api.groq.com`.

## Known limitations / things to watch

- **LeetCode's DOM changes over time.** The selectors used to find the difficulty label, hint buttons, description text, and code editor lines are the current best-effort match. If LeetCode ships a redesign, you may need to update the `SEL` object at the top of `content.js`. I've included several fallback selectors for exactly this reason.
- **Reading code from the editor** works by reading the visible rendered lines in Monaco's `.view-lines` (LeetCode's code editor component), so it needs the code to actually be visible/rendered on screen — this is normal and not affected by scrolling within reason.
- **Hint locking** blocks clicks on elements whose visible text matches "hint" — this is a heuristic (LeetCode doesn't expose a stable, dedicated hint-button attribute), so on some problem layouts it may need a selector tweak.
- The timer persists per-problem in local extension storage, so reloading the page won't reset your countdown.
