import { execSync } from "child_process";
import path from "path";
import { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  const root = __dirname;
  const resetScript = path.join(root, "scripts", "reset-db.sh");
  try {
    execSync(`bash "${resetScript}"`, {
      stdio: "inherit",
      cwd: root,
      env: {
        ...process.env,
        SQLITE_PATH: path.join(root, "data", "req2backlog-e2e.db"),
      },
    });
  } catch (error) {
    console.error("No se pudo limpiar la base de datos para E2E:", error);
    throw error;
  }
}

export default globalSetup;
