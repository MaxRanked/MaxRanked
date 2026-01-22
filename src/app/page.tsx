"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect } from "react";
import AddCompanyForm from "@/components/AddCompanyForm";
import Link from "next/link";

export default function HomePage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all companies once on load (for searching)
  useEffect(() => {
    async function fetchData() {
      // Fetch companies
      const { data: companiesData, error: companyError } = await supabase
        .from("companies")
        .select("id, company, vote_up, vote_down, country");

      if (companyError) {
        console.error("Error fetching companies:", companyError);
        setLoading(false);
        return;
      }

      // Get IDs of loaded companies
      const companyIds = companiesData?.map((c) => c.id) || [];

      // Fetch brands/assets for these companies
      const { data: assetData, error: assetFetchError } = await supabase
        .from("brands_assets")
        .select("company_id, asset_name")
        .in("company_id", companyIds);

      if (assetFetchError) {
        console.error("Error fetching brands/assets:", assetFetchError);
      }

      // Group assets by company_id
      const brandsByCompany: Record<string, string[]> = {}; // or Record<number, string[]> if company_id is number

      assetData?.forEach((b) => {
        const companyId = b.company_id; // optional: extract for clarity
        if (!brandsByCompany[companyId]) {
          brandsByCompany[companyId] = [];
        }
        brandsByCompany[companyId].push(b.asset_name);
      });

      // Attach brands to each company
      const companiesWithBrands =
        companiesData?.map((c) => ({
          ...c,
          brands: brandsByCompany[c.id] || [],
        })) || [];

      setCompanies(companiesWithBrands);
      setFilteredCompanies(companiesWithBrands);
      setLoading(false);
    }

    fetchData();
  }, []);

  // Filter whenever search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredCompanies([]);
      setShowAddForm(false); // Hide form when search is emptied
      return;
    }

    const trimmed = searchTerm.trim().toLowerCase();

    // Find companies where:
    // 1. Company name matches exactly
    // 2. Company name contains the term
    // 3. Any asset name contains the term → return the owning company
    const matches = companies.filter((c) => {
      const companyLower = c.company.toLowerCase();

      // Direct company name match
      if (companyLower === trimmed || companyLower.includes(trimmed)) {
        return true;
      }

      // Asset name match → include if any asset contains the term
      return c.brands?.some((asset: string) =>
        asset.toLowerCase().includes(trimmed),
      );
    });

    // Optional: sort so exact company matches come first, then partial, then asset matches
    const sorted = [...matches].sort((a, b) => {
      const aCompany = a.company.toLowerCase();
      const bCompany = b.company.toLowerCase();

      if (aCompany === trimmed) return -1;
      if (bCompany === trimmed) return 1;
      if (aCompany.includes(trimmed) && !bCompany.includes(trimmed)) return -1;
      if (!aCompany.includes(trimmed) && bCompany.includes(trimmed)) return 1;
      return 0;
    });

    setFilteredCompanies(sorted);
  }, [searchTerm, companies]);

  const noResults = searchTerm.trim() !== "" && filteredCompanies.length === 0;
  const hasResults = filteredCompanies.length > 0;

  function getVotePercentage(up: number, down: number): string {
    const total = up + down;

    // No votes yet → show neutral 0%
    if (total === 0) {
      return "0%";
    }

    // Percentage of upvotes (always 0–100)
    const percentage = (up / total) * 100;

    // Round to nearest whole number
    return `${Math.round(percentage)}%`;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* Title */}
      <h1 className="text-5xl font-bold text-center mb-3">MaxRanked</h1>

      {/* Prompt text + buttons row (tighter, centered) */}
      <div className="hidden lg:flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 mb-12">
        {/* Left: About button */}
        <Link
          href="/about"
          className="text-yellow-400 hover:text-yellow-300 font-medium text-lg transition px-6 py-2 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-700/50"
        >
          About
        </Link>

        {/* Center: Prompt text (the "box") */}
        <p className="text-xl md:text-2xl text-center text-gray-400 flex-1 max-w-md">
          Where people rank companies.
        </p>

        {/* Right: Support button */}
        <a
          href="https://buymeacoffee.com/maxranked" // ← your real link
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-400 hover:text-yellow-300 font-medium text-lg transition px-6 py-2 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-700/50 flex items-center gap-2"
        >
          Support ☕
        </a>
      </div>

      {/* Search bar - now the star of the show */}
      <div className="max-w-3xl mx-auto mb-12 relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (searchTerm.trim()) {
                setShowAddForm(true);
              }
            }
          }}
          placeholder="Search..."
          className="
    w-full px-8 py-5 text-xl rounded-2xl
    border-2 border-blue-500
    focus:border-blue-500
    focus:outline-none
    bg-grey
    shadow-lg transition pr-32
  "
          autoFocus
        />

        {searchTerm.trim() && (
          <button
            onClick={() => setShowAddForm(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Add "{searchTerm.trim()}"
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        // Initial load: just a simple loading message (no cards at all)
        <div className="text-center mt-16">
          <p className="text-2xl text-gray-800 dark:text-gray-300 animate-pulse">
            Loading companies...
          </p>
        </div>
      ) : searchTerm.trim() === "" ? (
        // No search yet: prompt (still no cards)
        <p className="text-center text-2xl text-gray-800 dark:text-gray-300 mt-12 mb-12">
          Type a company name above to get started
        </p>
      ) : (
        // Search term exists: now show either results or no-results message + controlled form
        <>
          {hasResults ? (
            <div className="mt-16">
              <h2 className="text-4xl font-bold text-center mb-12 text-gray-800 dark:text-gray-300">
                Results for "{searchTerm}"
              </h2>

              {/* Horizontal swipe on mobile, grid on desktop */}
              <div className="overflow-x-auto snap-x snap-mandatory flex gap-6 pb-6 scrollbar-hide lg:grid lg:grid-cols-3 lg:gap-12 lg:overflow-x-visible lg:snap-none">
                {filteredCompanies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/company/${company.id}`}
                    className="
            snap-center flex-shrink-0 w-[85vw] max-w-sm lg:w-full lg:max-w-none
            bg-white dark:bg-gray-800
            rounded-2xl shadow-xl dark:shadow-gray-900/30
            p-6 hover:shadow-2xl transition-transform hover:-translate-y-2
            cursor-pointer no-underline flex flex-row items-start gap-6
            border border-gray-200 dark:border-gray-700
          "
                  >
                    {/* Left: Main company info & votes */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">
                        {company.company}
                      </h3>
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-4 text-center">
                        {company.country || "Global"}
                      </p>
                      <div className="flex justify-center gap-6 text-xl">
                        <span className="text-green-700 dark:text-green-500 font-bold">
                          ↑ {company.vote_up}
                        </span>
                        <span className="text-red-700 dark:text-red-500 font-bold">
                          ↓ {company.vote_down}
                        </span>
                        <span className="text-yellow-700 dark:text-yellow-500 font-semibold">
                          Rank:{" "}
                          {getVotePercentage(
                            company.vote_up,
                            company.vote_down,
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right: Brands & Assets */}
                    <div className="w-1/3 min-w-[140px] border-l border-gray-200 dark:border-gray-600 pl-4 hidden lg:block">
                      <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Assets
                      </h4>
                      {company.brands.length > 0 ? (
                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          {company.brands.map((brand: string, idx: number) => (
                            <li
                              key={idx}
                              className="hover:text-blue-700 dark:hover:text-blue-400 transition"
                            >
                              {brand}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          None listed
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="text-center mb-6">
                <p className="text-3xl font-semibold text-gray-800 dark:text-gray-300">
                  No company found for "{searchTerm}"
                </p>
                <p className="text-xl text-gray-800 dark:text-gray-300 mt-2">
                  Be the first to add it to MaxRanked!
                </p>
              </div>
              {/* Removed unconditional AddCompanyForm from here */}
            </div>
          )}

          {/* The form now only shows when user clicks the button or presses Enter */}
          {showAddForm && (
            <div className="mt-12 max-w-2xl mx-auto p-6 bg-gray-900/40 rounded-xl border border-gray-700">
              <AddCompanyForm
                searchTerm={searchTerm}
                companies={companies}
                onSuccess={() => {
                  setTimeout(() => {
                    setShowAddForm(false);
                    setSearchTerm(""); // clear search after success
                  }, 3500);
                }}
                onCancel={() => setShowAddForm(false)}
                // Remove onNameChange prop if you added it
              />
            </div>
          )}
        </>
      )}
      {/* Mobile bottom navigation bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-around items-center">
          <Link
            href="/about"
            className="flex flex-col items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition"
          >
            <span className="text-2xl mb-1">ℹ️</span>
            About
          </Link>

          <a
            href="https://buymeacoffee.com/maxranked"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 text-sm font-medium transition"
          >
            <span className="text-2xl mb-1">☕</span>
            Support
          </a>
        </div>
      </div>
    </main>
  );
}
