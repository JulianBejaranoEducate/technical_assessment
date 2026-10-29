import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixturesFromDirectory } from "../src/adapters/fixtureLoader.js";
import { MockScanProvider } from "../src/adapters/MockScanProvider.js";
import { SqliteEstimateRepository } from "../src/adapters/SqliteEstimateRepository.js";
import { createApp } from "../src/http/app.js";
import type { ScanProvider } from "../src/ports/ScanProvider.js";
import { EstimateService } from "../src/services/EstimateService.js";
import { RecordingProvider } from "./helpers/fakes.js";

const PROJECT_FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));
const fixtures = loadFixturesFromDirectory(PROJECT_FIXTURES_DIR);

const DEMO_REQUEST = { project: "Demo Building", floors: 12, fixture: "demo" };

let dir: string;
const repositories: SqliteEstimateRepository[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "api-test-"));
});

afterEach(() => {
  for (const repository of repositories.splice(0)) {
    try {
      repository.close();
    } catch {
      // already closed by the test itself
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

/** Real app, real SQLite file, real mock provider. Only the logger is replaced so tests stay quiet. */
function buildTestApp(options: { dbFile?: string; scanProvider?: ScanProvider } = {}) {
  const dbFile = options.dbFile ?? join(dir, "estimates.db");
  const repository = new SqliteEstimateRepository(dbFile);
  repositories.push(repository);

  const provider = new RecordingProvider(options.scanProvider ?? new MockScanProvider(fixtures));
  const logger = { error: vi.fn() };
  const app = createApp({ estimateService: new EstimateService({ provider, repository }), logger });

  return { app, provider, logger, repository, dbFile };
}

/** Counts rows through a separate connection: proves what is really on disk, not what the code claims. */
function countStoredEstimates(dbFile: string): number {
  const db = new Database(dbFile, { readonly: true });
  try {
    return (db.prepare("SELECT COUNT(*) AS n FROM estimates").get() as { n: number }).n;
  } finally {
    db.close();
  }
}

describe("POST /estimates: demo fixture (acceptance example)", () => {
  it("returns 201 with the contract from the exercise statement", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send(DEMO_REQUEST);

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^est_/),
      project: "Demo Building",
      floors: 12,
      fixture: "demo",
      status: "completed_with_warnings",
      stages: { initial: "completed", verification: "completed", consolidation: "completed" },
      scans: {
        initial: { antennas: 28, splitters: 6 },
        verification: { antennas: 26, splitters: 6 },
      },
      selected: { antennas: 28, splitters: 6 },
      line_items: { floors: 1200, antennas: 7000, splitters: 480 },
      total: 8680,
      warnings: ["Antenna count mismatch: 28 vs 26"],
      created_at: expect.any(String),
    });
  });

  it("points the Location header at the new estimate", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send(DEMO_REQUEST);

    expect(response.headers.location).toBe(`/estimates/${response.body.id}`);
  });

  it("can be read back with GET, with equivalent values", async () => {
    const { app } = buildTestApp();
    const created = await request(app).post("/estimates").send(DEMO_REQUEST).expect(201);

    const fetched = await request(app).get(`/estimates/${created.body.id}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
  });

  it("generates a different id for every estimate", async () => {
    const { app } = buildTestApp();

    const first = await request(app).post("/estimates").send(DEMO_REQUEST);
    const second = await request(app).post("/estimates").send(DEMO_REQUEST);

    expect(first.body.id).not.toBe(second.body.id);
  });

  it("does not advertise the framework in a header", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send(DEMO_REQUEST);

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("POST /estimates: verification failure", () => {
  it("returns 201 with the initial counts, a failed verification stage and a warning", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/estimates")
      .send({ ...DEMO_REQUEST, fixture: "verification_failure" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "completed_with_warnings",
      stages: { initial: "completed", verification: "failed", consolidation: "completed" },
      scans: { initial: { antennas: 28, splitters: 6 }, verification: null },
      selected: { antennas: 28, splitters: 6 },
      line_items: { floors: 1200, antennas: 7000, splitters: 480 },
      total: 8680,
      warnings: ["Verification scan failed"],
    });
  });

  it("persists the estimate, and GET returns it with verification still null", async () => {
    const { app, dbFile } = buildTestApp();
    const created = await request(app)
      .post("/estimates")
      .send({ ...DEMO_REQUEST, fixture: "verification_failure" })
      .expect(201);

    const fetched = await request(app).get(`/estimates/${created.body.id}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.scans.verification).toBeNull();
    expect(countStoredEstimates(dbFile)).toBe(1);
  });
});

describe("POST /estimates: initial failure", () => {
  it("returns 502 with a clear provider-failure error", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/estimates")
      .send({ ...DEMO_REQUEST, fixture: "initial_failure" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: {
        code: "provider_failure",
        message: "Initial scan failed: Simulated provider outage",
        stage: "initial",
      },
    });
  });

  it("does not create or persist anything, and never reaches the verification scan", async () => {
    const { app, provider, dbFile } = buildTestApp();

    await request(app).post("/estimates").send({ ...DEMO_REQUEST, fixture: "initial_failure" });

    expect(countStoredEstimates(dbFile)).toBe(0);
    expect(provider.scans).toEqual([{ fixture: "initial_failure", stage: "initial" }]);
  });
});

describe("POST /estimates: invalid client input", () => {
  it("returns 400 with useful messages for the exercise example (empty project, 0 floors)", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send({ project: "", floors: 0, fixture: "demo" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: [
          { field: "project", message: "must not be empty" },
          { field: "floors", message: "must be a positive integer" },
        ],
      },
    });
  });

  it("does not call the provider, persist anything, or log it as a server error", async () => {
    const { app, provider, logger, dbFile } = buildTestApp();

    await request(app).post("/estimates").send({ project: "", floors: 0, fixture: "demo" });

    expect(provider.scans).toEqual([]);
    expect(countStoredEstimates(dbFile)).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ["floors sent as a string", { project: "A", floors: "12", fixture: "demo" }, "floors"],
    ["fractional floors", { project: "A", floors: 2.5, fixture: "demo" }, "floors"],
    ["negative floors", { project: "A", floors: -1, fixture: "demo" }, "floors"],
    ["an empty fixture", { project: "A", floors: 1, fixture: "" }, "fixture"],
    ["a missing project", { floors: 1, fixture: "demo" }, "project"],
    ["a project of only spaces", { project: "   ", floors: 1, fixture: "demo" }, "project"],
  ])("returns 400 for %s and touches nothing", async (_label, body, field) => {
    const { app, provider, dbFile } = buildTestApp();

    const response = await request(app).post("/estimates").send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(provider.scans).toEqual([]);
    expect(countStoredEstimates(dbFile)).toBe(0);
  });

  it("rejects floors that overflow to Infinity in JSON (1e400)", async () => {
    const { app, dbFile } = buildTestApp();

    const response = await request(app)
      .post("/estimates")
      .set("Content-Type", "application/json")
      .send('{"project":"A","floors":1e400,"fixture":"demo"}');

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].field).toBe("floors");
    expect(countStoredEstimates(dbFile)).toBe(0);
  });

  it("returns 400 invalid_json for a malformed JSON body", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/estimates")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "invalid_json", message: "Request body is not valid JSON" },
    });
  });

  it("returns 400 naming 'body' when the request is not sent as JSON", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").set("Content-Type", "text/plain").send("project=A");

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual([
      { field: "body", message: "must be a JSON object (send it with Content-Type: application/json)" },
    ]);
  });

  it("returns 400 naming 'body' when there is no body at all", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates");

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].field).toBe("body");
  });

  it("returns 413 for a body over the size limit", async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .post("/estimates")
      .send({ project: "x".repeat(20_000), floors: 1, fixture: "demo" });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("payload_too_large");
  });
});

describe("POST /estimates: unknown fixture", () => {
  it("returns a clear 400 that lists the available fixtures", async () => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send({ ...DEMO_REQUEST, fixture: "nope" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "unknown_fixture",
        message: 'Unknown fixture "nope". Available fixtures: demo, initial_failure, verification_failure',
      },
    });
  });

  it("does not scan or persist anything", async () => {
    const { app, provider, dbFile } = buildTestApp();

    await request(app).post("/estimates").send({ ...DEMO_REQUEST, fixture: "nope" });

    expect(provider.scans).toEqual([]);
    expect(countStoredEstimates(dbFile)).toBe(0);
  });

  it.each(["constructor", "__proto__", "toString"])("does not accept the inherited name %s as a fixture", async (name) => {
    const { app } = buildTestApp();

    const response = await request(app).post("/estimates").send({ ...DEMO_REQUEST, fixture: name });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("unknown_fixture");
  });
});

describe("provider failures versus client errors", () => {
  it("answers 5xx for a failing provider and 4xx for bad input, with different error codes", async () => {
    const { app } = buildTestApp();

    const providerFailure = await request(app)
      .post("/estimates")
      .send({ ...DEMO_REQUEST, fixture: "initial_failure" });
    const badInput = await request(app).post("/estimates").send({ ...DEMO_REQUEST, floors: 0 });
    const unknownFixture = await request(app).post("/estimates").send({ ...DEMO_REQUEST, fixture: "nope" });

    expect(providerFailure.status).toBeGreaterThanOrEqual(500);
    expect(badInput.status).toBeLessThan(500);
    expect(unknownFixture.status).toBeLessThan(500);
    expect(new Set([providerFailure, badInput, unknownFixture].map((r) => r.body.error.code)).size).toBe(3);
  });
});

describe("GET /estimates/:id", () => {
  it("returns 404 for an id that does not exist", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/estimates/est_missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "not_found", message: 'Estimate "est_missing" was not found' },
    });
  });

  it.each(["x'; DROP TABLE estimates; --", "est_1 OR 1=1", "../../etc/passwd", "<script>alert(1)</script>"])(
    "treats the hostile id %j as plain data: 404, JSON only, database intact",
    async (id) => {
      const { app } = buildTestApp();
      const created = await request(app).post("/estimates").send(DEMO_REQUEST).expect(201);

      const response = await request(app).get(`/estimates/${encodeURIComponent(id)}`);

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect((await request(app).get(`/estimates/${created.body.id}`)).status).toBe(200);
    },
  );
});

describe("other behaviour", () => {
  it("answers unknown routes with a JSON 404", async () => {
    const { app } = buildTestApp();

    const response = await request(app).get("/nope");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body.error.code).toBe("route_not_found");
  });

  it("answers 500 without leaking internals when something unexpected breaks, and logs it", async () => {
    const brokenProvider: ScanProvider = {
      listFixtures: async () => {
        throw new Error("secret internal detail");
      },
      scan: async () => ({ antennas: 0, splitters: 0 }),
    };
    const { app, logger, dbFile } = buildTestApp({ scanProvider: brokenProvider });

    const response = await request(app).post("/estimates").send(DEMO_REQUEST);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: "internal_error", message: "Internal server error" } });
    expect(JSON.stringify(response.body)).not.toContain("secret internal detail");
    expect(logger.error).toHaveBeenCalledOnce();
    expect(countStoredEstimates(dbFile)).toBe(0);
  });
});

describe("persistence across a restart", () => {
  it("serves an estimate saved before the application was stopped and started again", async () => {
    const dbFile = join(dir, "restart", "estimates.db");

    // First run: create an estimate, then "stop the server" by closing the database.
    const firstRun = buildTestApp({ dbFile });
    const created = await request(firstRun.app).post("/estimates").send(DEMO_REQUEST).expect(201);
    firstRun.repository.close();

    // Second run: brand new repository, service and app over the same file, as a fresh process would be.
    const secondRun = buildTestApp({ dbFile });
    const fetched = await request(secondRun.app).get(`/estimates/${created.body.id}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.total).toBe(8680);
  });

  it("keeps the estimate with a null verification scan across a restart too", async () => {
    const dbFile = join(dir, "estimates.db");

    const firstRun = buildTestApp({ dbFile });
    const created = await request(firstRun.app)
      .post("/estimates")
      .send({ ...DEMO_REQUEST, fixture: "verification_failure" })
      .expect(201);
    firstRun.repository.close();

    const secondRun = buildTestApp({ dbFile });
    const fetched = await request(secondRun.app).get(`/estimates/${created.body.id}`);

    expect(fetched.body).toEqual(created.body);
    expect(fetched.body.scans.verification).toBeNull();
  });
});
