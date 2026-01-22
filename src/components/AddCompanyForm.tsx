"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect } from "react";
import { countries } from "countries-list";
import { Country, State } from "country-state-city";

type Props = {
  searchTerm: string;
  companies: any[];
  onSuccess?: () => void;
  onCancel?: () => void;
  forceAssetMode?: boolean;
  assetOwnerPreselect?: string;
  onNameChange?: (newName: string) => void; // ← new prop for sync
};

export default function AddCompanyForm({
  searchTerm,
  companies,
  onSuccess,
  onCancel,
  forceAssetMode = false,
  onNameChange,
}: Props) {
  const [name, setName] = useState(searchTerm);

  useEffect(() => {
    setName(searchTerm); // Sync from parent to form
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    onNameChange?.(newName); // Sync back to parent (searchTerm)
  };
  const [isAsset, setIsAsset] = useState(false);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [parent, setParent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // New: auto-suggest state for owning/parent company
  const [parentSuggestions, setParentSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [countrySuggestions, setCountrySuggestions] = useState<string[]>([]);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [formName, setFormName] = useState(searchTerm);
  const isAssetMode = forceAssetMode ?? isAsset;

  useEffect(() => {
    if (forceAssetMode) {
      setIsAsset(true); // force checked
    }
  }, [forceAssetMode]);

  const handleParentChange = (value: string) => {
    setParent(value);

    if (value.trim() === "") {
      setParentSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = companies
      .filter((c) => c.company.toLowerCase().includes(value.toLowerCase()))
      .map((c) => c.company)
      .slice(0, 6); // Limit to 6 suggestions

    setParentSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    let autoReason: string | null = null;
    if (!isAsset) {
      const missing: string[] = [];
      if (!country.trim()) missing.push("country");
      if (!region.trim()) missing.push("region");
      if (missing.length > 0) {
        autoReason = `Missing ${missing.join(" and ")}`;
      }
    }
    {
      !isAssetMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* country input */}
          <div>{/* ... */}</div>
          {/* region input */}
          <div>{/* ... */}</div>
        </div>
      );
    }

    if (isAssetMode) {
      // Submit to pending_assets
      const { error } = await supabase.from("pending_assets").insert({
        company_name: parent.trim() || null,
        asset_name: formName.trim(), // ← use the editable name
      });

      if (error) {
        console.error("Error adding asset:", error);
        setMessage("Sorry, something went wrong. Try again?");
      } else {
        setMessage(
          `Thanks! "${name.trim()}" has been submitted as an asset for review.`,
        );
        setName(""); // clear after success
        setParent("");
        if (onSuccess) onSuccess();
      }
    } else {
      // Submit to pending_companies
      const { error } = await supabase.from("pending_companies").insert({
        company_name: formName.trim(), // ← also use editable name here
        country: country.trim() || null,
        region: region.trim() || null,
        parent_company_name: parent.trim() || null,
        reason: autoReason,
      });

      if (error) {
        console.error("Error adding company:", error);
        setMessage("Sorry, something went wrong. Try again?");
      } else {
        setMessage(
          `Thanks! "${formName.trim()}" has been submitted as an ${isAssetMode ? "asset" : "company"} for review.`,
        );
        setName(""); // clear
        setCountry("");
        setRegion("");
        setParent("");
        if (onSuccess) onSuccess();
      }
    }

    setLoading(false);
  };
  const handleCountryChange = (value: string) => {
    const trimmedValue = value.trim();

    // If user selects/submits "Global", force region to "All"
    if (trimmedValue.toLowerCase() === "global") {
      setCountry("Global");
      setRegion("All"); // ← auto-set region
      setRegionSuggestions([]); // clear any region suggestions
      setCountrySuggestions([]);
      return;
    }

    setCountry(trimmedValue);

    if (trimmedValue === "") {
      setCountrySuggestions([]);
      setRegionSuggestions([]);
      return;
    }

    // Country suggestions
    const matches = Country.getAllCountries()
      .filter(
        (c) =>
          c.name.toLowerCase().includes(trimmedValue.toLowerCase()) ||
          c.isoCode.toLowerCase().includes(trimmedValue.toLowerCase()),
      )
      .map((c) => c.name)
      .slice(0, 7);

    // Always include "Global" as first suggestion
    const finalSuggestions = [
      "Global",
      ...matches.filter((name) => name !== "Global"),
    ].slice(0, 8);

    setCountrySuggestions(finalSuggestions);

    // Load regions only for real countries
    const selected = Country.getAllCountries().find(
      (c) =>
        c.name.toLowerCase() === trimmedValue.toLowerCase() ||
        c.isoCode.toLowerCase() === trimmedValue.toLowerCase(),
    );

    if (selected) {
      const states = State.getStatesOfCountry(selected.isoCode);
      const regionNames = states.map((s) => s.name);
      const finalRegionSuggestions = ["All", ...regionNames];
      setRegionSuggestions(finalRegionSuggestions);
    } else {
      setRegionSuggestions([]);
    }
  };

  const handleRegionChange = (value: string) => {
    if (country.toLowerCase() === "global") {
      setRegion("All"); // Force "All" if country is Global
      return;
    }

    setRegion(value);

    if (value.trim() === "") {
      setRegionSuggestions([]);
      return;
    }

    // Filter existing suggestions
    const matches = regionSuggestions
      .filter((r) => r.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 8);

    setRegionSuggestions(matches);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Messages */}
      {message && message.includes("Thanks") && (
        <div className="mb-10 p-6 bg-green-100 border border-green-400 text-green-800 rounded-xl text-center">
          <p className="text-2xl font-semibold">{message}</p>
          <p className="text-lg mt-2">
            It will appear after review. 2-3 minutes. Thank you!
          </p>
        </div>
      )}

      {message && !message.includes("Thanks") && (
        <div className="mb-10 p-6 bg-red-100 border border-red-400 text-red-800 rounded-xl text-center">
          <p className="text-2xl font-semibold">{message}</p>
        </div>
      )}
      <h3 className="text-2xl font-bold mb-6 text-center text-white">
        {isAssetMode
          ? `Add Asset: ${formName.trim() || searchTerm.trim() || "New Asset"}`
          : `Add: ${searchTerm.trim() || "New Company"}`}
      </h3>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-2xl shadow-lg"
      >
        {/* Name */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Name
          </label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={isAssetMode ? "Asset" : "Input Name"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:border-blue-500"
            required
            autoFocus
          />
        </div>

        {/* Checkbox */}
        {!forceAssetMode && (
          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAsset}
                onChange={(e) => setIsAsset(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-lg font-medium text-gray-700">
                This is an asset of an existing company
              </span>
            </label>
          </div>
        )}

        {/* Country & Region - hidden when isAsset */}
        {!isAsset && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                Country <span className="text-gray-500">(recommended)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  placeholder="Country"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:border-blue-500"
                />

                {/* Country suggestions dropdown */}
                {countrySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {countrySuggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        onClick={() => {
                          setCountry(suggestion);
                          setCountrySuggestions([]);
                          if (suggestion === "Global") {
                            setRegion("All");
                            setRegionSuggestions([]); // No regions for Global
                          } else {
                            const selected = Country.getAllCountries().find(
                              (c) => c.name === suggestion,
                            );
                            if (selected) {
                              const states = State.getStatesOfCountry(
                                selected.isoCode,
                              );
                              const regionNames = states.map((s) => s.name);
                              // Prepend "All" here too, for consistency
                              setRegionSuggestions(["All", ...regionNames]);
                            } else {
                              setRegionSuggestions([]);
                            }
                          }
                        }}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-900"
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                Region <span className="text-gray-500">(recommended)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  placeholder="State/Province"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:border-blue-500"
                />

                {/* Region suggestions dropdown */}
                {regionSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {regionSuggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        onClick={() => {
                          setRegion(suggestion);
                          setRegionSuggestions([]);
                        }}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-900"
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Parent / Owning Company - with auto-suggest */}
        <div className="relative">
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isAssetMode ? "Owning Company" : "Parent Company"}{" "}
            <span className={isAssetMode ? "text-red-600" : "text-gray-500"}>
              *
            </span>
          </label>
          <input
            type="text"
            value={parent}
            onChange={(e) => handleParentChange(e.target.value)}
            onFocus={() => parent && handleParentChange(parent)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={isAsset ? "Owner" : "Parent"}
            required={isAssetMode}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:border-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            {isAssetMode
              ? "Start typing to see matching companies (required)"
              : "(optional) If this company has a parent/owner"}
          </p>

          {/* Auto-suggest dropdown */}
          {showSuggestions && parentSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {parentSuggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  onMouseDown={() => {
                    setParent(suggestion);
                    setShowSuggestions(false);
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-900 font-medium"
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="text-center pt-6">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-12 py-5 rounded-xl text-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-lg"
          >
            {loading
              ? "Submitting..."
              : isAssetMode
                ? "Submit"
                : "Submit for Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
