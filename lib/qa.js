function cleanPrefix(text = "", prefixRegex) {
  return String(text || "").replace(prefixRegex, "").trim();
}

export function parseQaEntry(entry) {
  if (!entry) {
    return null;
  }
  if (typeof entry === "object" && !Array.isArray(entry)) {
    const question = cleanPrefix(entry.question || entry.q || "", /^Q[:=]\s*/i);
    const answer = cleanPrefix(entry.answer || entry.a || "", /^A[:=]\s*/i);
    if (!question && !answer) return null;
    return { question: question || "", answer: answer || "" };
  }

  const raw = String(entry || "").trim();
  if (!raw) return null;

  // Formats supported:
  // - "Q: ... | A: ..."
  // - "Q: ...\nA: ..."
  // - "..."
  let questionPart = raw;
  let answerPart = "";

  const pipeSplit = raw.split(/\s*\|\s*A[:=]\s*/i);
  if (pipeSplit.length >= 2) {
    questionPart = pipeSplit[0];
    answerPart = pipeSplit.slice(1).join(" ").trim();
  } else if (/\n\s*A[:=]/i.test(raw)) {
    const lineSplit = raw.split(/\n\s*A[:=]\s*/i);
    questionPart = lineSplit[0];
    answerPart = lineSplit.slice(1).join("\n").trim();
  }

  const question = cleanPrefix(questionPart, /^Q[:=]\s*/i);
  const answer = cleanPrefix(answerPart, /^A[:=]\s*/i);
  return { question: question || raw, answer };
}

export function parseQaList(list) {
  const rawList = Array.isArray(list) ? list : [];
  const parsed = rawList.map(parseQaEntry).filter(Boolean);

  const deduped = [];
  const seen = new Set();
  parsed.forEach((qa) => {
    const key = String(qa.question || "").trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push({ question: qa.question.trim(), answer: String(qa.answer || "").trim() });
  });
  return deduped;
}

export function serializeQaList(list) {
  return parseQaList(list).map((qa) => {
    if (qa.answer) {
      return `Q: ${qa.question} | A: ${qa.answer}`;
    }
    return `Q: ${qa.question}`;
  });
}

export function mergeQaLists(existingList, incomingList) {
  const existing = parseQaList(existingList);
  const incoming = parseQaList(incomingList);

  const byKey = new Map();
  existing.forEach((qa) => {
    byKey.set(qa.question.toLowerCase(), { ...qa });
  });

  incoming.forEach((qa) => {
    const key = qa.question.toLowerCase();
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...qa });
      return;
    }
    // Preserve answers if already confirmed.
    if (!current.answer && qa.answer) {
      current.answer = qa.answer;
    }
    if (qa.question.length > current.question.length) {
      current.question = qa.question;
    }
    byKey.set(key, current);
  });

  const ordered = [];
  const seen = new Set();
  existing.forEach((qa) => {
    const key = qa.question.toLowerCase();
    const merged = byKey.get(key);
    if (merged && !seen.has(key)) {
      seen.add(key);
      ordered.push(merged);
    }
  });
  incoming.forEach((qa) => {
    const key = qa.question.toLowerCase();
    const merged = byKey.get(key);
    if (merged && !seen.has(key)) {
      seen.add(key);
      ordered.push(merged);
    }
  });

  return ordered;
}

export function extractAnsweredFacts(list) {
  const qa = parseQaList(list);
  return qa
    .filter((entry) => entry.answer)
    .map((entry) => `${entry.question}: ${entry.answer}`);
}

