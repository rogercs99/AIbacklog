function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildTf(tokens) {
  const tf = new Map();
  tokens.forEach((token) => {
    tf.set(token, (tf.get(token) || 0) + 1);
  });
  return tf;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let aSum = 0;
  let bSum = 0;
  a.forEach((value, key) => {
    aSum += value * value;
    const bVal = b.get(key) || 0;
    dot += value * bVal;
  });
  b.forEach((value) => {
    bSum += value * value;
  });
  if (aSum === 0 || bSum === 0) {
    return 0;
  }
  return dot / (Math.sqrt(aSum) * Math.sqrt(bSum));
}

export function selectTopChunks(chunks, query, k = 4) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return chunks.slice(0, k);
  }

  const docs = chunks.map((chunk) => tokenize(`${chunk.title}\n${chunk.content}`));
  const docFreq = new Map();
  docs.forEach((tokens) => {
    const unique = new Set(tokens);
    unique.forEach((token) => {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    });
  });

  const idf = new Map();
  const totalDocs = docs.length;
  docFreq.forEach((count, token) => {
    idf.set(token, Math.log((totalDocs + 1) / (count + 1)) + 1);
  });

  const queryTf = buildTf(queryTokens);
  const queryVector = new Map();
  queryTf.forEach((count, token) => {
    queryVector.set(token, count * (idf.get(token) || 1));
  });

  const scored = chunks.map((chunk, index) => {
    const tf = buildTf(docs[index]);
    const vector = new Map();
    tf.forEach((count, token) => {
      vector.set(token, count * (idf.get(token) || 1));
    });
    return {
      chunk,
      score: cosineSimilarity(queryVector, vector),
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => item.chunk);
}
