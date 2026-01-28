#!/usr/bin/env node
const fs = require("fs");
const readline = require("readline");

const args = process.argv.slice(2);
let projectId = null;
let contextText = "";
let host = "http://localhost:3000";
let useChat = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--project" || arg === "-p") {
    projectId = Number(args[i + 1]);
    i += 1;
    continue;
  }
  if (arg === "--context" || arg === "-c") {
    const filePath = args[i + 1];
    i += 1;
    if (filePath) {
      contextText = fs.readFileSync(filePath, "utf-8");
    }
    continue;
  }
  if (arg === "--host") {
    host = args[i + 1] || host;
    i += 1;
    continue;
  }
  if (arg === "--chat" || arg === "--free") {
    useChat = true;
  }
}

host = host.replace(/\/+$/, "");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "Tu pregunta> ",
});

const messages = [];

async function ask(question) {
  const useFreeChat = useChat || (!projectId && !contextText.trim());
  const payload = useFreeChat ? { messages } : { question };
  if (useFreeChat) {
    messages.push({ role: "user", content: question });
  } else {
    if (projectId) {
      payload.projectId = projectId;
    }
    if (contextText.trim()) {
      payload.text = contextText.trim();
    }
  }

  const response = await fetch(`${host}${useFreeChat ? "/api/chat" : "/api/ask"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Error en la API.");
  }
  const data = await response.json();
  if (useFreeChat && data?.answer) {
    messages.push({ role: "assistant", content: data.answer });
  }
  return data;
}

console.log("Chat local listo. Escribe 'salir' para terminar.");
if (useChat || (!projectId && !contextText.trim())) {
  console.log("Modo chat libre.");
}
if (projectId) {
  console.log(`Usando proyecto: ${projectId}`);
}
if (contextText.trim()) {
  console.log("Contexto adicional cargado desde archivo.");
}

rl.prompt();

rl.on("line", async (line) => {
  const question = line.trim();
  if (!question) {
    rl.prompt();
    return;
  }
  if (["salir", "exit", "quit"].includes(question.toLowerCase())) {
    rl.close();
    return;
  }
  if (["reset", "clear"].includes(question.toLowerCase())) {
    messages.length = 0;
    console.log("Conversacion reiniciada.");
    rl.prompt();
    return;
  }

  try {
    const result = await ask(question);
    console.log(`\nRespuesta: ${result.answer || "Sin respuesta"}`);
    if (result.if_not_found) {
      console.log("(No aparece en el documento)");
    }
    if (Array.isArray(result.citations) && result.citations.length) {
      console.log("Citas:");
      result.citations.forEach((cite) => {
        console.log(`- ${cite.chunk_id}: ${cite.snippet}`);
      });
    }
    if (Array.isArray(result.follow_up_questions) && result.follow_up_questions.length) {
      console.log("Siguientes preguntas:");
      result.follow_up_questions.forEach((item) => {
        console.log(`- ${item}`);
      });
    }
    console.log("");
  } catch (error) {
    console.log(`Error: ${error.message}`);
  } finally {
    rl.prompt();
  }
});

rl.on("close", () => {
  console.log("Hasta luego.");
  process.exit(0);
});
