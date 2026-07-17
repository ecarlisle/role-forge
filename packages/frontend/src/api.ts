const API_BASE = "http://localhost:3000";

export interface CareerProfile {
  id: string;
  name: string;
  title: string;
  summary?: string;
  skills: Array<{
    name: string;
    category?: string;
    proficiency?: "beginner" | "intermediate" | "advanced" | "expert";
  }>;
  experience: {
    totalYears: number;
    roles: Array<{
      title: string;
      company: string;
      years: number;
    }>;
  };
  education?: Array<{
    degree: string;
    institution: string;
    year?: number;
  }>;
  preferences?: {
    locations?: string[];
    remote?: boolean;
    compensation?: {
      min?: number;
      max?: number;
      currency: string;
    };
    titles?: string[];
  };
}

export interface NormalizedListing {
  title: string | null;
  company: string | null;
  location: string | null;
  remote: boolean;
  skills: string[];
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  experience: {
    minYears: number | null;
    maxYears: number | null;
    level: "junior" | "mid" | "senior" | "lead" | "principal" | null;
  } | null;
  compensation: {
    min: number | null;
    max: number | null;
    currency: string;
  } | null;
  confidence: Record<string, "high" | "medium" | "low" | "none">;
  sectionsExtracted: string[];
}

export interface MatchAssessment {
  verdict: "strong" | "promising" | "mixed" | "weak" | "insufficient-evidence";
  dimensions: Array<{
    name: string;
    score: "strong" | "partial" | "weak" | "none";
    confidence: "high" | "medium" | "low" | "none";
    explanation: string;
    evidenceIds: string[];
  }>;
  strongMatches: string[];
  partialMatches: string[];
  missingEvidence: string[];
  concerns: string[];
  evidence: Array<{
    id: string;
    type: "skill" | "experience" | "title" | "education" | "preference";
    label: string;
    source: string;
  }>;
  recommendedAction: string;
  internalScore?: number;
}

export interface Listing {
  id: string;
  rawText: string;
  source: {
    type: "paste" | "fixture";
    name?: string;
  };
  normalized: NormalizedListing;
  assessment: MatchAssessment;
  status: "new" | "saved" | "dismissed" | "flagged";
  importedAt: string;
  assessedAt: string;
}

export async function fetchCareerProfiles(): Promise<CareerProfile[]> {
  const res = await fetch(`${API_BASE}/api/career-profiles`);
  if (!res.ok) throw new Error("Failed to fetch profiles");
  return res.json();
}

export async function fetchCareerProfile(id: string): Promise<CareerProfile> {
  const res = await fetch(`${API_BASE}/api/career-profiles/${id}`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function fetchListings(): Promise<Listing[]> {
  const res = await fetch(`${API_BASE}/api/listings`);
  if (!res.ok) throw new Error("Failed to fetch listings");
  return res.json();
}

export async function createListing(
  text: string,
  source: { type: "paste" | "fixture"; name?: string },
): Promise<Listing> {
  const res = await fetch(`${API_BASE}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });
  if (!res.ok) throw new Error("Failed to create listing");
  return res.json();
}

export async function updateListingStatus(
  id: string,
  status: "saved" | "dismissed" | "flagged",
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/listings/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}
