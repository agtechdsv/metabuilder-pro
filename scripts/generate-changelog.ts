import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

async function generateChangelog() {
  console.log('Extraindo últimos commits...')
  
  // Pegar a última tag
  let latestTag = ''
  try {
    latestTag = execSync('git describe --tags --abbrev=0').toString().trim()
  } catch (e) {
    console.log('Nenhuma tag encontrada. Pegando os últimos 10 commits...')
  }

  // Pegar os commits
  let commits = ''
  try {
    if (latestTag) {
      commits = execSync(`git log ${latestTag}..HEAD --pretty=format:"%s%n%b"`).toString().trim()
    } else {
      commits = execSync('git log -n 10 --pretty=format:"%s%n%b"').toString().trim()
    }
  } catch (e) {
    console.error('Erro ao pegar commits', e)
    process.exit(1)
  }

  if (!commits) {
    console.log('Nenhum commit novo encontrado desde a última tag.')
    process.exit(0)
  }

  // Se não tiver chave da OpenAI, apenas criar um changelog de placeholder
  if (!GEMINI_API_KEY) {
    console.warn('\n⚠️ GEMINI_API_KEY não encontrada nas variáveis de ambiente (.env.local ou global).')
    console.warn('⚠️ Por favor, adicione a chave para tradução automática. Para fins de demonstração, o arquivo será atualizado com os commits brutos.')
    
    saveChangelog({
      pt: commits.split('\n').filter(c => c.trim() !== ''),
      en: commits.split('\n').filter(c => c.trim() !== ''),
      es: commits.split('\n').filter(c => c.trim() !== '')
    })
    return
  }

  console.log('Gerando traduções via Gemini (Google AI Studio)...')
  
  const prompt = `
Você é um assistente responsável por criar um Histórico de Atualizações (Release Notes) para usuários finais.
Abaixo estão as mensagens de commit.
Sua tarefa é ler essas mensagens, remover jargões extremamente técnicos, agrupar o que faz sentido e gerar uma lista de tópicos curtos, diretos e amigáveis (bullet points).

O resultado deve ser EXATAMENTE um objeto JSON válido no seguinte formato:
{
  "pt": ["Ponto 1", "Ponto 2"],
  "en": ["Point 1", "Point 2"],
  "es": ["Punto 1", "Punto 2"]
}

Commits:
${commits}
`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

    const data = await response.json()
    if (data.error) {
      throw new Error(data.error.message)
    }

    const aiContent = data.candidates[0].content.parts[0].text
    // Extrair o JSON da resposta (caso venha com blocos de código markdown)
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('A IA não retornou um JSON válido.')
    
    const parsedChangelog = JSON.parse(jsonMatch[0])
    saveChangelog(parsedChangelog)

  } catch (error) {
    console.error('Erro ao chamar Gemini API:', error)
  }
}

function saveChangelog(newEntries: { pt: string[], en: string[], es: string[] }) {
  const changelogPath = path.join(process.cwd(), 'public', 'changelog.json')
  let currentChangelog: any = {}
  
  if (fs.existsSync(changelogPath)) {
    try {
      currentChangelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'))
    } catch (e) {
      console.warn('Não foi possível ler o changelog.json atual, criando um novo.')
    }
  }

  // Pegar a versão do package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const version = `v${packageJson.version}`
  
  const today = new Date().toISOString().split('T')[0]

  // Adicionar ou atualizar a versão atual
  currentChangelog[version] = {
    date: today,
    pt: newEntries.pt,
    en: newEntries.en,
    es: newEntries.es
  }

  // Ordenar as chaves de versão para a mais recente ficar no topo (opcional, JSON não garante ordem, mas é bom)
  fs.writeFileSync(changelogPath, JSON.stringify(currentChangelog, null, 2), 'utf8')
  console.log(`✅ changelog.json atualizado com sucesso para a versão ${version}!`)
}

generateChangelog()
