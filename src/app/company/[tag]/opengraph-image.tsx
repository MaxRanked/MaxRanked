// app/company/[tag]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabaseClient";

// export const runtime = 'edge'; // Fast, global edge execution (Vercel default)
export const dynamic = "force-dynamic"; // Or 'auto' — but force if votes change often

// Optional: Revalidate image cache every X seconds (e.g. 3600 = 1 hour)
// export const revalidate = 3600;

export default async function Image({ params }: { params: { tag: string } }) {
  const { tag } = await params;

  console.log("OG image generating for tag:", tag);

  // Fetch minimal company data (keep it light — no heavy joins)
  const { data: company, error } = await supabase
    .from("companies")
    .select("company, vote_up, vote_down")
    .eq("tag", tag)
    .single();

  if (error) {
    console.error("Supabase error in OG image:", error);
  }

  if (!company) {
    // Fallback image content if not found
    return new ImageResponse(
      <div
        style={{
          fontSize: 60,
          color: "white",
          background: "#333", // Darker fallback so it's not blinding white
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px",
        }}
      >
        Company "{tag}" not found – MaxRanked
      </div>,
      { width: 1200, height: 630 },
    );
  }

  const upvotes = Number(company.vote_up ?? 0);
  const downvotes = Number(company.vote_down ?? 0);
  const total = upvotes + downvotes;
  const percentage = total > 0 ? Math.round((upvotes / total) * 100) : 0;
  const rankText = `${percentage}% Upvoted`;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex", // Outer container: flex
        flexDirection: "column", // Stack vertically
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom right, #1e3a8a, #3b82f6)",
        color: "white",
        fontFamily: "sans-serif",
        padding: "40px",
      }}
    >
      {/* Company name – single text child, but wrapped for safety */}
      <div
        style={{
          display: "flex", // flex even if single child (harmless & safe)
          fontSize: 80,
          fontWeight: "bold",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        {company.company}
      </div>

      {/* Rank – big & bold */}
      <div
        style={{
          display: "flex",
          fontSize: 120,
          fontWeight: "bold",
        }}
      >
        {rankText}
      </div>

      {/* Votes row */}
      <div
        style={{
          display: "flex", // flex for side-by-side
          fontSize: 48,
          marginTop: 30,
          gap: 40, // spacing between items
        }}
      >
        <span>↑ {upvotes}</span>
        <span>•</span>
        <span>↓ {downvotes}</span>
      </div>

      {/* Bottom URL */}
      <div
        style={{
          display: "flex",
          fontSize: 32,
          marginTop: 40,
          opacity: 0.8,
        }}
      >
        maxranked.com/company/{tag}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
