"use client";

import { useState, useRef, useEffect } from "react";

interface ShareDropdownProps {
  company: {
    company: string;
    tag: string;
  };
}

export default function ShareDropdown({ company }: ShareDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pageUrl = `https://maxranked.com/company/${company.tag}`;
  const shareText = `Check out ${company.company} on MaxRanked! Rank it now →`;

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl);
    alert("Link copied to clipboard!");
    setIsOpen(false);
  };

  const shareOnX = () => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(pageUrl);
    window.open(
      `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=MaxRanked`,
      "_blank",
      "width=600,height=400",
    );
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Small Share button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-1.5
          text-sm font-medium text-gray-500 hover:text-gray-700
          px-3 py-1.5 rounded-full
          bg-gray-100 hover:bg-gray-200
          transition-colors
        "
        aria-label="Share this company"
      >
        Share
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="
            absolute top-full left-1/2 -translate-x-1/2 mt-2
            w-48 bg-white rounded-lg shadow-lg border border-gray-200
            py-1 z-50
          "
        >
          <button
            onClick={copyLink}
            className="
              w-full text-left px-4 py-2.5 text-sm text-gray-700
              hover:bg-gray-50 transition-colors
            "
          >
            Copy Link
          </button>

          <button
            onClick={shareOnX}
            className="
              w-full text-left px-4 py-2.5 text-sm text-gray-700
              hover:bg-gray-50 transition-colors flex items-center gap-2
            "
          >
            <span className="text-black font-black text-lg">𝕏</span>
            Share on X
          </button>
        </div>
      )}
    </div>
  );
}
