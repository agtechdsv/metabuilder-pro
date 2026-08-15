import { DownloadsClient } from './DownloadsClient'

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'

async function getLatestRelease() {
  try {
    const token = process.env.GITHUB_PAT
    if (!token) return null

    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 60 }
    })

    if (!res.ok) return null

    const data = await res.json()
    return {
      version: data.tag_name,
      name: data.name,
      published_at: data.published_at,
      assets: data.assets?.map((a: any) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
        size: a.size
      })) || []
    }
  } catch (error) {
    console.error('Error fetching latest release:', error)
    return null
  }
}

export default async function DownloadsPage() {
  const release = await getLatestRelease()

  return <DownloadsClient release={release} />
}
