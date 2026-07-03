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
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`GitHub API Error fetching latest release:`, res.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch release' }, { status: 500 })
    }

    const data = await res.json()

    return NextResponse.json({
      version: data.tag_name,
      name: data.name,
      body: data.body,
      published_at: data.published_at
    })
  } catch (error: any) {
    console.error('Error fetching latest release:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
