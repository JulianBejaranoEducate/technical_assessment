import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fixtureSchema, type Fixture } from "./fixtureSchema.js";

/**
 * Loads every `*.json` file in a directory as a fixture; the file name (without
 * extension) is the fixture id. Fails fast, with the file name in the message, if
 * any fixture is not valid JSON or does not match the fixture format.
 *
 * Returns a Map (not a plain object) so ids such as "constructor" or "__proto__"
 * can never match an inherited property.
 */
export function loadFixturesFromDirectory(directory: string): Map<string, Fixture> {
  const fixtures = new Map<string, Fixture>();
  const files = readdirSync(directory)
    .filter((file) => extname(file) === ".json")
    .sort();

  for (const file of files) {
    const raw = readFileSync(join(directory, file), "utf8");
    fixtures.set(basename(file, ".json"), parseFixture(file, raw));
  }

  return fixtures;
}

function parseFixture(file: string, raw: string): Fixture {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Fixture "${file}" is not valid JSON: ${reason}`);
  }

  const result = fixtureSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Fixture "${file}" is invalid: ${problems}`);
  }

  return result.data;
}
