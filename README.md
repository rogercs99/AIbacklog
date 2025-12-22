# Req2Backlog AI

MVP para convertir requerimientos en backlog ejecutable con trazabilidad, Q&A y export a Jira/Rally.

## Requisitos

- Node 18+
- Una API key (Gemini u OpenAI-compatible) o un modelo local.

## Cómo correr

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Variables de entorno (IA)

Configura una API key de un modelo gratuito (Groq es una opción rápida):

```bash
export AI_API_KEY="tu_api_key"
export AI_BASE_URL="https://api.groq.com/openai/v1"
export AI_MODEL="llama-3.1-8b-instant"
```

### Modelo local en Steam Deck (sin API key)

Para testear sin depender de un servicio externo, usa un modelo muy básico con `llama.cpp`.
Recomendado: **Qwen2.5 0.5B Instruct** en GGUF (ligero para CPU).

1) Instala `llama.cpp` (o usa un binario precompilado).
2) Descarga el GGUF, por ejemplo `qwen2.5-0.5b-instruct-q4_k_m.gguf`.
3) Levanta el servidor local:

```bash
./llama-server -m /ruta/al/modelo.gguf --host 0.0.0.0 --port 8080
```

4) Arranca la app apuntando al modelo local:

```bash
export LOCAL_AI_URL="http://localhost:8080/v1"
export LOCAL_AI_MODEL="qwen2.5-0.5b-instruct"
export AI_ALLOW_NO_KEY=1
npm run dev
```

La app usará el modelo local si `LOCAL_AI_URL` está definido; si no, usará el proveedor externo.

### Modo local básico (sin servidor externo)

Si solo quieres probar el flujo sin instalar modelos, activa el modo local básico:

```bash
export LOCAL_AI_MODE=\"basic\"
npm run dev
```

Este modo genera JSON con reglas simples para `/plan`, `/ask` y `/reconcile`.

Si quieres usar OpenAI o ChatGPT Business:

```bash
export AI_API_KEY="tu_api_key"
export AI_BASE_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4o-mini"
```

Opcionales:

```bash
export OPENAI_ORG="org_..."
export OPENAI_PROJECT="proj_..."
```

## Flujo rápido

1. `/plan`: sube el documento y genera backlog (con cola).
2. `/projects`: filtra y explora documentos, subproyectos y tareas.
3. Dentro de un proyecto: vistas General / Rally / Jira + export y chat de dudas con IA.
4. `/plan?tab=compare`: sube versión nueva y aplica reconciliación.
5. `/chat`: chat IA con contexto de todos los proyectos.

## Persistencia

SQLite local en `data/req2backlog.db` (configurable con `SQLITE_PATH`).

## Scripts útiles

- `scripts/dev-start.sh` / `scripts/dev-stop.sh`: arranca/parar el dev server en segundo plano.
- `scripts/reset-db.sh [--restart]`: borra la base de datos local.
- `scripts/chat-local.js --chat`: chat por terminal contra `/api/chat`.
- `scripts/dev-start-ollama.sh [modelo]`: arranca la app usando Ollama (`LOCAL_AI_URL`).
