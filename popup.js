const DEFAULTS = {
  groqApiKey: "",
  groqModel: "llama-3.3-70b-versatile",
  timerMinutes: 15,
  analyzeEnabled: true,
  hideDifficultyEnabled: true,
  hintLockEnabled: true,
};

const els = {
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  timerMinutes: document.getElementById("timerMinutes"),
  analyzeEnabled: document.getElementById("analyzeEnabled"),
  hideDifficultyEnabled: document.getElementById("hideDifficultyEnabled"),
  hintLockEnabled: document.getElementById("hintLockEnabled"),
  saveBtn: document.getElementById("saveBtn"),
  savedMsg: document.getElementById("savedMsg"),
};

async function loadSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const settings = { ...DEFAULTS, ...stored };

  els.apiKey.value = settings.groqApiKey;
  els.model.value = settings.groqModel;
  els.timerMinutes.value = settings.timerMinutes;
  els.analyzeEnabled.checked = settings.analyzeEnabled;
  els.hideDifficultyEnabled.checked = settings.hideDifficultyEnabled;
  els.hintLockEnabled.checked = settings.hintLockEnabled;
}

async function saveSettings() {
  const settings = {
    groqApiKey: els.apiKey.value.trim(),
    groqModel: els.model.value,
    timerMinutes: Math.max(0, parseInt(els.timerMinutes.value, 10) || 0),
    analyzeEnabled: els.analyzeEnabled.checked,
    hideDifficultyEnabled: els.hideDifficultyEnabled.checked,
    hintLockEnabled: els.hintLockEnabled.checked,
  };
  await chrome.storage.sync.set(settings);

  els.savedMsg.classList.add("show");
  setTimeout(() => els.savedMsg.classList.remove("show"), 1500);
}

els.saveBtn.addEventListener("click", saveSettings);
loadSettings();
