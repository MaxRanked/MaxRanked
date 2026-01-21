// src/components/AddParentForm.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AddParentFormProps {
  childId: number;
  companies: any[]; // full list for suggestions
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AddParentForm({
  childId,
  companies,
  onSuccess,
  onCancel,
}: AddParentFormProps) {
  const [parentName, setParentName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (value: string) => {
    setParentName(value);

    if (value.trim() === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = companies
      .filter((c) => c.company.toLowerCase().includes(value.toLowerCase()))
      .map((c) => c.company)
      .slice(0, 8);

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleSelect = (selected: string) => {
    setParentName(selected);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) {
      setError("Parent company name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find the company ID by name
      const matchingCompany = companies.find(
        (c) => c.company.toLowerCase() === parentName.trim().toLowerCase(),
      );

      if (!matchingCompany) {
        throw new Error("No matching company found for that name");
      }

      const { error } = await supabase.from("pending_hierarchies").insert({
        parent_id: matchingCompany.id,
        child_id: childId,
      });

      if (error) throw error;

      setParentName("");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to submit. Try again.");
      console.error("Add parent error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <label className="block text-lg font-medium text-gray-300 mb-2">
          Parent Company Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={parentName}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => parentName && handleInputChange(parentName)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Company name..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-gray-300 focus:outline-none focus:border-blue-500"
          required
          autoFocus
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion}
                onMouseDown={() => handleSelect(suggestion)}
                className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-900"
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`px-6 py-2 rounded-lg text-white font-medium transition ${
            loading
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Submitting..." : "Add Parent"}
        </button>
      </div>
    </form>
  );
}
