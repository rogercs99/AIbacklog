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

async function sendAxetFlowChatRequest({ system, messages, maxTokens, temperature }) {
  const url = process.env.AXET_FLOW_CHAT_URL || process.env.AXET_FLOW_URL;
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

  const safeMessages = Array.isArray(messages) ? messages : [];
  const lastUser = [...safeMessages]
    .reverse()
    .find((msg) => String(msg?.role || "") === "user")?.content;
  const chatMessages = system
    ? [{ role: "system", content: system }, ...safeMessages]
    : safeMessages;

  const payload = {
    mode: "chat",
    messages: chatMessages,
    max_tokens: maxTokens,
    temperature,
  };
  if (system) {
    payload.system = system;
  }
  if (lastUser) {
    payload.user = lastUser;
  }

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
    return { answer: unpacked };
  }

  const answerCandidate =
    unpacked?.answer ??
    unpacked?.content ??
    unpacked?.message ??
    unpacked?.choices?.[0]?.message?.content;

  if (typeof answerCandidate === "string") {
    return { answer: answerCandidate };
  }

  try {
    return { answer: JSON.stringify(unpacked) };
  } catch (error) {
    return { answer: "" };
  }
}

export async function callChat({ system, messages }) {
  const maxTokensRaw = Number(process.env.AI_MAX_TOKENS);
  const maxTokens = Number.isFinite(maxTokensRaw) && maxTokensRaw > 0 ? maxTokensRaw : 800;
  const temperatureRaw = Number(process.env.AI_TEMPERATURE);
  const temperature =
    Number.isFinite(temperatureRaw) && temperatureRaw >= 0 ? temperatureRaw : 0.4;

  if (!shouldUseAxetFlow()) {
    throw new Error("AXET_FLOW_URL is required for Axet Flow provider");
  }

  return sendAxetFlowChatRequest({ system, messages, maxTokens, temperature });
}
