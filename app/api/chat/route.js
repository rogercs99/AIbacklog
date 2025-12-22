import { NextResponse } from "next/server";
import { callChat } from "@/lib/chat";
import { buildLocalChat } from "@/lib/local-basic-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((msg) => ({
      role: msg?.role === "assistant" ? "assistant" : "user",
      content: typeof msg?.content === "string" ? msg.content.trim() : "",
    }))
    .filter((msg) => msg.content.length > 0);
}

export async function POST(request) {
  const body = await request.json();
  const messages = sanitizeMessages(body?.messages);
  const system = (
    body?.system ||
    "Eres un asistente claro, directo y util. Responde en Markdown con listas y negritas cuando ayude."
  ).trim();

  if (!messages.length) {
    return NextResponse.json({ error: "Mensajes vacios." }, { status: 400 });
  }

  const hasProvider = Boolean(
    process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.LOCAL_AI_URL ||
      process.env.AI_BASE_URL,
  );

  if (process.env.LOCAL_AI_MODE === "basic" && !hasProvider) {
    return NextResponse.json(buildLocalChat(messages));
  }

  try {
    const result = await callChat({ system, messages });
    return NextResponse.json(result);
  } catch (error) {
    if (process.env.LOCAL_AI_MODE === "basic") {
      return NextResponse.json(buildLocalChat(messages));
    }
    return NextResponse.json(
      { error: error.message || "No se pudo llamar al modelo." },
      { status: 500 },
    );
  }
}
