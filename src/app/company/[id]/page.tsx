"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AddCompanyForm from "@/components/AddCompanyForm";
import AddParentForm from "@/components/AddParentForm";

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
  const [hierarchy, setHierarchy] = useState<
    Array<{
      parent_id: number;
      child_id: number;
      parent: {
        company: string;
        vote_up: number | null;
        vote_down: number | null;
      } | null;
      child: {
        company: string;
        vote_up: number | null;
        vote_down: number | null;
      } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [voteType, setVoteType] = useState<"up" | "down" | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const companyId = Number(id);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [showAddParentForm, setShowAddParentForm] = useState(false);

  function getIndividualPercent(
    up: number | null,
    down: number | null,
  ): string {
    const upvotes = Number(up ?? 0);
    const downvotes = Number(down ?? 0);
    const total = upvotes + downvotes;

    if (total === 0) {
      return "No votes";
    }

    const percent = (upvotes / total) * 100;
    return `${Math.round(percent)}%`;
  }

  useEffect(() => {
    async function fetchAllCompanies() {
      const { data, error } = await supabase
        .from("companies")
        .select("id, company") // only need id and name for suggestions
        .order("company", { ascending: true });

      if (!error && data) {
        setAllCompanies(data);
      } else {
        console.error("Failed to fetch companies for suggestions:", error);
      }
    }

    fetchAllCompanies();
  }, []);

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
            `Loaded ${assetsData?.length || 0} assets for company ${companyId}`,
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
            parent:parent_id (company, vote_up, vote_down),
            child:child_id (company, vote_up, vote_down)
          `,
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

    // Clear previous toast
    setToastMessage(null);

    // Do NOT setHasVoted(true) here — wait for backend response

    try {
      const { error } = await supabase.from("pending_votes").insert({
        company_id: company.id,
        vote_type: type,
      });

      if (error) throw error;

      // Success: now disable and show message
      setHasVoted(true);
      setToastMessage("Vote recorded! Thank you!");
    } catch (err: any) {
      let message = "Vote failed – please try again";

      if (
        err.code === "23505" ||
        err.message?.includes("unique_violation") ||
        err.message?.includes("Already voted")
      ) {
        // Duplicate: disable + show already voted message
        setHasVoted(true);
        message = "You've already voted for this company in the last 48 hours!";
      } else {
        // Other error: keep buttons enabled
        setHasVoted(false);
      }

      setToastMessage(message);
    }

    // Toast clears after 4 seconds
    setTimeout(() => setToastMessage(null), 4000);
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
      <Link
        href="/"
        className="text-blue-400 hover:text-blue-300 text-base sm:text-lg font-medium mb-4 sm:mb-6 md:mb-8 block"
      >
        ← Back to search
      </Link>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Company Name & Location */}
        <h1 className="text-4xl xs:text-4.5xl sm:text-5xl md:text-6xl font-bold text-center mb-2 sm:mb-3 text-white">
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
              <span className="text-red-400">es</span> and Assets Explained
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
                Assets is a list of known assets owned by the displayed company.
                Alot of commonly used things are not standalone companies but
                rather, assets owned by the company.
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
              <div className="flex justify-center items-baseline gap-6 md:gap-5 mb-6">
                <span className="text-6xl md:text-6xl font-extrabold text-yellow-400">
                  {totalPercent}%
                </span>
                <span className="text-2xl md:text-2xl text-blue-400">
                  ({ownPercent}%)
                </span>
              </div>
              <p className="text-lg md:text-xl text-gray-400 mb-10">
                Rank Score - All (self)
              </p>

              <div className="flex justify-center items-baseline gap-12 md:gap-10 text-5xl md:text-6xl font-bold">
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
            <div>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-300 mb-8">
                Have your say!
              </h3>
              <div className="flex justify-center items-center gap-12 md:gap-5">
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
                  Vote sent – thank you!
                </p>
              )}
            </div>
          </div>

          {/* Right box: Brands & Assets */}
          <div className="w-96 min-w-[360px] bg-gray-800/60 rounded-2xl p-7 border border-gray-700 self-start mt-8">
            <div className="flex items-center justify-center gap-4 mb-5">
              <h3 className="text-3xl font-bold text-white">Assets</h3>
              <button
                onClick={() => setShowAddAsset(!showAddAsset)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-lg font-medium transition flex items-center gap-2 shadow-md"
                aria-label="Add new asset"
              >
                + ADD
              </button>
            </div>

            {showAddAsset && (
              <div className="mt-6 p-5 bg-gray-900/70 rounded-xl border border-gray-700">
                <AddCompanyForm
                  searchTerm=""
                  companies={allCompanies}
                  onSuccess={() => {
                    setShowAddAsset(false);
                    window.location.reload();
                  }}
                  onCancel={() => setShowAddAsset(false)}
                  forceAssetMode={true}
                  assetOwnerPreselect={company?.company}
                />
              </div>
            )}

            {assets.length === 0 ? (
              <p className="text-gray-400 py-8 italic">No assets listed yet</p>
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

        {/* === MOBILE LAYOUT - only visible on screens smaller than lg === */}
        <div className="lg:hidden space-y-6 px-3 sm:px-6 pb-6 sm:pb-8">
          {/* Rank Score Section */}
          <div className="text-center bg-gray-900/40 rounded-2xl p-6 border border-gray-700 mt-6">
            <div className="flex justify-center items-baseline gap-4 mb-4">
              <span className="text-6xl sm:text-7xl font-extrabold text-yellow-400">
                {totalPercent}%
              </span>
              <span className="text-2xl sm:text-3xl text-blue-400">
                ({ownPercent}%)
              </span>
            </div>

            <p className="text-lg sm:text-xl text-gray-400 mb-6">
              Rank Score - All (self)
            </p>

            <div className="flex justify-center gap-12 sm:gap-16 text-5xl sm:text-6xl font-bold">
              <span className="text-green-500 group relative">
                ↑ {totalUp}
                <span className="absolute left-1/2 -top-12 sm:-top-14 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm text-gray-300 bg-black p-3 rounded whitespace-nowrap z-10">
                  Regional: {ownVotes.regionalUp + childVotes.regionalUp}
                </span>
                <div className="text-blue-400 text-2xl sm:text-3xl mt-2">
                  ({ownVotes.up})
                </div>
              </span>

              <span className="text-red-500 group relative">
                ↓ {totalDown}
                <span className="absolute left-1/2 -top-12 sm:-top-14 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-sm text-gray-300 bg-black p-3 rounded whitespace-nowrap z-10">
                  Regional: {ownVotes.regionalDown + childVotes.regionalDown}
                </span>
                <div className="text-blue-400 text-2xl sm:text-3xl mt-2">
                  ({ownVotes.down})
                </div>
              </span>
            </div>
          </div>

          {/* Vote Buttons Section */}
          <div className="text-center">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-300 mb-8">
              Have your say!
            </h3>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12">
              <button
                onClick={() => handleVote("up")}
                disabled={hasVoted}
                className={`
          w-full sm:w-auto min-w-[200px]
          bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
          text-white px-12 py-7 rounded-2xl text-4xl sm:text-6xl font-bold
          transition shadow-xl
        `}
              >
                ↑ UP
              </button>

              <span className="text-3xl sm:text-4xl font-bold text-gray-500 hidden sm:block">
                Vote
              </span>

              <button
                onClick={() => handleVote("down")}
                disabled={hasVoted}
                className={`
          w-full sm:w-auto min-w-[200px]
          bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed
          text-white px-12 py-7 rounded-2xl text-4xl sm:text-6xl font-bold
          transition shadow-xl
        `}
              >
                ↓ DOWN
              </button>
            </div>

            {hasVoted && (
              <p className="mt-8 text-yellow-400 text-xl sm:text-2xl font-semibold">
                Vote sent – thank you!
              </p>
            )}

            {toastMessage && (
              <p className="mt-4 text-center text-yellow-300 text-lg">
                {toastMessage}
              </p>
            )}
          </div>

          {/* === The next two sections are REMOVED here on mobile === */}
          {/* Assets and Ranks explanation are already available via the left/right popout panels */}
          {/* If users want them, they tap the ← or → nubs halfway down the screen */}
        </div>

        {/* Mobile popout nubs & panels */}
        <div className="lg:hidden fixed inset-0 pointer-events-none">
          {/* Left nub - moved higher (about 35-40% from top) */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="pointer-events-auto fixed left-3 sm:left-4 top-[35%] sm:top-[38%] -translate-y-1/2 z-50 bg-gray-800/90 text-white p-4 sm:p-5 rounded-full shadow-2xl hover:bg-gray-700 transition text-2xl sm:text-3xl"
            aria-label="Toggle how ranks are formed"
          >
            ←
          </button>

          {/* Right nub - same height as left */}
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="pointer-events-auto fixed right-3 sm:right-4 top-[35%] sm:top-[38%] -translate-y-1/2 z-50 bg-gray-800/90 text-white p-4 sm:p-5 rounded-full shadow-2xl hover:bg-gray-700 transition text-2xl sm:text-3xl"
            aria-label="Toggle assets"
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
                  Assets is a list of known assets owned by the displayed
                  company. Alot of commonly used things are not standalone
                  companies but rather, assets owned by the company.
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
          } pointer-events-auto overflow-hidden`}
        >
          {/* Key change: add overflow-y-auto + full height here */}
          <div className="h-full overflow-y-auto overscroll-contain">
            <div className="p-6 pb-12">
              {" "}
              {/* extra pb-12 gives breathing room at bottom */}
              {/* Close button row */}
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-gray-900 z-10 py-2 -mx-6 px-6 -mt-6">
                <h3 className="text-2xl font-bold text-white">Assets</h3>
                <button
                  onClick={() => setRightOpen(false)}
                  className="text-gray-400 hover:text-white text-3xl"
                >
                  ×
                </button>
              </div>
              {/* ADD button row - make sticky too if you want */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <h3 className="text-2xl font-bold text-white">Assets</h3>
                <button
                  onClick={() => setShowAddAsset(!showAddAsset)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-base sm:text-lg font-medium transition shadow-md"
                >
                  + ADD
                </button>
              </div>
              {/* Add form - this can now be long without breaking layout */}
              {showAddAsset && (
                <div className="mt-6 p-5 bg-gray-950/70 rounded-xl border border-gray-700">
                  <AddCompanyForm
                    searchTerm=""
                    companies={allCompanies}
                    onSuccess={() => {
                      setShowAddAsset(false);
                      window.location.reload();
                    }}
                    onCancel={() => setShowAddAsset(false)}
                    forceAssetMode={true}
                    assetOwnerPreselect={company?.company}
                  />
                </div>
              )}
              {/* Assets list - grows as needed, scrolls with parent */}
              {assets.length === 0 ? (
                <p className="text-gray-400 py-10 italic text-center">
                  No assets listed yet
                </p>
              ) : (
                <ul className="space-y-4 pb-6">
                  {assets.map((asset, index) => (
                    <li
                      key={index}
                      className="bg-gray-900/50 p-5 rounded-xl text-center font-semibold text-gray-100"
                    >
                      {asset.asset_name}
                    </li>
                  ))}
                </ul>
              )}
              {/* Optional: extra spacer at very bottom if needed */}
              <div className="h-8" />
            </div>
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
      <div className="mt-8 lg:mt-16">
        <h2 className="text-4xl font-bold text-center mb-8 lg:mb-12 text-white">
          Company Hierarchy
        </h2>

        {/* Parents */}
        <div className="mb-12">
          {hierarchy.filter((h) => h.child_id === parseInt(id as string))
            .length === 0 ? (
            <div className="mb-12">
              <h3 className="text-3xl font-semibold text-center mb-8 text-gray-300">
                Parent
              </h3>

              {hierarchy.filter((h) => h.child_id === parseInt(id as string))
                .length === 0 ? (
                <div className="text-center">
                  <p className="text-xl text-gray-500 mb-4">No parents found</p>
                  <button
                    onClick={() => setShowAddParentForm(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition shadow-md"
                  >
                    + Add Parent
                  </button>
                </div>
              ) : (
                <ul className="space-y-6 max-w-2xl mx-auto">
                  {/* existing parent list */}
                </ul>
              )}

              {showAddParentForm && (
                <div className="mt-8 p-6 bg-gray-900/70 rounded-xl border border-gray-700 max-w-xl mx-auto">
                  <h4 className="text-xl font-bold text-white mb-4 text-center">
                    Add Parent Company
                  </h4>
                  <AddParentForm
                    childId={companyId}
                    companies={allCompanies} // ← from earlier fetch or pass your list
                    onSuccess={() => {
                      setShowAddParentForm(false);
                      window.location.reload(); // or better: refetch hierarchy
                    }}
                    onCancel={() => setShowAddParentForm(false)}
                  />
                </div>
              )}
            </div>
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
                      {getIndividualPercent(
                        h.parent.vote_up,
                        h.parent.vote_down,
                      )}
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
                      {getIndividualPercent(h.child.vote_up, h.child.vote_down)}
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
