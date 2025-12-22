function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return safe;
}

function renderBlock(block) {
  const lines = block.split("\n");
  const listMatch = lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line));
  if (listMatch) {
    const isOrdered = lines.some((line) => /^\s*\d+\.\s+/.test(line));
    const tag = isOrdered ? "ol" : "ul";
    const items = lines
      .map((line) => line.replace(/^\s*([-*]|\d+\.)\s+/, ""))
      .map((line) => `<li>${renderInline(line)}</li>`)
      .join("");
    return `<${tag}>${items}</${tag}>`;
  }

  if (lines.length === 1) {
    const headingMatch = lines[0].match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = renderInline(headingMatch[2]);
      const tag = level === 1 ? "h4" : level === 2 ? "h5" : "h6";
      return `<${tag}>${text}</${tag}>`;
    }
  }

  return `<p>${lines.map(renderInline).join("<br />")}</p>`;
}

function renderMarkdown(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  const blocks = raw.split(/\n{2,}/);
  return blocks.map(renderBlock).join("");
}

export default function RichText({ text, className = "" }) {
  const html = renderMarkdown(text);
  const classes = ["rich-text", className].filter(Boolean).join(" ");
  return <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />;
}
