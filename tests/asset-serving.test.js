import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";

const ROOT = path.resolve(__dirname, "..");
let server;

const waitFor = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForUrl(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      http
        .get(url, (res) => {
          resolve(res.statusCode === 200);
        })
        .on("error", () => resolve(false));
    });
    if (ok) return true;
    await waitFor(200);
  }
  return false;
}

describe("asset serving dev", () => {
  beforeAll(async () => {
    // Limpieza previa
    try {
      if (fs.existsSync(path.join(ROOT, "dev.pid"))) {
        const pid = Number(fs.readFileSync(path.join(ROOT, "dev.pid"), "utf8") || "");
        if (pid) {
          process.kill(pid);
        }
      }
    } catch (err) {
      // ignore
    }
    fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, "dev.log"), { force: true });
    fs.rmSync(path.join(ROOT, "dev.pid"), { force: true });

    server = spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      env: { ...process.env, PORT: "3000" },
      stdio: "ignore",
    });

    let attempts = 0;
    while (!fs.existsSync(path.join(ROOT, "dev.pid")) && attempts < 50) {
      await waitFor(100);
      attempts += 1;
    }

    await waitForUrl("http://localhost:3000/");
  }, 20000);

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill();
    }
    try {
      const pidPath = path.join(ROOT, "dev.pid");
      if (fs.existsSync(pidPath)) {
        const pid = Number(fs.readFileSync(pidPath, "utf8") || "");
        if (pid) {
          process.kill(pid);
        }
        fs.rmSync(pidPath, { force: true });
      }
    } catch (err) {
      // ignore
    }
  });

  it(
    "serves core assets (layout.css, main-app.js)",
    async () => {
      const urls = [
        "http://localhost:3000/_next/static/css/app/layout.css",
        "http://localhost:3000/_next/static/chunks/main-app.js",
        "http://localhost:3000/_next/static/chunks/app-pages-internals.js",
      ];

      for (const url of urls) {
        const ok = await waitForUrl(url, 8000);
        expect(ok).toBe(true);
      }
    },
    25000,
  );
});

