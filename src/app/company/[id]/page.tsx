"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CompanyDetail() {
  const { id } = useParams();
  const [company, setCompany] = useState<any | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [ownVotes, setOwnVotes] = useState<{
    up: number;
    down: number;
    regionalUp: number;
    regionalDown: number;
  }>({ up: 0, down: 0, regionalUp: 0, regionalDown: 0 });
  const [childVotes, setChildVotes] = useState<{
    up: number;
    down: number;
    regionalUp: number;
    regionalDown: number;
  }>({ up: 0, down: 0, regionalUp: 0, regionalDown: 0 });
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteType, setVoteType] = useState<"up" | "down" | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const companyId = Number(id);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Fetch company basic info
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();

      if (companyData) {
        setCompany(companyData);

        const companyId = Number(id);

        if (isNaN(companyId)) {
          console.error("Invalid company ID from URL:", id);
          setLoading(false);
          return;
        }

        // Fetch assets
        const { data: assetsData, error: assetsError } = await supabase
          .from("brands_assets")
          .select("company_id, asset_name")
          .in("company_id", [companyId])
          .order("asset_name", { ascending: true });

        if (assetsError) {
          console.error("Assets fetch failed - full error:", assetsError);
        } else {
          setAssets(assetsData || []);
          console.log(
            `Loaded ${assetsData?.length || 0} assets for company ${companyId}`
          );
        }

        // NEW: Await the lockout check HERE (inside async fetchData)
        await checkVoteLockout();

        // Fetch hierarchy recursively
        const descendants = await fetchDescendants(id as string);

        // Fetch own votes
        const { data: ownGlobalVotes } = await supabase
          .from("companies")
          .select("vote_up, vote_down")
          .eq("id", id)
          .single();

        // Own regional votes
        let ownRegionalQuery = supabase
          .from("company_region_votes")
          .select("vote_up, vote_down")
          .eq("company_id", companyId);

        const { data: ownRegionalVotes } = await ownRegionalQuery.maybeSingle();

        setOwnVotes({
          up: ownGlobalVotes?.vote_up || 0,
          down: ownGlobalVotes?.vote_down || 0,
          regionalUp: ownRegionalVotes?.vote_up || 0,
          regionalDown: ownRegionalVotes?.vote_down || 0,
        });

        // Fetch child votes
        if (descendants.length > 0) {
          const { data: childGlobalVotes } = await supabase
            .from("companies")
            .select("vote_up, vote_down")
            .in("id", descendants);

          const totalChildUp =
            childGlobalVotes?.reduce((sum, v) => sum + v.vote_up, 0) || 0;
          const totalChildDown =
            childGlobalVotes?.reduce((sum, v) => sum + v.vote_down, 0) || 0;

          let childRegionalQuery = supabase
            .from("company_region_votes")
            .select("vote_up, vote_down")
            .in("company_id", descendants);

          const { data: childRegionalVotes } = await childRegionalQuery;

          const totalChildRegionalUp =
            childRegionalVotes?.reduce((sum, v) => sum + v.vote_up, 0) || 0;
          const totalChildRegionalDown =
            childRegionalVotes?.reduce((sum, v) => sum + v.vote_down, 0) || 0;

          setChildVotes({
            up: totalChildUp,
            down: totalChildDown,
            regionalUp: totalChildRegionalUp,
            regionalDown: totalChildRegionalDown,
          });
        }

        // Fetch hierarchy for display
        const { data: hierarchyData } = await supabase
          .from("company_hierarchies")
          .select(
            `
          parent_id,
          child_id,
          parent:parent_id (company),
          child:child_id (company)
        `
          )
          .or(`parent_id.eq.${id},child_id.eq.${id}`);

        setHierarchy(hierarchyData || []);
      }

      setLoading(false);
    }

    fetchData();
  }, [id]);
  async function checkVoteLockout() {
    // No client-side check needed anymore — backend rejects duplicates
    setHasVoted(false); // Default to allow vote (backend will block if needed)
  }

  // Call it after fetching salt

  const handleVote = async (type: "up" | "down") => {
    if (!company?.id) {
      setToastMessage("Company ID not available");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // Disable buttons immediately (optimistic)
    setHasVoted(true);

    try {
      const { error } = await supabase.from("pending_votes").insert({
        company_id: company.id,
        vote_type: type,
      });

      if (error) throw error;

      // Success
      setToastMessage("Vote recorded! Thank you!");
      console.log("Success toast set - waiting 4s");
    } catch (err: any) {
      let message = "Vote failed - please try again";

      if (
        err.code === "23505" ||
        err.message?.includes("unique_violation") ||
        err.message?.includes("Already voted")
      ) {
        message = "You've already voted for this company in the last 48 hours!";
        // Keep buttons disabled on duplicate (good)
        setHasVoted(true);
      } else {
        // Only log real unexpected errors
        console.error("Unexpected vote error:", err);
        // Re-enable on rare other errors (optional - you can remove setHasVoted(false) if you prefer permanent disable)
        setHasVoted(false);
      }

      setToastMessage(message);
      console.log("Error toast set - waiting 4s:", message);
    }

    // Shared delay: message stays 4s, then reload (works for both success & error)
    setTimeout(() => {
      console.log("Timer complete - clearing toast & reloading");
      setToastMessage(null);
      window.location.reload();
    }, 4000);
  };

  async function fetchDescendants(companyId: string): Promise<string[]> {
    let descendants: string[] = [];

    async function recurse(id: string) {
      const { data } = await supabase
        .from("company_hierarchies")
        .select("child_id")
        .eq("parent_id", id);

      if (data && data.length > 0) {
        for (const child of data) {
          descendants.push(child.child_id.toString());
          await recurse(child.child_id.toString());
        }
      }
    }

    await recurse(companyId);
    return descendants;
  }

  const ownNet = ownVotes.up - ownVotes.down;
  const childNet = childVotes.up - childVotes.down;
  const totalUp = ownVotes.up + childVotes.up;
  const totalDown = ownVotes.down + childVotes.down;
  const totalNet = totalUp - totalDown;
  const totalVotes = totalUp + totalDown;
  const totalPercent =
    totalVotes > 0 ? ((totalUp / totalVotes) * 100).toFixed(1) : "0.0";
  const ownPercent =
    ownVotes.up + ownVotes.down > 0
      ? ((ownVotes.up / (ownVotes.up + ownVotes.down)) * 100).toFixed(1)
      : "0.0";
  const childPercent =
    childVotes.up + childVotes.down > 0
      ? ((childVotes.up / (childVotes.up + childVotes.down)) * 100).toFixed(1)
      : "0.0";

  if (loading)
    return (
      <p className="text-center text-gray-400 mt-20">
        Loading company details...
      </p>
    );

  if (!company)
    return <p className="text-center text-red-500 mt-20">Company not found</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <Link href="/" className="text-blue-500 hover:text-blue-700 mb-8 block">
        &larr; Back to search
      </Link>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Company Name & Location */}
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-3 text-white">
          {company.company}
        </h1>
        <p className="text-xl md:text-2xl text-center text-gray-400 mb-12">
          {company.country || "Global"}
          {company.region && company.region !== "All" && ` (${company.region})`}
        </p>

        {/* Three-column balanced layout on desktop */}
        <div className="hidden lg:flex justify-center gap-8 xl:gap-16">
          {/* Left box: How Ranks Are Formed */}
          <div className="w-96 min-w-[360px] bg-gray-800/60 rounded-2xl p-7 border border-gray-700 text-center self-start mt-8">
            <h3 className="text-3xl font-bold text-white mb-6">
              <span className="text-yellow-400">Ranks</span>,{" "}
              <span className="text-green-400">Vot</span>
              <span className="text-red-400">es</span>, Brands & Assets
              Explained
            </h3>

            <div className="text-gray-300 text-base space-y-4 text-center">
              <p>
                Colored <span className="text-green-400">Vot</span>
                <span className="text-red-400">es</span> are a combined total
                from the displayed company and all subsidiaries.{" "}
                <span className="text-yellow-400">Ranks</span> are a percentage
                between vote totals. The{" "}
                <span className="text-blue-400">(blue)</span> numbers are from
                the displayed company alone.
              </p>

              <p>
                Brands & Assets is a list of known assets owned by the displayed
                company. Alot of commonly used things are not standalone
                companies but rather, brands or assets owned by the company.
              </p>

              <p>
                Mouse over tooltips show regional data for your region if
                available.
              </p>

              {/* Add more <p> blocks here anytime */}
            </div>
          </div>

          {/* Centered main content: Ranks + Vote buttons */}
          <div className="w-full max-w-3xl text-center">
            {/* Rank Totals */}
            <div className="mb-12">
              <div className="flex justify-center items-baseline gap-6 md:gap-10 mb-6">
                <span className="text-6xl md:text-7xl font-extrabold text-yellow-400">
                  {totalPercent}%
                </span>
                <span className="text-2xl md:text-3xl text-blue-400">
                  ({ownPercent}%)
                </span>
              </div>
              <p className="text-lg md:text-xl text-gray-400 mb-10">
                Rank Score - All (self)
              </p>

              <div className="flex justify-center items-baseline gap-16 md:gap-24 text-5xl md:text-6xl font-bold">
                <span className="text-green-600 group relative">
                  ↑ {totalUp}
                  <span className="absolute left-1/2 -top-14 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm text-gray-300 bg-black p-3 rounded whitespace-nowrap z-10">
                    Regional: {ownVotes.regionalUp + childVotes.regionalUp}
                  </span>
                  <span className="text-blue-400 text-3xl md:text-4xl ml-4">
                    ({ownVotes.up})
                  </span>
                </span>

                <span className="text-red-600 group relative">
                  ↓ {totalDown}
                  <span className="absolute left-1/2 -top-14 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm text-gray-300 bg-black p-3 rounded whitespace-nowrap z-10">
                    Regional: {ownVotes.regionalDown + childVotes.regionalDown}
                  </span>
                  <span className="text-blue-400 text-3xl md:text-4xl ml-4">
                    ({ownVotes.down})
                  </span>
                </span>
              </div>
            </div>

            {/* Vote Buttons */}
            {/* Vote Buttons */}
            <div>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-300 mb-8">
                Have your say!
              </h3>
              <div className="flex justify-center items-center gap-12 md:gap-20">
                <button
                  onClick={() => handleVote("up")}
                  disabled={hasVoted}
                  className={`group relative bg-green-700 text-white px-10 md:px-14 py-6 md:py-8 rounded-2xl text-5xl md:text-6xl font-bold transition shadow-xl ${
                    hasVoted
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-green-600"
                  }`}
                >
                  ↑
                  <span className="absolute left-1/2 -bottom-16 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm md:text-base text-gray-200 bg-black/90 p-3 md:p-4 rounded-xl whitespace-nowrap z-10">
                    Vote Up
                  </span>
                </button>

                <span className="text-3xl md:text-4xl font-bold text-gray-500">
                  Vote
                </span>

                <button
                  onClick={() => handleVote("down")}
                  disabled={hasVoted}
                  className={`group relative bg-red-700 text-white px-10 md:px-14 py-6 md:py-8 rounded-2xl text-5xl md:text-6xl font-bold transition shadow-xl ${
                    hasVoted
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-red-600"
                  }`}
                >
                  ↓
                  <span className="absolute left-1/2 -bottom-16 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm md:text-base text-gray-200 bg-black/90 p-3 md:p-4 rounded-xl whitespace-nowrap z-10">
                    Vote Down
                  </span>
                </button>
              </div>

              {hasVoted && (
                <p className="text-center text-yellow-400 mt-6 text-xl font-semibold">
                  You've already voted – thank you!
                </p>
              )}
            </div>
          </div>

          {/* Right box: Brands & Assets */}
          <div className="w-96 min-w-[360px] bg-gray-800/60 rounded-2xl p-7 border border-gray-700 text-center self-start mt-8">
            <h3 className="text-3xl font-bold text-white mb-6">
              Brands & Assets
            </h3>

            {assets.length === 0 ? (
              <p className="text-gray-400 py-8 italic">
                No brands or assets listed yet
              </p>
            ) : (
              <ul className="space-y-4">
                {assets.map((asset, index) => (
                  <li
                    key={index}
                    className="bg-gray-900/50 p-5 rounded-xl hover:bg-gray-700/50 transition"
                  >
                    <div className="font-semibold text-xl text-gray-100">
                      {asset.asset_name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Mobile popout nubs & panels */}
        <div className="lg:hidden fixed inset-0 pointer-events-none">
          {/* Left nub - halfway up, left side */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="pointer-events-auto fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-gray-800/90 text-white p-5 rounded-full shadow-2xl hover:bg-gray-700 transition text-3xl"
            aria-label="Toggle how ranks are formed"
          >
            ←
          </button>

          {/* Right nub - halfway up, right side */}
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="pointer-events-auto fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-gray-800/90 text-white p-5 rounded-full shadow-2xl hover:bg-gray-700 transition text-3xl"
            aria-label="Toggle brands & assets"
          >
            →
          </button>
        </div>

        {/* Left panel */}
        <div
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out ${
            leftOpen ? "translate-x-0" : "-translate-x-full"
          } pointer-events-auto`}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">
                How Ranks Are Formed
              </h3>
              <button
                onClick={() => setLeftOpen(false)}
                className="text-gray-400 hover:text-white text-3xl"
              >
                ×
              </button>
            </div>
            {/* Your full left box content (same as desktop) */}
            <div className="text-gray-300 text-base space-y-4 text-left">
              <div className="text-gray-300 text-base space-y-4 text-center">
                <p>
                  Colored <span className="text-green-400">Vot</span>
                  <span className="text-red-400">es</span> are a combined total
                  from the displayed company and all subsidiaries.{" "}
                  <span className="text-yellow-400">Ranks</span> are a
                  percentage between vote totals. The{" "}
                  <span className="text-blue-400">(blue)</span> numbers are from
                  the displayed company alone.
                </p>

                <p>
                  Brands & Assets is a list of known assets owned by the
                  displayed company. Alot of commonly used things are not
                  standalone companies but rather, brands or assets owned by the
                  company.
                </p>

                <p>
                  Mouse over tooltips show regional data for your region if
                  available.
                </p>

                {/* Add more <p> blocks here anytime */}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div
          className={`lg:hidden fixed inset-y-0 right-0 z-50 w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out ${
            rightOpen ? "translate-x-0" : "translate-x-full"
          } pointer-events-auto`}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Brands & Assets</h3>
              <button
                onClick={() => setRightOpen(false)}
                className="text-gray-400 hover:text-white text-3xl"
              >
                ×
              </button>
            </div>
            {/* Your full right box content (same as desktop) */}
            {assets.length === 0 ? (
              <p className="text-gray-400 py-8 italic">
                No brands or assets listed yet
              </p>
            ) : (
              <ul className="space-y-4">
                {assets.map((asset, index) => (
                  <li key={index} className="bg-gray-900/50 p-5 rounded-xl">
                    <div className="font-semibold text-gray-100">
                      {asset.asset_name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Backdrop - click to close both */}
        {(leftOpen || rightOpen) && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 pointer-events-auto"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
      </div>

      {/* Company Hierarchy – unchanged */}
      <div className="mt-16">
        <h2 className="text-4xl font-bold text-center mb-12 text-white">
          Company Hierarchy
        </h2>

        {/* Parents */}
        <div className="mb-12">
          <h3 className="text-3xl font-semibold text-center mb-8 text-gray-300">
            Parent
          </h3>
          {hierarchy.filter((h) => h.child_id === parseInt(id as string))
            .length === 0 ? (
            <p className="text-center text-xl text-gray-500">
              No parents found
            </p>
          ) : (
            <ul className="space-y-6 max-w-2xl mx-auto">
              {hierarchy
                .filter((h) => h.child_id === parseInt(id as string))
                .map((h) => (
                  <li
                    key={h.parent_id}
                    className="text-2xl font-bold text-gray-200 flex justify-between items-center bg-gray-800/30 p-6 rounded-xl hover:bg-gray-700/50 transition"
                  >
                    <Link
                      href={`/company/${h.parent_id}`}
                      className="hover:text-blue-400 transition"
                    >
                      {h.parent.company}
                    </Link>
                    <span className="text-yellow-400 text-xl">
                      {totalPercent}%{" "}
                      {/* Placeholder; replace with per-company % if you add that later */}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Subsidiaries */}
        <div>
          <h3 className="text-3xl font-semibold text-center mb-8 text-gray-300">
            Subsidiaries
          </h3>
          {hierarchy.filter((h) => h.parent_id === parseInt(id as string))
            .length === 0 ? (
            <p className="text-center text-xl text-gray-500">
              No subsidiaries found
            </p>
          ) : (
            <ul className="space-y-6 max-w-2xl mx-auto">
              {hierarchy
                .filter((h) => h.parent_id === parseInt(id as string))
                .map((h) => (
                  <li
                    key={h.child_id}
                    className="text-2xl font-bold text-gray-200 flex justify-between items-center bg-gray-800/30 p-6 rounded-xl hover:bg-gray-700/50 transition"
                  >
                    <Link
                      href={`/company/${h.child_id}`}
                      className="hover:text-blue-400 transition"
                    >
                      {h.child.company}
                    </Link>
                    <span className="text-yellow-400 text-xl">
                      {totalPercent}% {/* Placeholder */}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
