# Req2Backlog AI — Quick Start (Hackathon)

## Linux

1) Start Axet Desktop
- Make sure aXet Desktop is installed.
- Run the desktop app and log in.

2) Start the stack
```bash
cd /path/to/DeltAI
bash scripts/start-stack.sh
```

3) Open the app
- App: http://localhost:3000
- Axet Flow gateway: http://localhost:46228/axetflow/ai

## Windows

1) Start Axet Desktop
- Install and open aXet Desktop.
- Log in and ensure the Designer is running.

2) Start the app
```bat
cd C:\path\to\DeltAI
npm install
npm run dev
```

3) Configure environment (.env.local)
Create a file named `.env.local` at project root:
```
AI_PROVIDER=axet
AXET_FLOW_URL=http://localhost:46228/axetflow/ai
AXET_FLOW_JSON_URL=http://localhost:46228/axetflow/ai
AXET_FLOW_CHAT_URL=http://localhost:46228/axetflow/ai
```

4) Open the app
- App: http://localhost:3000

---

## Troubleshooting
- If `/api/plan` fails with SQLite errors, rebuild:
  ```bash
  npm rebuild better-sqlite3
  ```
- If Axet desktop isn’t running, the gateway won’t respond.
