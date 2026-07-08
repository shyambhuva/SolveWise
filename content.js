// content.js — injected on https://leetcode.com/problems/*
// Three features: (1) Analyze button -> Groq TC/SC comparison panel
// (2) Hide difficulty until revealed  (3) Timer-locked hints

(() => {
  const STATE = {
    slug: null,
    settings: {
      analyzeEnabled: true,
      hideDifficultyEnabled: true,
      hintLockEnabled: true,
      timerMinutes: 15,
    },
    timerInterval: null,
  };

  // --- Selectors LeetCode commonly uses. Kept in one place so they're easy
  // to update if LeetCode changes its markup without touching the rest of the logic.
  const SEL = {
    codeLines: ".view-lines",
    difficultyCandidates: "div, span",
    hintTriggerText: /hint/i,
  };

  function getSlugFromUrl() {
    const m = location.pathname.match(/\/problems\/([^\/]+)/);
    return m ? m[1] : null;
  }

  function getProblemTitle() {
    const el = document.querySelector('[data-cy="question-title"]') ||
      document.querySelector("a[href*='/problems/']") ||
      document.querySelector("div.text-title-large");
    if (el && el.textContent.trim()) return el.textContent.trim();
    // fallback: derive from slug
    return STATE.slug ? STATE.slug.replace(/-/g, " ") : document.title;
  }

  function getProblemDescription() {
    const candidates = [
      '[data-track-load="description_content"]',
      "div.elfjS", // legacy LC class, best-effort
      "div[class*='question-content']",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 30) {
        return el.textContent.trim().slice(0, 4000);
      }
    }
    // fallback: grab the largest text block on the left pane
    const blocks = Array.from(document.querySelectorAll("div"))
      .filter((d) => d.textContent && d.textContent.length > 200)
      .sort((a, b) => b.textContent.length - a.textContent.length);
    return blocks[0] ? blocks[0].textContent.trim().slice(0, 4000) : "";
  }

  function getUserCode() {
    const lineContainer = document.querySelector(SEL.codeLines);
    if (!lineContainer) return "";
    return Array.from(lineContainer.querySelectorAll(".view-line"))
      .map((l) => l.textContent.replace(/\u00a0/g, " "))
      .join("\n");
  }

  function getLanguage() {
    const btn = document.querySelector("button[id*='lang']") ||
      Array.from(document.querySelectorAll("button")).find((b) =>
        /python|java|c\+\+|javascript|typescript|c#|go|rust|kotlin|swift/i.test(b.textContent)
      );
    return btn ? btn.textContent.trim() : "unknown";
  }

  // ---------- Difficulty hiding ----------
  function setupDifficultyHiding() {
    if (!STATE.settings.hideDifficultyEnabled) return;
    const nodes = Array.from(document.querySelectorAll(SEL.difficultyCandidates));
    const target = nodes.find((n) => {
      const t = n.textContent.trim();
      return (t === "Easy" || t === "Medium" || t === "Hard") && n.children.length === 0;
    });
    if (!target || target.dataset.lcaProcessed) return;
    target.dataset.lcaProcessed = "1";

    const originalText = target.textContent.trim();
    const wrapper = document.createElement("span");
    wrapper.className = "lca-difficulty-wrapper";

    const badge = document.createElement("button");
    badge.className = "lca-difficulty-badge";
    badge.textContent = "🔒 Reveal difficulty";
    badge.title = "Click to reveal the difficulty";

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      badge.replaceWith(document.createTextNode(originalText));
    });

    target.textContent = "";
    target.appendChild(badge);
  }

  // ---------- Hint locking ----------
  function getTimerStorageKey() {
    return `lca_timer_${STATE.slug}`;
  }

  async function getTimerState() {
    const key = getTimerStorageKey();
    const data = await chrome.storage.local.get([key]);
    return data[key] || null;
  }

  async function ensureTimerStarted() {
    const key = getTimerStorageKey();
    let state = await getTimerState();
    if (!state) {
      state = { startedAt: Date.now() };
      await chrome.storage.local.set({ [key]: state });
    }
    return state;
  }

  function remainingMs(state) {
    const durationMs = STATE.settings.timerMinutes * 60 * 1000;
    const elapsed = Date.now() - state.startedAt;
    return Math.max(0, durationMs - elapsed);
  }

  function formatTime(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function setupHintLock() {
    if (!STATE.settings.hintLockEnabled) return;
    const state = await ensureTimerStarted();

    if (document.getElementById("lca-hint-widget")) return; // already injected

    const widget = document.createElement("div");
    widget.id = "lca-hint-widget";
    widget.className = "lca-hint-widget";
    widget.innerHTML = `
      <div class="lca-hint-ring">
        <svg viewBox="0 0 40 40" class="lca-ring-svg">
          <circle cx="20" cy="20" r="17" class="lca-ring-bg"></circle>
          <circle cx="20" cy="20" r="17" class="lca-ring-fg" id="lca-ring-fg"></circle>
        </svg>
        <span class="lca-lock-icon" id="lca-lock-icon">🔒</span>
      </div>
      <div class="lca-hint-text">
        <div class="lca-hint-label">HINTS LOCKED</div>
        <div class="lca-hint-time" id="lca-hint-time">--:--</div>
      </div>
    `;
    document.body.appendChild(widget);

    const circumference = 2 * Math.PI * 17;
    const ringFg = document.getElementById("lca-ring-fg");
    ringFg.style.strokeDasharray = `${circumference}`;

    const durationMs = STATE.settings.timerMinutes * 60 * 1000;

    function tick() {
      const left = remainingMs(state);
      const timeEl = document.getElementById("lca-hint-time");
      const lockIcon = document.getElementById("lca-lock-icon");
      const label = widget.querySelector(".lca-hint-label");

      if (left <= 0) {
        timeEl.textContent = "unlocked";
        lockIcon.textContent = "🔓";
        label.textContent = "HINTS UNLOCKED";
        widget.classList.add("lca-unlocked");
        ringFg.style.strokeDashoffset = "0";
        clearInterval(STATE.timerInterval);
        return;
      }
      timeEl.textContent = formatTime(left);
      const progress = 1 - left / durationMs;
      ringFg.style.strokeDashoffset = `${circumference * (1 - progress)}`;
    }

    tick();
    STATE.timerInterval = setInterval(tick, 1000);

    // Block clicks on anything that looks like a hint trigger until unlocked
    document.addEventListener(
      "click",
      async (e) => {
        const state2 = await getTimerState();
        if (!state2 || remainingMs(state2) <= 0) return; // unlocked, allow
        const el = e.target.closest("button, a, div[role='button'], summary");
        if (el && SEL.hintTriggerText.test(el.textContent) && el.textContent.length < 40) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          flashWidget();
        }
      },
      true
    );

    function flashWidget() {
      widget.classList.add("lca-shake");
      setTimeout(() => widget.classList.remove("lca-shake"), 400);
    }
  }

  // ---------- Analyze panel ----------
  function setupAnalyzeButton() {
    if (!STATE.settings.analyzeEnabled) return;
    if (document.getElementById("lca-analyze-btn")) return;

    const btn = document.createElement("button");
    btn.id = "lca-analyze-btn";
    btn.className = "lca-analyze-btn";
    btn.innerHTML = `<span class="lca-btn-icon">⌁</span> Analyze`;
    btn.addEventListener("click", runAnalysis);
    document.body.appendChild(btn);
  }

  function ensurePanel() {
    let panel = document.getElementById("lca-panel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "lca-panel";
    panel.className = "lca-panel";
    panel.innerHTML = `
      <div class="lca-panel-header">
        <span>COMPLEXITY ANALYSIS</span>
        <button class="lca-panel-close" id="lca-panel-close">✕</button>
      </div>
      <div class="lca-panel-body" id="lca-panel-body"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#lca-panel-close").addEventListener("click", () => {
      panel.classList.remove("lca-open");
    });
    return panel;
  }

  function renderLoading(panel) {
    panel.querySelector("#lca-panel-body").innerHTML = `
      <div class="lca-loading">
        <div class="lca-spinner"></div>
        <div>Analyzing with Groq…</div>
      </div>
    `;
  }

  function renderError(panel, message) {
    panel.querySelector("#lca-panel-body").innerHTML = `
      <div class="lca-error">${escapeHtml(message)}</div>
    `;
  }

  function renderResult(panel, result) {
    const { userApproach, optimalApproach, verdict, improvementTip } = result;
    panel.querySelector("#lca-panel-body").innerHTML = `
      <div class="lca-scoreboard">
        <div class="lca-score-col">
          <div class="lca-score-label">YOURS</div>
          <div class="lca-score-tc">${escapeHtml(userApproach.timeComplexity)}</div>
          <div class="lca-score-sc">SC ${escapeHtml(userApproach.spaceComplexity)}</div>
        </div>
        <div class="lca-score-divider">VS</div>
        <div class="lca-score-col lca-score-optimal">
          <div class="lca-score-label">OPTIMAL</div>
          <div class="lca-score-tc">${escapeHtml(optimalApproach.timeComplexity)}</div>
          <div class="lca-score-sc">SC ${escapeHtml(optimalApproach.spaceComplexity)}</div>
        </div>
      </div>
      <div class="lca-section">
        <div class="lca-section-title">Your logic</div>
        <div class="lca-section-text">${escapeHtml(userApproach.summary)}</div>
      </div>
      <div class="lca-section">
        <div class="lca-section-title">Standard approach: ${escapeHtml(optimalApproach.name)}</div>
        <div class="lca-section-text">${escapeHtml(optimalApproach.summary)}</div>
      </div>
      <div class="lca-verdict">${escapeHtml(verdict)}</div>
      <div class="lca-tip"><strong>Tip:</strong> ${escapeHtml(improvementTip)}</div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  async function runAnalysis() {
    const panel = ensurePanel();
    panel.classList.add("lca-open");
    renderLoading(panel);

    const payload = {
      title: getProblemTitle(),
      description: getProblemDescription(),
      code: getUserCode(),
      language: getLanguage(),
    };

    if (!payload.code || payload.code.trim().length < 3) {
      renderError(panel, "Couldn't find any code in the editor. Write a solution first, then click Analyze.");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "ANALYZE_SOLUTION", payload },
      (response) => {
        if (!response) {
          renderError(panel, "No response from the extension. Try reloading the page.");
          return;
        }
        if (!response.ok) {
          renderError(panel, response.error);
          return;
        }
        renderResult(panel, response.result);
      }
    );
  }

  // ---------- Init & SPA navigation handling ----------
  async function loadSettings() {
    const stored = await chrome.storage.sync.get([
      "analyzeEnabled",
      "hideDifficultyEnabled",
      "hintLockEnabled",
      "timerMinutes",
    ]);
    STATE.settings = {
      analyzeEnabled: stored.analyzeEnabled ?? true,
      hideDifficultyEnabled: stored.hideDifficultyEnabled ?? true,
      hintLockEnabled: stored.hintLockEnabled ?? true,
      timerMinutes: stored.timerMinutes ?? 15,
    };
  }

  function teardownPageWidgets() {
    document.getElementById("lca-hint-widget")?.remove();
    document.getElementById("lca-analyze-btn")?.remove();
    document.getElementById("lca-panel")?.remove();
    if (STATE.timerInterval) clearInterval(STATE.timerInterval);
  }

  async function init() {
    const newSlug = getSlugFromUrl();
    if (!newSlug) return;
    if (newSlug === STATE.slug) return; // no real navigation
    STATE.slug = newSlug;

    teardownPageWidgets();
    await loadSettings();

    // Give LeetCode's React app a moment to render the problem UI
    setTimeout(() => {
      setupAnalyzeButton();
      setupDifficultyHiding();
      setupHintLock();
    }, 1200);
  }

  init();

  // LeetCode is a SPA — watch for URL changes between problems
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      init();
    } else {
      // re-check periodically in case difficulty/hint elements render late
      setupDifficultyHiding();
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
