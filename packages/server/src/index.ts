/**
 * Server entry point — Bun HTTP server with REST API routes.
 */

import {
  type CareerProfile,
  evaluateMatch,
  isValidTransition,
  type ListingStatus,
  normalizeListing,
} from "@roleforge/domain";
import { getAllListings, getListing, getProfile, saveListing, updateListingStatus } from "./db";

const PORT = 3100;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    // GET /api/profiles/:id
    if (method === "GET" && path.startsWith("/api/profiles/")) {
      const id = path.split("/")[3];
      const profile = getProfile(id);
      if (!profile) return errorResponse("Profile not found", 404);
      return json(profile);
    }

    // POST /api/listings
    if (method === "POST" && path === "/api/listings") {
      const body = (await req.json()) as {
        text: string;
        source: { type: string; name?: string };
        profileId: string;
      };

      if (!body.text || !body.profileId) {
        return errorResponse("Missing text or profileId", 400);
      }

      const profile = getProfile(body.profileId) as CareerProfile | null;
      if (!profile) return errorResponse("Profile not found", 404);

      const normalized = normalizeListing(body.text);
      const assessment = evaluateMatch(profile, normalized);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      saveListing({
        id,
        rawText: body.text,
        source: body.source,
        normalized,
        assessment,
        status: "new",
        importedAt: now,
        assessedAt: now,
      });

      return json(
        {
          id,
          rawText: body.text,
          source: body.source,
          normalized,
          assessment,
          status: "new",
          importedAt: now,
          assessedAt: now,
        },
        201,
      );
    }

    // GET /api/listings
    if (method === "GET" && path === "/api/listings") {
      return json(getAllListings());
    }

    // GET /api/listings/:id
    if (method === "GET" && /^\/api\/listings\/[^/]+$/.test(path)) {
      const id = path.split("/")[3];
      const listing = getListing(id);
      if (!listing) return errorResponse("Listing not found", 404);
      return json(listing);
    }

    // PUT /api/listings/:id/status
    if (method === "PUT" && path.endsWith("/status")) {
      const id = path.split("/")[3];
      const listing = getListing(id);
      if (!listing) return errorResponse("Listing not found", 404);

      const body = (await req.json()) as { status: ListingStatus };
      const currentStatus = listing.status as ListingStatus;

      if (!isValidTransition(currentStatus, body.status)) {
        return errorResponse(`Invalid transition: ${currentStatus} → ${body.status}`, 400);
      }

      updateListingStatus(id, body.status);
      return json({ ...listing, status: body.status });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    console.error("Server error:", err);
    return errorResponse(err instanceof Error ? err.message : "Internal error", 500);
  }
}

const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`Roleforge server running at http://localhost:${server.port}`);
