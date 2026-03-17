// app/company/[tag]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'edge'; // Fast, global edge execution (Vercel default)
export const dynamic = 'force-dynamic'; // Or 'auto' — but force if votes change often

// Optional: Revalidate image cache every X seconds (e.g. 3600 = 1 hour)
// export const revalidate = 3600;

export default async function Image({ params }: { params: { tag: string } }) {
  const { tag } = await params;

  console.log('OG image generating for tag:', tag);

  // Fetch minimal company data (keep it light — no heavy joins)
  const { data: company, error } = await supabase
    .from('companies')
    .select('company, vote_up, vote_down')
    .eq('tag', tag)
    .single();

  if (error) {
    console.error('Supabase error in OG image:', error);
  }

  if (!company) {
    // Fallback image content if not found
    return new ImageResponse(
      <div
        style={{
          fontSize: 60,
          color: 'white',
          background: '#333', // Darker fallback so it's not blinding white
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px',
        }}
      >
        Company "{tag}" not found – MaxRanked
      </div>,
      { width: 1200, height: 630 }
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
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom right, #1e3a8a, #3b82f6)', // Blue theme – customize!
        fontSize: 48,
        color: 'white',
        fontFamily: 'sans-serif', // Or load custom font below
      }}
    >
      <div style={{ fontSize: 80, fontWeight: 'bold', marginBottom: 20 }}>{company.company}</div>
      <div style={{ fontSize: 120, fontWeight: 'bold' }}>{rankText}</div>
      <div style={{ fontSize: 48, marginTop: 30 }}>
        ↑ {upvotes} • ↓ {downvotes}
      </div>
      <div style={{ fontSize: 32, marginTop: 40, opacity: 0.8 }}>maxranked.com/company/{tag}</div>
    </div>,
    {
      width: 1200,
      height: 630,
      // Optional: Add custom fonts (Google Fonts or self-hosted)
      // fonts: [
      //   {
      //     name: 'Inter',
      //     data: await fetch('https://.../Inter-Bold.ttf').then(res => res.arrayBuffer()),
      //     style: 'normal',
      //     weight: 700,
      //   },
      // ],
    }
  );
}
