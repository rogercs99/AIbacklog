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

export async function callAI({ system, user, maxTokens, temperature }) {
  const maxTokensRaw = Number.isFinite(maxTokens) ? maxTokens : Number(process.env.AI_MAX_TOKENS);
  const finalMaxTokens =
    Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 1800;
  const temperatureRaw = Number.isFinite(temperature)
    ? temperature
    : Number(process.env.AI_TEMPERATURE);
  const finalTemperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.2;

  if (!shouldUseAxetFlow()) {
    throw new Error("AXET_FLOW_URL is required for Axet Flow provider");
  }

  return sendAxetFlowRequest({
    system,
    user,
    maxTokens: finalMaxTokens,
    temperature: finalTemperature,
  });
}
