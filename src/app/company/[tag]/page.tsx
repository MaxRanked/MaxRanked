import { supabase } from '@/lib/supabaseClient';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ShareDropdown from '@/components/ShareDropdown';
import ClientComponent from './ClientComponent';

// Helper (can stay here or move to utils)

function getVotePercentage(up: number | null, down: number | null): string {
  const upvotes = Number(up ?? 0);
  const downvotes = Number(down ?? 0);
  const total = upvotes + downvotes;
  if (total === 0) return '0%';
  const percentage = (upvotes / total) * 100;
  return `${Math.round(percentage)}%`;
}

async function fetchDescendants(parentId: number): Promise<number[]> {
  const descendants: number[] = [];

  async function recurse(id: number) {
    const { data } = await supabase
      .from('company_hierarchies')
      .select('child_id')
      .eq('parent_id', id);

    if (data && data.length > 0) {
      for (const child of data) {
        const childId = child.child_id;
        descendants.push(childId);
        await recurse(childId);
      }
    }
  }

  await recurse(parentId);
  return descendants;
}
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;

  const { data: company } = await supabase
    .from('companies')
    .select('company, vote_up, vote_down, tag')
    .eq('tag', tag)
    .single();

  if (!company) {
    // You can return fallback metadata or nothing
    return {
      title: 'Company Not Found – MaxRanked',
      description: 'The requested company could not be found.',
    };
  }

  const rankText = getVotePercentage(company.vote_up, company.vote_down);
  const description = `Current rank: ${rankText} (${company.vote_up ?? 0} up / ${company.vote_down ?? 0} down) for ${company.company}. Visit the site to add your vote!`;

  const url = `https://maxranked.com/company/${company.tag}`;

  return {
    title: `${company.company} on MaxRanked – Rank: ${rankText}`,
    description,

    openGraph: {
      title: `${company.company} on MaxRanked`,
      description: `Rank: ${rankText} • ↑ ${company.vote_up ?? 0} • ↓ ${company.vote_down ?? 0}. Visit the site to add your vote!`,
      url,
      siteName: 'MaxRanked',
      type: 'website',
      images: [
        {
          url: `/company/${tag}/opengraph-image`, // Relative is fine with metadataBase set
          width: 1200,
          height: 630,
          alt: `${company.company} ranking on MaxRanked`,
        },
      ],
      // Optional: add later when you have dynamic or static OG images
      // images: [{ url: '/some-og-image.jpg', width: 1200, height: 630 }],
    },

    twitter: {
      images: [`/company/${tag}/opengraph-image`],
      card: 'summary_large_image', // or 'summary_large_image' if you add an image later
      title: `${company.company} on MaxRanked`,
      description: `Rank: ${rankText} • Up: ${company.vote_up ?? 0} • Down: ${company.vote_down ?? 0}. Visit the site to add your vote!`,
      // images: ['/some-twitter-image.jpg'],
    },
  };
}

export default async function CompanyDetail({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  // Fetch company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('tag', tag)
    .single();

  if (companyError || !company) {
    console.error('Company not found for tag:', tag, companyError);
    notFound();
  }

  const companyId = company.id;

  // Fetch assets
  const { data: assetsData } = await supabase
    .from('brands_assets')
    .select('company_id, asset_name')
    .eq('company_id', companyId)
    .order('asset_name', { ascending: true });

  const assets = assetsData ?? [];

  // Fetch all companies (for form suggestions)
  const { data: allCompaniesData } = await supabase
    .from('companies')
    .select('id, company')
    .order('company', { ascending: true });

  const allCompanies = allCompaniesData ?? [];

  // Own votes
  const { data: ownGlobal } = await supabase
    .from('companies')
    .select('vote_up, vote_down')
    .eq('id', companyId)
    .single();

  const { data: ownRegional } = await supabase
    .from('company_region_votes')
    .select('vote_up, vote_down')
    .eq('company_id', companyId)
    .maybeSingle();

  const ownVotes = {
    up: ownGlobal?.vote_up ?? 0,
    down: ownGlobal?.vote_down ?? 0,
    regionalUp: ownRegional?.vote_up ?? 0,
    regionalDown: ownRegional?.vote_down ?? 0,
  };

  // Hierarchy + descendants
  const hierarchySelect = [
    'parent_id',
    'child_id',
    'parent:parent_id (company, vote_up, vote_down, tag)',
    'child:child_id (company, vote_up, vote_down, tag)',
  ].join(', ');

  const { data: hierarchyData } = await supabase
    .from('company_hierarchies')
    .select(hierarchySelect)
    .or(`parent_id.eq.${companyId},child_id.eq.${companyId}`);

  const hierarchy = (hierarchyData as any[]) ?? [];

  // Descendants for child votes
  const descendants = await fetchDescendants(companyId);

  let childVotes = { up: 0, down: 0, regionalUp: 0, regionalDown: 0 };

  if (descendants.length > 0) {
    const { data: childGlobal } = await supabase
      .from('companies')
      .select('vote_up, vote_down')
      .in('id', descendants);

    const totalChildUp = childGlobal?.reduce((sum, v) => sum + (v.vote_up ?? 0), 0) ?? 0;
    const totalChildDown = childGlobal?.reduce((sum, v) => sum + (v.vote_down ?? 0), 0) ?? 0;

    const { data: childRegional } = await supabase
      .from('company_region_votes')
      .select('vote_up, vote_down')
      .in('company_id', descendants);

    const totalChildRegionalUp = childRegional?.reduce((sum, v) => sum + (v.vote_up ?? 0), 0) ?? 0;
    const totalChildRegionalDown =
      childRegional?.reduce((sum, v) => sum + (v.vote_down ?? 0), 0) ?? 0;

    childVotes = {
      up: totalChildUp,
      down: totalChildDown,
      regionalUp: totalChildRegionalUp,
      regionalDown: totalChildRegionalDown,
    };
  }

  // Derived values (passed as props)
  const ownNet = ownVotes.up - ownVotes.down;
  const childNet = childVotes.up - childVotes.down;
  const totalUp = ownVotes.up + childVotes.up;
  const totalDown = ownVotes.down + childVotes.down;
  const totalNet = totalUp - totalDown;
  const totalVotes = totalUp + totalDown;
  const totalPercent = totalVotes > 0 ? ((totalUp / totalVotes) * 100).toFixed(1) : '0.0';
  const ownPercent =
    ownVotes.up + ownVotes.down > 0
      ? ((ownVotes.up / (ownVotes.up + ownVotes.down)) * 100).toFixed(1)
      : '0.0';
  const childPercent =
    childVotes.up + childVotes.down > 0
      ? ((childVotes.up / (childVotes.up + childVotes.down)) * 100).toFixed(1)
      : '0.0';

  return (
    <>
      <ClientComponent
        company={company}
        companyId={companyId}
        assets={assets}
        allCompanies={allCompanies}
        ownVotes={ownVotes}
        childVotes={childVotes}
        hierarchy={hierarchy}
        totalPercent={totalPercent}
        ownPercent={ownPercent}
        totalUp={totalUp}
        totalDown={totalDown}
      />
    </>
  );
}
