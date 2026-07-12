import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'

export async function GET() {
  try {
    const token = process.env.GITHUB_PAT
    if (!token) {
      return NextResponse.json({ error: 'GITHUB_PAT is missing' }, { status: 500 })
    }

    // Fetches all releases from GitHub API. 
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`GitHub API Error fetching releases:`, res.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 })
    }

    const data = await res.json()
    
    // We only process up to the 10 most recent releases to avoid rate limits on the compare API
    const recentReleases = data.slice(0, 10);

    const formattedReleases = await Promise.all(recentReleases.map(async (release: any) => {
      let body = release.body || '';

      const compareMatch = body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/compare\/([^\s]+)/);
      if (compareMatch && compareMatch[1]) {
        const compareStr = compareMatch[1];
        try {
          const compareRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/compare/${compareStr}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28',
            }
          });
          
          if (compareRes.ok) {
            const compareData = await compareRes.json();
            if (compareData.commits && compareData.commits.length > 0) {
              const validCommits = compareData.commits.filter((c: any) => !c.commit.message.startsWith('Merge pull request') && !c.commit.message.startsWith('Merge branch'));
              const commitsList = validCommits.map((c: any) => `✨ ${c.commit.message.split('\n')[0]}`).join('\n');
              body = body.replace(/\*\*Full Changelog\*\*.*/, `### Nesta Atualização:\n\n${commitsList}`);
            }
          }
        } catch (e) {
          console.error('Falha ao buscar commits do compare link para', release.tag_name, e);
        }
      }

      body = body.replace(/\*\*Full Changelog\*\*.*/g, '').trim()

      return {
        version: release.tag_name,
        name: release.name,
        body: body,
        published_at: release.published_at
      }
    }));

    return NextResponse.json(formattedReleases)
  } catch (error: any) {
    console.error('Error fetching releases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
