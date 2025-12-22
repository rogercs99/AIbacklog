function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(aTokens, bTokens) {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  if (aSet.size === 0 || bSet.size === 0) {
    return 0;
  }
  let intersection = 0;
  aSet.forEach((token) => {
    if (bSet.has(token)) {
      intersection += 1;
    }
  });
  const union = aSet.size + bSet.size - intersection;
  return intersection / union;
}

export function diffChunks(oldChunks, newChunks, threshold = 0.35) {
  const oldTokens = oldChunks.map((chunk) => tokenize(chunk.content));
  const newTokens = newChunks.map((chunk) => tokenize(chunk.content));

  const matches = new Map();
  const usedOld = new Set();

  newChunks.forEach((chunk, index) => {
    let bestScore = 0;
    let bestIndex = -1;
    oldChunks.forEach((oldChunk, oldIndex) => {
      if (usedOld.has(oldIndex)) {
        return;
      }
      const score = jaccard(newTokens[index], oldTokens[oldIndex]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = oldIndex;
      }
    });
    if (bestScore >= threshold && bestIndex >= 0) {
      matches.set(index, bestIndex);
      usedOld.add(bestIndex);
    }
  });

  const changes = [];
  newChunks.forEach((chunk, index) => {
    const oldIndex = matches.get(index);
    if (oldIndex === undefined) {
      changes.push({
        change_type: "added",
        summary: `Nuevo bloque: ${chunk.title || chunk.chunk_id}`,
        new_chunk_id: chunk.chunk_id,
      });
      return;
    }
    const oldChunk = oldChunks[oldIndex];
    if (oldChunk.content.trim() !== chunk.content.trim()) {
      changes.push({
        change_type: "modified",
        summary: `Bloque actualizado: ${chunk.title || chunk.chunk_id}`,
        old_chunk_id: oldChunk.chunk_id,
        new_chunk_id: chunk.chunk_id,
      });
    }
  });

  oldChunks.forEach((chunk, index) => {
    if (!usedOld.has(index)) {
      changes.push({
        change_type: "removed",
        summary: `Bloque eliminado: ${chunk.title || chunk.chunk_id}`,
        old_chunk_id: chunk.chunk_id,
      });
    }
  });

  return changes;
}
