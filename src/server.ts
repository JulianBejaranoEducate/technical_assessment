import { loadFixturesFromDirectory } from "./adapters/fixtureLoader.js";
import { MockScanProvider } from "./adapters/MockScanProvider.js";
import { SqliteEstimateRepository } from "./adapters/SqliteEstimateRepository.js";
import { loadConfig } from "./config.js";
import { createApp } from "./http/app.js";
import { EstimateService } from "./services/EstimateService.js";

/**
 * Composition root: the only place that knows which concrete classes are used.
 * To use a real scan provider or another database, only this wiring changes.
 */
const config = loadConfig();

const provider = new MockScanProvider(loadFixturesFromDirectory(config.fixturesDir));
const repository = new SqliteEstimateRepository(config.dbPath);
const app = createApp({ estimateService: new EstimateService({ provider, repository }) });

const server = app.listen(config.port, () => {
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : config.port;
  console.log(`Building Systems Estimator listening on http://localhost:${port}`);
  console.log(`Database file: ${config.dbPath}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
  repository.close();
  process.exit(1);
});

// Stop accepting requests, then close the database cleanly (SIGTERM is not sent on Windows).
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
