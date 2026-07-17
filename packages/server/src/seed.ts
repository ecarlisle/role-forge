import { normalizeListing, evaluateMatch, CareerProfileSchema } from "@roleforge/domain";
import { getDb, closeDb } from "./db";
import { readFileSync } from "fs";
import { join } from "path";

console.log("🌱 Seeding database...\n");

const db = getDb();

// Load fixtures
const profilePath = join(process.cwd(), "fixtures", "career-profile.json");
const profileData = JSON.parse(readFileSync(profilePath, "utf-8"));
const profile = CareerProfileSchema.parse(profileData);

// Insert career profile
const insertProfile = db.prepare(`
  INSERT INTO career_profiles (id, data, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    data = excluded.data
`);

insertProfile.run(profile.id, JSON.stringify(profile), new Date().toISOString());
console.log(`✓ Seeded career profile: ${profile.name}`);

// Load and process listings
const listings = [
  {
    id: "listing-senior-frontend",
    file: "senior-frontend-engineer.txt",
  },
  {
    id: "listing-fullstack",
    file: "fullstack-developer.txt",
  },
];

const insertListing = db.prepare(`
  INSERT INTO listings (id, raw_text, source, normalized, assessment, status, imported_at, assessed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    raw_text = excluded.raw_text,
    source = excluded.source,
    normalized = excluded.normalized,
    assessment = excluded.assessment,
    status = excluded.status,
    imported_at = excluded.imported_at,
    assessed_at = excluded.assessed_at
`);

for (const listing of listings) {
  const filePath = join(process.cwd(), "fixtures", "listings", listing.file);
  const rawText = readFileSync(filePath, "utf-8");

  const normalized = normalizeListing(rawText);
  const assessment = evaluateMatch(profile, normalized);

  const now = new Date().toISOString();
  const source = { type: "fixture", name: listing.file };

  insertListing.run(
    listing.id,
    rawText,
    JSON.stringify(source),
    JSON.stringify(normalized),
    JSON.stringify(assessment),
    "new",
    now,
    now,
  );

  console.log(`✓ Seeded listing: ${normalized.title || listing.file}`);
}

console.log("\n✅ Seed complete");
closeDb();
