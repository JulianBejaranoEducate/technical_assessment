import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { Estimate } from "../domain/types.js";
import type { EstimateRepository } from "../ports/EstimateRepository.js";

/**
 * One table, one row per estimate. Scalar fields get their own column; the nested
 * structures (stages, scans, selected, line_items, warnings) are stored as JSON text.
 * They are always read and written together with the estimate and never queried on
 * their own, so normalizing them into extra tables would add joins for no benefit.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS estimates (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    floors      INTEGER NOT NULL,
    fixture     TEXT NOT NULL,
    status      TEXT NOT NULL,
    total       INTEGER NOT NULL,
    stages      TEXT NOT NULL,
    scans       TEXT NOT NULL,
    selected    TEXT NOT NULL,
    line_items  TEXT NOT NULL,
    warnings    TEXT NOT NULL,
    created_at  TEXT NOT NULL
  )
`;

interface EstimateRow {
  id: string;
  project: string;
  floors: number;
  fixture: string;
  status: Estimate["status"];
  total: number;
  stages: string;
  scans: string;
  selected: string;
  line_items: string;
  warnings: string;
  created_at: string;
}

export class SqliteEstimateRepository implements EstimateRepository {
  private readonly db: Database.Database;
  private readonly insertStatement: Database.Statement;
  private readonly selectByIdStatement: Database.Statement;

  /**
   * @param filename path of the database file (created, with its folders, if missing),
   *                 or ":memory:" for a throwaway database.
   */
  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }

    this.db = new Database(filename);
    this.db.exec(SCHEMA);

    // Every query is a prepared statement with bound parameters: client-supplied
    // values (such as an id in the URL) never become part of the SQL text.
    this.insertStatement = this.db.prepare(`
      INSERT INTO estimates
        (id, project, floors, fixture, status, total, stages, scans, selected, line_items, warnings, created_at)
      VALUES
        (@id, @project, @floors, @fixture, @status, @total, @stages, @scans, @selected, @line_items, @warnings, @created_at)
    `);
    this.selectByIdStatement = this.db.prepare("SELECT * FROM estimates WHERE id = ?");
  }

  async save(estimate: Estimate): Promise<void> {
    const row: EstimateRow = {
      id: estimate.id,
      project: estimate.project,
      floors: estimate.floors,
      fixture: estimate.fixture,
      status: estimate.status,
      total: estimate.total,
      stages: JSON.stringify(estimate.stages),
      scans: JSON.stringify(estimate.scans),
      selected: JSON.stringify(estimate.selected),
      line_items: JSON.stringify(estimate.line_items),
      warnings: JSON.stringify(estimate.warnings),
      created_at: estimate.created_at,
    };
    this.insertStatement.run(row);
  }

  async findById(id: string): Promise<Estimate | null> {
    const row = this.selectByIdStatement.get(id) as EstimateRow | undefined;
    return row === undefined ? null : rowToEstimate(row);
  }

  /** Release the file handle. Needed before reopening the same file, e.g. to simulate a restart. */
  close(): void {
    this.db.close();
  }
}

function rowToEstimate(row: EstimateRow): Estimate {
  return {
    id: row.id,
    project: row.project,
    floors: row.floors,
    fixture: row.fixture,
    status: row.status,
    stages: JSON.parse(row.stages) as Estimate["stages"],
    scans: JSON.parse(row.scans) as Estimate["scans"],
    selected: JSON.parse(row.selected) as Estimate["selected"],
    line_items: JSON.parse(row.line_items) as Estimate["line_items"],
    total: row.total,
    warnings: JSON.parse(row.warnings) as Estimate["warnings"],
    created_at: row.created_at,
  };
}
