import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "roleforge.db");

let db: Database;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS career_profiles (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      source TEXT NOT NULL,
      normalized TEXT NOT NULL,
      assessment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      assessed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_imported_at ON listings(imported_at);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
  }
}

export function getProfile(id: string): any {
  const result = getDb().query('SELECT * FROM career_profiles WHERE id = ?').get(id) as any;
  return result ? JSON.parse(result.data) : null;
}

export function getAllListings(): any[] {
  const rows = getDb().query('SELECT * FROM listings ORDER BY imported_at DESC').all() as any[];
  return rows.map(row => ({
    ...row,
    source: JSON.parse(row.source),
    normalized: JSON.parse(row.normalized),
    assessment: JSON.parse(row.assessment),
  }));
}

export function getListing(id: string): any {
  const row = getDb().query('SELECT * FROM listings WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    source: JSON.parse(row.source),
    normalized: JSON.parse(row.normalized),
    assessment: JSON.parse(row.assessment),
  };
}

export function saveListing(listing: any): void {
  const db = getDb();
  db.query(`
    INSERT INTO listings (id, raw_text, source, normalized, assessment, status, imported_at, assessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listing.id,
    listing.rawText,
    JSON.stringify(listing.source),
    JSON.stringify(listing.normalized),
    JSON.stringify(listing.assessment),
    listing.status,
    listing.importedAt,
    listing.assessedAt,
  );
}

export function updateListingStatus(id: string, status: string): void {
  getDb().query('UPDATE listings SET status = ? WHERE id = ?').run(status, id);
}
