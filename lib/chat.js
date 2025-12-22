async function sendChatRequest({ baseUrl, headers, payload }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`AI error ${response.status}: ${message}`);
    error.status = response.status;
    error.body = message;
    throw error;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { answer: content };
}

function hasGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function shouldUseGemini() {
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase().trim();
  if (provider) {
    return provider === "gemini";
  }
  const hasOpenAiCompatible =
    Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY) ||
    Boolean(process.env.LOCAL_AI_URL || process.env.AI_BASE_URL);
  return !hasOpenAiCompatible && hasGeminiConfigured();
}

async function sendGeminiChatRequest({ system, messages }) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Gemini provider");
  }

  const model = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.5-flash";
  const baseUrl =
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

  const maxTokensRaw = Number(process.env.AI_MAX_TOKENS);
  const maxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 1600;
  const temperatureRaw = Number(process.env.AI_TEMPERATURE);
  const temperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.4;

  const transcript = (Array.isArray(messages) ? messages : [])
    .map((msg) => {
      const role = msg?.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${String(msg?.content || "").trim()}`;
    })
    .filter(Boolean)
    .join("\n");

  const prompt = system
    ? `SYSTEM:\n${system}\n\n${transcript}\n\nAssistant:`.trim()
    : `${transcript}\n\nAssistant:`.trim();

  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`AI error ${response.status}: ${message}`);
    error.status = response.status;
    error.body = message;
    throw error;
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { answer: content };
}

export async function callChat({ system, messages }) {
  if (shouldUseGemini()) {
    return sendGeminiChatRequest({ system, messages });
  }

  const baseUrl =
    process.env.AI_BASE_URL ||
    process.env.LOCAL_AI_URL ||
    "https://api.groq.com/openai/v1";
  const model =
    process.env.AI_MODEL ||
    process.env.LOCAL_AI_MODEL ||
    "llama-3.1-8b-instant";
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const allowNoKey = Boolean(process.env.LOCAL_AI_URL || process.env.AI_ALLOW_NO_KEY);
  if (!apiKey && !allowNoKey) {
    throw new Error("AI_API_KEY is required");
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (process.env.OPENAI_ORG) {
    headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
  }
  if (process.env.OPENAI_PROJECT) {
    headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
  }

  const maxTokensRaw = Number(process.env.AI_MAX_TOKENS);
  const maxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 800;
  const temperatureRaw = Number(process.env.AI_TEMPERATURE);
  const temperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.4;

  const chatMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  return sendChatRequest({
    baseUrl,
    headers,
    payload: {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: chatMessages,
    },
  });
}
