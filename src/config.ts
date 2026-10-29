import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  port: number;
  /** SQLite database file. Created, with its folder, on first start. */
  dbPath: string;
  /** Folder with the mock scan fixtures (*.json). */
  fixturesDir: string;
}

// This file lives in <root>/src (or <root>/dist once built), so ".." is the project root.
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Environment variables (all optional):
 *   PORT          default 3000
 *   DB_PATH       default <root>/data/estimates.db
 *   FIXTURES_DIR  default <root>/fixtures
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: parsePort(env.PORT),
    dbPath: env.DB_PATH ?? join(PROJECT_ROOT, "data", "estimates.db"),
    fixturesDir: env.FIXTURES_DIR ?? join(PROJECT_ROOT, "fixtures"),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 3000;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT "${raw}": expected an integer between 0 and 65535`);
  }
  return port;
}
