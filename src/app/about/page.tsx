"use client";

import Link from "next/link";
import { useState } from "react"; // ← Add this import if not already there

export default function AboutPage() {
  const [privacyOpen, setPrivacyOpen] = useState(false); // ← THIS LINE FIXES THE ERROR

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-5xl md:text-5xl font-bold text-center mb-8 text-red-900 dark:text-white">
        About MaxRanked
      </h1>

      <div className="prose prose-invert max-w-none text-gray-900 dark:text-gray-100 space-y-6">
        <p className="text-2xl text-center">
          MaxRanked is meant to give people a place to rank companies and find
          hierarchical associations (who owns what). A good company will welcome
          being ranked by the public. To often, complaints fall on deaf ears and
          high praise falls silent among crowds. Use this service to help the
          world see what companies are truly loved, and those, that are not.
        </p>

        <p className="text-2xl text-center">
          Vote up or down. Add missing companies and assets. Map
          parent/subsidiary relationships. The data grows as users fill it. No
          corporate influences, just a shared view of who owns what and how the
          world ranks it.
        </p>

        <p className="text-2xl text-center">
          MaxRanked is a gift to the world. With it, hopefully companies will
          grow to offer the public what is truly wanted. This service is free to
          everyone but it costs money to run. If you find it useful, donations
          are greatly appreciated. Every bit helps keep it independent, and yes,
          might even buy me a coffee along the way.
        </p>

        <p className="text-3xl text-center text-yellow-400 font-medium">
          Thank You for being part of it.
        </p>
      </div>

      {/* Big red donate button */}
      <div className="flex justify-center mt-12">
        <a
          href="https://buymeacoffee.com/maxranked" // ← replace with your real link
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-12 py-6 bg-red-700 text-black text-3xl md:text-4xl font-bold rounded-2xl hover:bg-red-600 transition shadow-2xl hover:shadow-red-500/50"
        >
          Donate / Buy Me a Coffee ☕
        </a>
      </div>

      {/* Three buttons row - Privacy (left), X Follow (center), Contact (right) */}
      <div className="flex flex-wrap justify-center gap-6 md:gap-12 mt-12">
        {/* Privacy Button */}
        <button
          onClick={() => setPrivacyOpen(true)}
          className="px-10 py-4 bg-blue-500/30 text-back-200 font-medium rounded-xl hover:bg-blue-500/50 transition border border-blue-400/50 backdrop-blur-sm text-xl"
        >
          Privacy
        </button>

        {/* Social */}
        <a
          href="https://x.com/MaxRankedSystem"
          target="_blank"
          rel="noopener noreferrer"
          className="px-10 py-4 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition text-xl border border-gray-500"
        >
          Social X
        </a>

        {/* Contact Button */}
        <a
          href="mailto:MaxRanked@proton.me"
          className="px-10 py-4 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition text-xl border border-gray-500"
        >
          Contact
        </a>
      </div>

      {/* Back link */}
      <div className="text-center mt-12">
        <Link
          href="/"
          className="text-blue-400 hover:text-blue-300 underline text-lg"
        >
          ← Back to search
        </Link>
      </div>

      {/* Privacy Popup Modal */}
      {privacyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPrivacyOpen(false)} // ← CLICK OUTSIDE CLOSES
        >
          {/* Inner modal content - stop propagation so clicks inside don't close */}
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // ← IMPORTANT: Prevents closing when clicking inside modal
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Privacy Policy</h2>
              <button
                onClick={() => setPrivacyOpen(false)}
                className="text-gray-400 hover:text-white text-4xl"
              >
                ×
              </button>
            </div>

            {/* Placeholder text area - replace this with your real statement later */}
            <div className="text-center text-gray-300 space-y-4">
              <p>
                MaxRanked uses IP addresses to enforce voting restrictions upon
                voting. This IP is deleted within 3 days and never given to any
                3rd parties. When a vote is cast, the country and region
                (state/province) is recorded for regional rankings. This
                location information is not linked to any individual voter or IP
                address. The goal is to provide as close to fully anonymous
                usage as possible while still preventing vote spamming.
              </p>
              <p>
                All data MaxRanked collects, from votes to user IP addresses, is
                stored in an encrypted database compliant with the latest
                industry security standards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
