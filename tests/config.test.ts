import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixturesFromDirectory } from "../src/adapters/fixtureLoader.js";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses sensible defaults", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.dbPath.endsWith(join("data", "estimates.db"))).toBe(true);
    expect(config.fixturesDir.endsWith("fixtures")).toBe(true);
  });

  it("points the default fixtures folder at the real fixtures", () => {
    const fixtures = loadFixturesFromDirectory(loadConfig({}).fixturesDir);

    expect([...fixtures.keys()]).toEqual(["demo", "initial_failure", "verification_failure"]);
  });

  it("reads PORT, DB_PATH and FIXTURES_DIR from the environment", () => {
    expect(loadConfig({ PORT: "8080", DB_PATH: "/tmp/x.db", FIXTURES_DIR: "/tmp/fx" })).toEqual({
      port: 8080,
      dbPath: "/tmp/x.db",
      fixturesDir: "/tmp/fx",
    });
  });

  it("treats an empty PORT as unset", () => {
    expect(loadConfig({ PORT: "" }).port).toBe(3000);
  });

  it.each(["abc", "-1", "70000", "3.5", "80 80"])("rejects the invalid PORT %j", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });
});
