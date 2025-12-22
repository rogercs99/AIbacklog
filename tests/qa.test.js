import { describe, expect, it } from "vitest";
import { mergeQaLists, parseQaEntry, parseQaList, serializeQaList } from "@/lib/qa";

describe("qa helpers", () => {
  it("parses common QA string formats", () => {
    expect(parseQaEntry("Q: ¿Formato? | A: Una línea por libro")).toEqual({
      question: "¿Formato?",
      answer: "Una línea por libro",
    });
    expect(parseQaEntry("Q: ¿Formato?\nA: Una línea por libro")).toEqual({
      question: "¿Formato?",
      answer: "Una línea por libro",
    });
    expect(parseQaEntry({ question: "Q: ¿Formato?", answer: "A: Una línea" })).toEqual({
      question: "¿Formato?",
      answer: "Una línea",
    });
  });

  it("serializes and deduplicates by question", () => {
    const serialized = serializeQaList([
      "Q: ¿Formato? | A: Una línea",
      "Q: ¿FORMATO?",
      { q: "¿Formato?", a: "" },
    ]);
    expect(serialized).toEqual(["Q: ¿Formato? | A: Una línea"]);
  });

  it("merges QA lists preserving existing answers", () => {
    const existing = ["Q: ¿Formato? | A: Una línea", "Q: ¿Idioma?"];
    const incoming = ["Q: ¿Formato?", "Q: ¿Idioma? | A: ES", "Q: ¿Campos extra?"];
    const merged = mergeQaLists(existing, incoming);
    expect(merged).toEqual([
      { question: "¿Formato?", answer: "Una línea" },
      { question: "¿Idioma?", answer: "ES" },
      { question: "¿Campos extra?", answer: "" },
    ]);
    expect(parseQaList(serializeQaList(merged))).toEqual(merged);
  });
});

