const HEADING_REGEX = /^\s*(\d+(?:\.\d+)*|[A-ZÁÉÍÓÚÑ\s]{4,}|#{1,6})[\s.-]+(.+)/;
const FALLBACK_SIZE = 1200;

function formatChunkId(index) {
  return `CH-${String(index + 1).padStart(2, "0")}`;
}

export function chunkText(text) {
  const cleaned = (text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return [];
  }

  const lines = cleaned.split("\n");
  let current = { title: "General", content: [] };
  const chunks = [];

  const pushCurrent = () => {
    if (current.content.length === 0) {
      return;
    }
    chunks.push({
      title: current.title,
      content: current.content.join("\n").trim(),
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const match = trimmed.match(HEADING_REGEX);
    if (match && match[2]) {
      pushCurrent();
      current = { title: match[2].trim(), content: [] };
      return;
    }
    current.content.push(trimmed);
  });

  pushCurrent();

  if (chunks.length === 1 && chunks[0].content.length > FALLBACK_SIZE) {
    const content = chunks[0].content;
    const splitChunks = [];
    for (let i = 0; i < content.length; i += FALLBACK_SIZE) {
      splitChunks.push({
        title: `General ${Math.floor(i / FALLBACK_SIZE) + 1}`,
        content: content.slice(i, i + FALLBACK_SIZE),
      });
    }
    return splitChunks.map((chunk, index) => ({
      chunk_id: formatChunkId(index),
      chunk_index: index,
      title: chunk.title,
      content: chunk.content,
    }));
  }

  return chunks.map((chunk, index) => ({
    chunk_id: formatChunkId(index),
    chunk_index: index,
    title: chunk.title,
    content: chunk.content,
  }));
}
