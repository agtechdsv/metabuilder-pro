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
    
    let detailedMessage = res.statusText
    try {
      const parsed = JSON.parse(errorText)
      if (parsed.message) {
        detailedMessage = parsed.message
        if (parsed.errors && parsed.errors.length > 0) {
          detailedMessage += ` - ${parsed.errors[0].code} in field ${parsed.errors[0].field}`
        }
      }
    } catch(e) {}
    
    throw new Error(`GitHub API Error: ${detailedMessage}`)
  }

  if (res.status === 204) {
    return null
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

    // Step 3.5: Generate Changelog using Gemini (if key is present)
    let newChangelogStr = ''
    try {
      if (process.env.GEMINI_API_KEY) {
        let contentToTranslate = ''
        
        if (generateReleaseNotes) {
          // Obter a última release para ver os commits desde então
          const latestRelease = await githubFetch(`releases/latest`).catch(() => null)
          
          if (latestRelease && latestRelease.tag_name) {
            const compare = await githubFetch(`compare/${latestRelease.tag_name}...master`)
            if (compare.commits && compare.commits.length > 0) {
              contentToTranslate = compare.commits.map((c: any) => c.commit.message).join('\n')
            }
          } else {
            // Fallback se não tiver release: pegar ultimos 10 commits
            const commits = await githubFetch(`commits?per_page=10`)
            contentToTranslate = commits.map((c: any) => c.commit.message).join('\n')
          }
        } else if (releaseNotes) {
          contentToTranslate = releaseNotes
        }

        if (contentToTranslate) {
          const prompt = `
Você é um assistente responsável por criar um Histórico de Atualizações (Release Notes) para usuários finais.
Abaixo estão as informações da nova versão (podem ser mensagens de commit ou um texto de lançamento oficial).
Sua tarefa é ler esse conteúdo, remover jargões extremamente técnicos, agrupar o que faz sentido e gerar uma lista de tópicos curtos, diretos e amigáveis (bullet points).

O resultado deve ser EXATAMENTE um objeto JSON válido no seguinte formato:
{
  "pt": ["Ponto 1", "Ponto 2"],
  "en": ["Point 1", "Point 2"],
  "es": ["Punto 1", "Punto 2"]
}

Conteúdo:
${contentToTranslate}
`

          const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              system_instruction: {
                parts: { text: 'You are a helpful assistant that strictly outputs valid JSON without markdown.' }
              },
              contents: [
                { parts: [{ text: prompt }] }
              ],
              generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json'
              }
            })
          })

          const aiData = await aiResponse.json()
          if (!aiData.error && aiData.candidates && aiData.candidates.length > 0) {
            const aiContent = aiData.candidates[0].content.parts[0].text
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const parsedChangelog = JSON.parse(jsonMatch[0])
              
              // Pegar o changelog.json atual do repositório
              let currentChangelog = {}
              try {
                const changelogRes = await githubFetch(`contents/public/changelog.json?ref=master`)
                const changelogContent = Buffer.from(changelogRes.content, 'base64').toString('utf-8')
                currentChangelog = JSON.parse(changelogContent)
              } catch (e) {
                console.warn('Não foi possível ler o changelog.json atual no repo, criando um novo.')
              }

              const today = new Date().toISOString().split('T')[0]
              const updatedChangelog = {
                [`v${version}`]: {
                  date: today,
                  pt: parsedChangelog.pt || [],
                  en: parsedChangelog.en || [],
                  es: parsedChangelog.es || []
                },
                ...currentChangelog
              }

              newChangelogStr = JSON.stringify(updatedChangelog, null, 2)
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao gerar changelog via Gemini na API:', err)
    }

    // Step 4: Create Blobs for the new files
    const packageBlob = await githubFetch(`git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: newPackageJsonStr, encoding: 'utf-8' })
    })

    const tauriBlob = await githubFetch(`git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: newTauriConfStr, encoding: 'utf-8' })
    })

    let changelogBlob: any = null
    if (newChangelogStr) {
      changelogBlob = await githubFetch(`git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: newChangelogStr, encoding: 'utf-8' })
      })
    }

    // Step 5: Create a new Tree
    const treePayload: any[] = [
      { path: 'package.json', mode: '100644', type: 'blob', sha: packageBlob.sha },
      { path: 'src-tauri/tauri.conf.json', mode: '100644', type: 'blob', sha: tauriBlob.sha }
    ]
    if (changelogBlob) {
      treePayload.push({ path: 'public/changelog.json', mode: '100644', type: 'blob', sha: changelogBlob.sha })
    }

    const newTree = await githubFetch(`git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treePayload
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

    // Step 8: Trigger the GitHub Action via workflow_dispatch with OS selections
    // Wait a few seconds to ensure GitHub's git ref cache is updated across its distributed systems
    // otherwise the workflow might run on the previous commit.
    await new Promise(resolve => setTimeout(resolve, 3000))
    await githubFetch(`actions/workflows/build-tauri.yml/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'master',
        inputs: {
          build_windows: buildWindows ? 'true' : 'false',
          build_macos: buildMacOs ? 'true' : 'false',
          build_linux: buildLinux ? 'true' : 'false',
          release_notes: generateReleaseNotes ? '' : (releaseNotes || 'Nova versão do MetaBuilder PRO disponível!'),
          generate_release_notes: generateReleaseNotes ? 'true' : 'false'
        }
      })
    })

    return NextResponse.json({ success: true, message: `Build disparado para v${version}. A release será publicada quando o workflow concluir.` })

  } catch (error: any) {
    console.error('Release API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
