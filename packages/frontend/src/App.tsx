import { useEffect, useState } from "react";
import type { CareerProfile, Listing } from "./api";
import { createListing, fetchCareerProfiles, fetchListings, updateListingStatus } from "./api";
import { CareerProfileCard } from "./components/CareerProfileCard";
import { ListingDetail } from "./components/ListingDetail";
import { ListingImport } from "./components/ListingImport";
import "./App.css";

function App() {
  const [profiles, setProfiles] = useState<CareerProfile[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [profilesData, listingsData] = await Promise.all([
        fetchCareerProfiles(),
        fetchListings(),
      ]);
      setProfiles(profilesData);
      setListings(listingsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(text: string, source: { type: "paste" | "fixture"; name?: string }) {
    try {
      const listing = await createListing(text, source);
      setListings([listing, ...listings]);
      setSelectedListing(listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import listing");
    }
  }

  async function handleStatusUpdate(id: string, status: "saved" | "dismissed" | "flagged") {
    try {
      await updateListingStatus(id, status);
      setListings(listings.map((l) => (l.id === id ? { ...l, status } : l)));
      if (selectedListing?.id === id) {
        setSelectedListing({ ...selectedListing, status });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  if (loading) {
    return <div className="app">Loading...</div>;
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const profile = profiles[0];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Roleforge</h1>
        <p>Local-first job search intelligence</p>
      </header>

      <main className="app-main">
        {profile && <CareerProfileCard profile={profile} />}

        <ListingImport onImport={handleImport} />

        {selectedListing && (
          <ListingDetail listing={selectedListing} onStatusUpdate={handleStatusUpdate} />
        )}

        <section className="listings-history">
          <h2>Previously Assessed</h2>
          {listings.length === 0 ? (
            <p>No listings yet. Import one above.</p>
          ) : (
            <ul className="listings-list">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    className={`listing-item ${selectedListing?.id === listing.id ? "selected" : ""}`}
                    onClick={() => setSelectedListing(listing)}
                  >
                    <div className="listing-title">{listing.normalized.title || "Untitled"}</div>
                    <div className="listing-company">{listing.normalized.company || "Unknown"}</div>
                    <div className={`listing-verdict verdict-${listing.assessment.verdict}`}>
                      {listing.assessment.verdict}
                    </div>
                    <div className="listing-status">{listing.status}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
