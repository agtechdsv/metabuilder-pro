import { NextResponse } from 'next/server'

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'

export async function GET() {
  try {
    const token = process.env.GITHUB_PAT
    if (!token) {
      return NextResponse.json({ error: 'GITHUB_PAT is missing' }, { status: 500 })
    }

    // Fetches the latest release from GitHub API. 
    // Uses Next.js data cache to revalidate every 1 hour (3600 seconds) to avoid rate limits.
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`GitHub API Error fetching latest release:`, res.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch release' }, { status: 500 })
    }

    const data = await res.json()

    let body = data.body || '';

    // Se o corpo tiver um link de compare (ex: gerado automaticamente pelo Github),
    // vamos buscar os commits dessa diferença para listar em tópicos!
    const compareMatch = body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/compare\/([^\s]+)/);
    if (compareMatch && compareMatch[1]) {
      const compareStr = compareMatch[1]; // ex: v0.1.2...v0.1.3
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
            // Filtra commits de merge automáticos para deixar mais limpo
            const validCommits = compareData.commits.filter((c: any) => !c.commit.message.startsWith('Merge pull request') && !c.commit.message.startsWith('Merge branch'));
            const commitsList = validCommits.map((c: any) => `✨ ${c.commit.message.split('\n')[0]}`).join('\n');
            
            // Remove a linha do Full Changelog e insere os tópicos
            body = body.replace(/\*\*Full Changelog\*\*.*/, `### Nesta Atualização:\n\n${commitsList}`);
          }
        }
      } catch (e) {
        console.error('Falha ao buscar commits do compare link', e);
      }
    }

    // Remove a linha do Full Changelog de qualquer forma, mesmo se for o primeiro release (link /commits/)
    body = body.replace(/\*\*Full Changelog\*\*.*/g, '').trim()

    return NextResponse.json({
      version: data.tag_name,
      name: data.name,
      body: body,
      published_at: data.published_at
    })
  } catch (error: any) {
    console.error('Error fetching latest release:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
