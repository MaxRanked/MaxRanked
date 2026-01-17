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
      return;
    }

    const trimmed = searchTerm.trim().toLowerCase();

    // First: exact matches (case-insensitive)
    const exactMatch = companies.filter(
      (c) => c.company.toLowerCase() === trimmed,
    );

    // Then: partial matches (excluding exact ones to avoid duplicates)
    const partialMatches = companies.filter(
      (c) =>
        c.company.toLowerCase().includes(trimmed) &&
        c.company.toLowerCase() !== trimmed,
    );

    // Combine: exact first, then partials
    setFilteredCompanies([...exactMatch, ...partialMatches]);
  }, [searchTerm, companies]);

  const noResults = searchTerm.trim() !== "" && filteredCompanies.length === 0;
  const hasResults = filteredCompanies.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* Title */}
      <h1 className="text-5xl font-bold text-center mb-3">MaxRanked</h1>

      {/* Prompt text + buttons row (tighter, centered) */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 mb-12">
        {/* Left: About button */}
        <Link
          href="/about"
          className="text-blue-400 hover:text-blue-300 font-medium text-lg transition px-6 py-2 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-700/50"
        >
          About
        </Link>

        {/* Center: Prompt text (the "box") */}
        <p className="text-xl md:text-2xl text-center text-gray-400 flex-1 max-w-md">
          Where the public ranks companies.
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
          placeholder="Search for any company..."
          className="w-full px-8 py-5 text-xl rounded-2xl border-2 border-gray-300 focus:outline-none focus:border-blue-500 shadow-lg transition pr-32"
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
          <p className="text-2xl text-gray-500 animate-pulse">
            Loading companies...
          </p>
        </div>
      ) : searchTerm.trim() === "" ? (
        // No search yet: prompt (still no cards)
        <p className="text-center text-2xl text-gray-500 mt-12 mb-12">
          Type a company name above to get started
        </p>
      ) : (
        // Search term exists: now show either results or no-results message + controlled form
        <>
          {hasResults ? (
            <div className="mt-16">
              <h2 className="text-4xl font-bold text-center mb-12 text-gray-300">
                Results for "{searchTerm}"
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl w-full mx-auto">
                {filteredCompanies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/company/${company.id}`}
                    className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-transform hover:-translate-y-2 cursor-pointer w-full max-w-md no-underline flex flex-row items-start gap-6"
                  >
                    {/* Left: Main company info & votes */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2 text-gray-900 text-center">
                        {company.company}
                      </h3>
                      <p className="text-lg text-gray-600 mb-4 text-center">
                        {company.country || "Global"}
                      </p>
                      <div className="flex justify-center gap-6 text-xl">
                        <span className="text-green-600 font-bold">
                          ↑ {company.vote_up}
                        </span>
                        <span className="text-red-600 font-bold">
                          ↓ {company.vote_down}
                        </span>
                        <span className="text-gray-800 font-semibold">
                          Net: {company.vote_up - company.vote_down}
                        </span>
                      </div>
                    </div>

                    {/* Right: Brands & Assets */}
                    <div className="w-1/3 min-w-[140px] border-l border-gray-200 pl-4">
                      <h4 className="text-base font-semibold text-gray-800 mb-2">
                        Brands & Assets
                      </h4>
                      {company.brands.length > 0 ? (
                        <ul className="space-y-1 text-sm text-gray-600">
                          {company.brands.map((brand: string, idx) => (
                            <li
                              key={idx}
                              className="hover:text-blue-600 transition"
                            >
                              {brand}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
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
                <p className="text-3xl font-semibold text-gray-800">
                  No company found for "{searchTerm}"
                </p>
                <p className="text-xl text-gray-600 mt-2">
                  Be the first to add it to MaxRanked!
                </p>
              </div>
              {/* Removed unconditional AddCompanyForm from here */}
            </div>
          )}

          {/* The form now only shows when user clicks the button or presses Enter */}
          {showAddForm && (
            <div className="mt-12 max-w-2xl mx-auto p-6 bg-gray-900/40 rounded-xl border border-gray-700">
              <h3 className="text-2xl font-bold mb-6 text-center text-white">
                Add company: {searchTerm.trim()}
              </h3>

              <AddCompanyForm
                searchTerm={searchTerm}
                companies={companies}
                // Recommended callbacks (add these props to your AddCompanyForm if needed)
                onSuccess={() => {
                  setTimeout(() => {
                    setShowAddForm(false);
                    setSearchTerm("");
                  }, 4000); // ← 2.8 seconds delay - feel free to adjust (2000 = 2s, 3500 = 3.5s)
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
