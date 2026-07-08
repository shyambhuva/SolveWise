// background.js
// Runs Groq API calls here (not in the content script) so we're not subject
// to leetcode.com's page CSP, and the API key never touches the page context.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ANALYZE_SOLUTION") {
    handleAnalyze(msg.payload).then(sendResponse);
    return true; // keep the message channel open for async response
  }
});

async function handleAnalyze({ title, description, code, language }) {
  try {
    const { groqApiKey, groqModel } = await chrome.storage.sync.get([
      "groqApiKey",
      "groqModel",
    ]);

    if (!groqApiKey) {
      return {
        ok: false,
        error: "No Groq API key set. Click the extension icon to add one.",
      };
    }

    const systemPrompt = `You are a rigorous data structures & algorithms reviewer. \
Given a LeetCode problem and a user's solution, respond with ONLY valid JSON (no markdown fences, no prose) matching exactly this shape:
{
  "userApproach": { "timeComplexity": "O(...)", "spaceComplexity": "O(...)", "summary": "1-2 sentence plain-English description of the logic the user's code actually uses" },
  "optimalApproach": { "name": "short name of the standard optimal technique", "timeComplexity": "O(...)", "spaceComplexity": "O(...)", "summary": "1-2 sentence description of the standard optimal approach" },
  "verdict": "one short sentence comparing the two, e.g. whether the user's solution is already optimal or where it falls short",
  "improvementTip": "one concrete, actionable tip to close the gap, or 'Your solution already matches the optimal approach.' if it does"
}
Be precise about Big-O notation. Base the analysis strictly on the code given, not on assumptions.`;

    const userPrompt = `Problem: ${title}

Problem description:
${description}

Language: ${language}

User's code:
\`\`\`${language}
${code}
\`\`\``;

    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel || DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: `Groq API error (${resp.status}): ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { ok: false, error: "Couldn't parse the AI's response. Try again." };
    }

    return { ok: true, result: parsed };
  } catch (err) {
    return { ok: false, error: err.message || "Unknown error contacting Groq." };
  }
}
