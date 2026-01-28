# Req2Backlog AI

MVP para convertir requerimientos en backlog ejecutable con trazabilidad, Q&A y export a Jira/Rally.

## Requisitos

- Node 18+
- aXet Flows Desktop instalado y con sesión iniciada.

## Cómo correr

```bash
npm install
npm run dev
```

Luego abre `http://localhost:3000`.

## Variables de entorno (IA)

Configura la app para usar el gateway de aXet Flows:

```bash
export AI_PROVIDER="axet"
export AXET_FLOW_URL="http://localhost:46228/axetflow/ai"
export AXET_FLOW_JSON_URL="http://localhost:46228/axetflow/ai"
export AXET_FLOW_CHAT_URL="http://localhost:46228/axetflow/ai"
```

Opcional (si proteges el gateway):

```bash
export AXET_FLOW_API_KEY="tu_token"
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
