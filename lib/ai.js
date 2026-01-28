function extractJson(text) {
  if (!text) {
    return null;
  }

  const raw = String(text).trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    // ignore
  }

  const codeFenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of raw.matchAll(codeFenceRegex)) {
    const snippet = String(match?.[1] || "").trim();
    if (!snippet) {
      continue;
    }
    try {
      return JSON.parse(snippet);
    } catch (error) {
      // ignore
    }
  }

  const firstObj = raw.indexOf("{");
  const firstArr = raw.indexOf("[");
  let start = -1;
  let open = "";
  let close = "";
  if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
    start = firstObj;
    open = "{";
    close = "}";
  } else if (firstArr !== -1) {
    start = firstArr;
    open = "[";
    close = "]";
  } else {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        const snippet = raw.slice(start, i + 1);
        try {
          return JSON.parse(snippet);
        } catch (error) {
          return null;
        }
      }
    }
  }

  return null;
}

function hasGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function hasAxetFlowConfigured() {
  return Boolean(
    process.env.AXET_FLOW_URL ||
      process.env.AXET_FLOW_JSON_URL ||
      process.env.AXET_FLOW_CHAT_URL,
  );
}

function shouldUseAxetFlow() {
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase().trim();
  if (provider) {
    return provider === "axetflow" || provider === "axet-flow" || provider === "axet";
  }
  return hasAxetFlowConfigured();
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

async function sendAxetFlowRequest({ system, user, maxTokens, temperature }) {
  const url = process.env.AXET_FLOW_JSON_URL || process.env.AXET_FLOW_URL;
  if (!url) {
    throw new Error("AXET_FLOW_URL is required for Axet Flow provider");
  }

  const headers = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.AXET_FLOW_API_KEY || "";
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const payload = {
    mode: "json",
    system,
    user,
    max_tokens: maxTokens,
    temperature,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`Axet Flow error ${response.status}: ${message}`);
    error.status = response.status;
    error.body = message;
    throw error;
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    data = raw;
  }

  const unpacked = data?.result ?? data?.data ?? data?.payload ?? data;
  if (typeof unpacked === "string") {
    const extracted = extractJson(unpacked);
    if (extracted) {
      return extracted;
    }
    throw new Error("Axet Flow response was not valid JSON");
  }

  if (typeof unpacked?.answer === "string") {
    const extracted = extractJson(unpacked.answer);
    if (extracted) {
      return extracted;
    }
  }

  if (typeof unpacked?.content === "string") {
    const extracted = extractJson(unpacked.content);
    if (extracted) {
      return extracted;
    }
  }

  return unpacked;
}

async function sendRequest({ baseUrl, headers, payload }) {
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
  try {
    return JSON.parse(content);
  } catch (error) {
    const extracted = extractJson(content);
    if (extracted) {
      return extracted;
    }
    throw new Error("AI response was not valid JSON");
  }
}

async function sendGeminiRequest({ system, user, maxTokens, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Gemini provider");
  }

  const model = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.5-flash";
  const baseUrl =
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

  const maxTokensRaw = Number.isFinite(maxTokens) ? maxTokens : Number(process.env.AI_MAX_TOKENS);
  const finalMaxTokens =
    Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 1800;
  const temperatureRaw = Number.isFinite(temperature)
    ? temperature
    : Number(process.env.AI_TEMPERATURE);
  const finalTemperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.2;

  const thinkingBudgetRaw = process.env.GEMINI_THINKING_BUDGET || process.env.AI_THINKING_BUDGET;
  const thinkingBudgetParsed = thinkingBudgetRaw === undefined ? NaN : Number(thinkingBudgetRaw);
  const thinkingBudget =
    Number.isFinite(thinkingBudgetParsed) && thinkingBudgetParsed >= 0
      ? Math.floor(thinkingBudgetParsed)
      : 0;

  const prompt = system
    ? `SYSTEM:\n${system}\n\nUSER:\n${user}`.trim()
    : String(user || "").trim();

  const url = `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const buildBody = (includeThinking) => ({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: finalTemperature,
      maxOutputTokens: finalMaxTokens,
      responseMimeType: "application/json",
      ...(includeThinking ? { thinkingConfig: { thinkingBudget } } : {}),
    },
  });

  const call = async (includeThinking) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(includeThinking)),
    });
    if (!response.ok) {
      const message = await response.text();
      const error = new Error(`AI error ${response.status}: ${message}`);
      error.status = response.status;
      error.body = message;
      throw error;
    }
    return response.json();
  };

  let data;
  try {
    data = await call(true);
  } catch (error) {
    const message = String(error?.body || error?.message || "").toLowerCase();
    if (error?.status === 400 && message.includes("thinking")) {
      data = await call(false);
    } else {
      throw error;
    }
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const content = parts.map((part) => part?.text || "").join("");

  try {
    return JSON.parse(content);
  } catch (error) {
    const extracted = extractJson(content);
    if (extracted) {
      return extracted;
    }
    throw new Error("AI response was not valid JSON");
  }
}

export async function callAI({ system, user, maxTokens, temperature }) {
  const maxTokensRaw = Number.isFinite(maxTokens) ? maxTokens : Number(process.env.AI_MAX_TOKENS);
  const finalMaxTokens =
    Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 1800;
  const temperatureRaw = Number.isFinite(temperature)
    ? temperature
    : Number(process.env.AI_TEMPERATURE);
  const finalTemperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.2;

  if (shouldUseAxetFlow()) {
    return sendAxetFlowRequest({
      system,
      user,
      maxTokens: finalMaxTokens,
      temperature: finalTemperature,
    });
  }

  if (shouldUseGemini()) {
    return sendGeminiRequest({ system, user, maxTokens, temperature });
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

  const basePayload = {
    model,
    temperature: finalTemperature,
    max_tokens: finalMaxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  try {
    return await sendRequest({
      baseUrl,
      headers,
      payload: { ...basePayload, response_format: { type: "json_object" } },
    });
  } catch (error) {
    const message = `${error.body || error.message || ""}`.toLowerCase();
    if (error.status === 400 && message.includes("response_format")) {
      return sendRequest({ baseUrl, headers, payload: basePayload });
    }
    throw error;
  }
}
