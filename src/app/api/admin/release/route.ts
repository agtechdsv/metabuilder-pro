import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const OWNER = 'agtechdsv'
const REPO = 'metabuilder-pro'
const BRANCH = 'heads/master' // or refs/heads/master

async function githubFetch(endpoint: string, options: RequestInit = {}) {
  const token = process.env.GITHUB_PAT
  if (!token) throw new Error('GITHUB_PAT is not defined in environment variables.')

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`GitHub API Error (${endpoint}):`, res.status, errorText)
    throw new Error(`GitHub API Error: ${res.statusText}`)
  }

  return res.json()
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify if user is super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { version, releaseNotes, generateReleaseNotes, buildWindows = true, buildMacOs = true, buildLinux = true } = body

    if (!version) {
      return NextResponse.json({ error: 'Version is required' }, { status: 400 })
    }

    // Step 1: Get latest commit SHA from branch
    const refData = await githubFetch(`git/ref/${BRANCH}`)
    const latestCommitSha = refData.object.sha

    // Step 2: Get the commit to find the tree SHA
    const commitData = await githubFetch(`git/commits/${latestCommitSha}`)
    const baseTreeSha = commitData.tree.sha

    // Step 3: Get current files and modify them
    // Fetch package.json
    const packageJsonContentRes = await githubFetch(`contents/package.json?ref=master`)
    const packageJsonContent = Buffer.from(packageJsonContentRes.content, 'base64').toString('utf-8')
    const pkg = JSON.parse(packageJsonContent)
    pkg.version = version
    const newPackageJsonStr = JSON.stringify(pkg, null, 2) + '\n'

    // Fetch tauri.conf.json
    const tauriConfRes = await githubFetch(`contents/src-tauri/tauri.conf.json?ref=master`)
    const tauriConfContent = Buffer.from(tauriConfRes.content, 'base64').toString('utf-8')
    const tauriConf = JSON.parse(tauriConfContent)
    tauriConf.version = version
    const newTauriConfStr = JSON.stringify(tauriConf, null, 2) + '\n'

    // Step 4: Create Blobs for the new files
    const packageBlob = await githubFetch(`git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: newPackageJsonStr, encoding: 'utf-8' })
    })

    const tauriBlob = await githubFetch(`git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: newTauriConfStr, encoding: 'utf-8' })
    })

    // Step 5: Create a new Tree
    const newTree = await githubFetch(`git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          { path: 'package.json', mode: '100644', type: 'blob', sha: packageBlob.sha },
          { path: 'src-tauri/tauri.conf.json', mode: '100644', type: 'blob', sha: tauriBlob.sha }
        ]
      })
    })

    // Step 6: Create the new Commit
    const newCommit = await githubFetch(`git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `chore: bump version to ${version}`,
        tree: newTree.sha,
        parents: [latestCommitSha]
      })
    })

    // Step 7: Update the Branch Ref
    await githubFetch(`git/refs/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha })
    })

    // Step 8: Create the Release (which will also create the tag)
    const releasePayload: any = {
      tag_name: `v${version}`,
      target_commitish: 'master',
      name: `MetaBuilder PRO v${version}`,
      draft: false,
      prerelease: false,
      generate_release_notes: generateReleaseNotes
    }

    if (!generateReleaseNotes && releaseNotes) {
      releasePayload.body = releaseNotes
    }

    const releaseData = await githubFetch(`releases`, {
      method: 'POST',
      body: JSON.stringify(releasePayload)
    })

    // Step 9: Trigger the GitHub Action via workflow_dispatch with OS selections
    await githubFetch(`actions/workflows/build-tauri.yml/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'master',
        inputs: {
          build_windows: buildWindows ? 'true' : 'false',
          build_macos: buildMacOs ? 'true' : 'false',
          build_linux: buildLinux ? 'true' : 'false'
        }
      })
    })

    return NextResponse.json({ success: true, releaseUrl: releaseData.html_url })

  } catch (error: any) {
    console.error('Release API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
