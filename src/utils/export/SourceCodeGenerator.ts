import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import { generateRootFiles, generateEnv } from './generators/RootGenerator'
import { generateAppRouter } from './generators/AppRouterGenerator'
import { generateFeatures } from './generators/FeatureGenerator'
import { generateBYOC } from './generators/ByocGenerator'

export class SourceCodeGenerator {
  private zip: JSZip
  private project: any
  private models: any[]
  private uiViews: any[]
  private customComponents: any[]
  private dataMode: string
  private authStrategy: string
  private legacyDriver: string
  private dbConfig: any
  private projectRoles: any[]
  private rolePermissions: any[]
  private enumerations: any[]
  private projectRelations: any[]

  constructor(
    project: any, 
    models: any[], 
    uiViews: any[], 
    customComponents: any[] = [], 
    dataMode: string = 'supabase', 
    authStrategy: string = 'managed', 
    legacyDriver: string = 'supabase', 
    dbConfig: any = null,
    projectRoles: any[] = [],
    rolePermissions: any[] = [],
    enumerations: any[] = [],
    projectRelations: any[] = []
  ) {
    this.zip = new JSZip()
    this.project = project
    this.models = models
    this.uiViews = uiViews
    this.customComponents = customComponents
    this.dataMode = dataMode
    this.authStrategy = authStrategy
    this.legacyDriver = legacyDriver
    this.dbConfig = dbConfig
    this.projectRoles = projectRoles
    this.rolePermissions = rolePermissions
    this.enumerations = enumerations
    this.projectRelations = projectRelations
  }

  private async copyFolderToZip(sourcePath: string, zipFolder: JSZip) {
    if (!fs.existsSync(sourcePath)) return
    const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(sourcePath, entry.name)
      if (entry.isDirectory()) {
        const subFolder = zipFolder.folder(entry.name)
        if (subFolder) {
          await this.copyFolderToZip(fullPath, subFolder)
        }
      } else {
        const fileContent = await fs.promises.readFile(fullPath)
        zipFolder.file(entry.name, fileContent)
      }
    }
  }

  public async generate(): Promise<Buffer> {
    await this.buildZip()
    return await this.zip.generateAsync({ type: 'nodebuffer' })
  }

  public async generateFileMap(): Promise<Record<string, string>> {
    await this.buildZip()
    const fileMap: Record<string, string> = {}
    
    // JSZip uses relative paths as keys in zip.files
    for (const relativePath of Object.keys(this.zip.files)) {
      const zipObject = this.zip.files[relativePath]
      if (!zipObject.dir) {
        const content = await zipObject.async('string')
        fileMap[relativePath] = content
      }
    }
    
    return fileMap
  }

  private async buildZip(): Promise<void> {
    generateRootFiles(this.zip, this.project, this.dataMode, this.authStrategy)
    generateEnv(this.zip, this.project, this.dataMode, this.authStrategy, this.legacyDriver, this.dbConfig)
    
    // Fase 2: Copiar a Engrenagem Visual Inteira
    const cwd = process.cwd()
    const componentsFolder = this.zip.folder('src/components')
    if (componentsFolder) {
      await this.copyFolderToZip(path.join(cwd, 'src/components/runtime'), componentsFolder.folder('runtime')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/ui'), componentsFolder.folder('ui')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/layout'), componentsFolder.folder('layout')!)
      
      const userDefinedPath = path.join(cwd, 'src/components/user-defined');
      if (fs.existsSync(userDefinedPath)) {
        await this.copyFolderToZip(userDefinedPath, componentsFolder.folder('user-defined')!);
      }
      
      // Override hooks if adapter exists (e.g. postgres or native supabase)
      if (this.dataMode && this.dataMode !== 'tunnel') {
        const adapterHooksPath = path.join(cwd, 'src/templates/export/adapters', this.dataMode, 'hooks')
        if (fs.existsSync(adapterHooksPath)) {
          const hooksFolder = componentsFolder.folder('runtime')?.folder('hooks')
          if (hooksFolder) {
            await this.copyFolderToZip(adapterHooksPath, hooksFolder)
            // Mock tunnel connection to prevent the exported app from connecting to MetaBuilder's central tunnel
            hooksFolder.file('useTunnelConnection.ts', 'export function useTunnelConnection(props: any) { return { tunnelChannel: {}, isTunnelReady: true, supabase: null } }')
          }
        }
      }

      
      // Cleanup HeaderActions to remove Tauri specific ReleaseNotes
      const headerActionsPath = path.join(cwd, 'src/components/layout/HeaderActions.tsx')
      if (fs.existsSync(headerActionsPath)) {
        let content = fs.readFileSync(headerActionsPath, 'utf8')
        content = content.replace(/import \{ ReleaseNotes \} from '@\/components\/tauri\/ReleaseNotes'/g, '')
        content = content.replace(/\{!hideReleaseNotes && <ReleaseNotes \/>\}/g, '')
        componentsFolder.folder('layout')?.file('HeaderActions.tsx', content)
      }

      // Cleanup Tauri dependencies from Navbar.tsx
      const navbarPath = path.join(cwd, 'src/components/layout/Navbar.tsx')
      if (fs.existsSync(navbarPath)) {
        let content = fs.readFileSync(navbarPath, 'utf8')
        content = content.replace(/import \{ isTauri \} from '@\/utils\/tauriUtils'/g, 'const isTauri = () => false;')
        componentsFolder.folder('layout')?.file('Navbar.tsx', content)
      }

      // Export Gerenciador de Downloads
      const downloadsManagerPath = path.join(cwd, 'src/components/runtime/DownloadsManagerClient.tsx')
      if (fs.existsSync(downloadsManagerPath)) {
        componentsFolder.folder('runtime')?.file('DownloadsManagerClient.tsx', fs.readFileSync(downloadsManagerPath))
      }

      const sidebarPath = path.join(cwd, 'src/components/layout/StudioSidebar.tsx')
      if (fs.existsSync(sidebarPath)) {
        let content = fs.readFileSync(sidebarPath, 'utf8')
        content = content.replace(/import \{ isTauri \} from '@\/utils\/tauriUtils'/g, 'const isTauri = () => false;')
        componentsFolder.folder('layout')?.file('StudioSidebar.tsx', content)
      }

      const updaterPath = path.join(cwd, 'src/components/runtime/IdeUpdaterButton.tsx')
      if (fs.existsSync(updaterPath)) {
        componentsFolder.folder('runtime')?.file('IdeUpdaterButton.tsx', 'export function IdeUpdaterButton() { return null }')
      }

      await this.copyFolderToZip(path.join(cwd, 'src/components/auth'), componentsFolder.folder('auth')!)
      
      // Cleanup Tauri dependencies from LoginForm.tsx
      const loginFormPath = path.join(cwd, 'src/components/auth/LoginForm.tsx')
      if (fs.existsSync(loginFormPath)) {
        let content = fs.readFileSync(loginFormPath, 'utf8')
        content = content.replace(/import \{ isTauri, openExternalUrl \} from '@\/utils\/tauriUtils'/g, 'const isTauri = () => false; const openExternalUrl = (url: string) => window.open(url, "_blank");')
        content = content.replace(/import \{ onOpenUrl \} from '@tauri-apps\/plugin-deep-link'/g, 'const onOpenUrl = async (cb: (urls: string[]) => void) => { return () => {}; }')
        componentsFolder.folder('auth')?.file('LoginForm.tsx', content)
      }

      // Cleanup tunnel logic from LoginPortalClient.tsx
      const loginPortalPath = path.join(cwd, 'src/components/auth/LoginPortalClient.tsx')
      if (fs.existsSync(loginPortalPath)) {
        let content = fs.readFileSync(loginPortalPath, 'utf8')
        
        if (this.authStrategy === 'managed') {
          // Convert handleSubmit to use Supabase Auth
          content = content.replace(
            /const queryId = crypto\.randomUUID\(\)[\s\S]*?\} catch \(err: any\) \{/m,
            `try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data?.user) finalizeLogin(data.user)
      } catch (err: any) {`
          )

          // Convert handlePasskeyLogin to use Supabase Auth
          content = content.replace(
            /const queryId = crypto\.randomUUID\(\)[\s\S]*?\} catch \(err: any\) \{/m,
            `const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error('Sessão inválida após biometria')
        finalizeLogin(user)
      } catch (err: any) {`
          )
        } else if (this.authStrategy === 'legacy' || this.authStrategy === 'ldap') {
          const endpoint = this.authStrategy === 'legacy' ? '/api/auth/login' : '/api/auth/ldap'
          // Convert handleSubmit to POST custom endpoint
          content = content.replace(
            /const queryId = crypto\.randomUUID\(\)[\s\S]*?\} catch \(err: any\) \{/m,
            `try {
        const res = await fetch('${endpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro no login')
        finalizeLogin(data.user || { id: data.userId || 'legacy-user' })
      } catch (err: any) {`
          )
        }

        // Remove any remaining cleanup() calls that were left in the catch block
        content = content.replace(/cleanup\(\)/g, '')

        componentsFolder.folder('auth')?.file('LoginPortalClient.tsx', content)
      }
      await this.copyFolderToZip(path.join(cwd, 'src/components/shared'), componentsFolder.folder('shared')!)
      
      const biWidgetEditorPath = path.join(cwd, 'src/components/shared/BIWidgetEditor.tsx')
      if (fs.existsSync(biWidgetEditorPath)) {
        componentsFolder.folder('shared')?.file('BIWidgetEditor.tsx', 'export function BIWidgetEditor(props: any) { return null }')
      }

      await this.copyFolderToZip(path.join(cwd, 'src/components/profile'), componentsFolder.folder('profile')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/legal'), componentsFolder.folder('legal')!)
      
      // Root components
      const rootFiles = ['CustomThemeProvider.tsx', 'ProgressBarProvider.tsx', 'DynamicGrid.tsx']
      for (const file of rootFiles) {
        const filePath = path.join(cwd, 'src/components', file)
        if (fs.existsSync(filePath)) {
          componentsFolder.file(file, fs.readFileSync(filePath))
        }
      }

      // Workspace specific component needed by profile
      const workspaceFolder = componentsFolder.folder('workspace')
      if (workspaceFolder) {
        const securitySettingsPath = path.join(cwd, 'src/components/workspace/SecuritySettings.tsx')
        if (fs.existsSync(securitySettingsPath)) {
          workspaceFolder.file('SecuritySettings.tsx', fs.readFileSync(securitySettingsPath))
        }
      }

      // Studio components needed by shared
      const studioFolder = componentsFolder.folder('studio')
      if (studioFolder) {
        const formulaBuilderPath = path.join(cwd, 'src/components/studio/FormulaBuilder.tsx')
        if (fs.existsSync(formulaBuilderPath)) {
          studioFolder.file('FormulaBuilder.tsx', fs.readFileSync(formulaBuilderPath))
        }
      }
    }
    
    const libFolder = this.zip.folder('src/lib')
    if (libFolder) {
      await this.copyFolderToZip(path.join(cwd, 'src/lib'), libFolder)
    }

    const utilsFolder = this.zip.folder('src/utils/supabase')
    if (utilsFolder) {
      await this.copyFolderToZip(path.join(cwd, 'src/utils/supabase'), utilsFolder)
    }

    // Export async exports API (Central de Exportações) - Standalone Mock
    const exportApiFolder = this.zip.folder('src/app/api/export')
    if (exportApiFolder) {
      exportApiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Em ambiente standalone, o Gerenciador de Downloads lê a pasta configurada
function getDownloadPath() {
  if (process.env.LOCAL_DOWNLOAD_PATH) {
    return process.env.LOCAL_DOWNLOAD_PATH
  }
  return path.join(process.cwd(), 'downloads')
}

export async function GET(request: Request) {
  try {
    const downloadPath = getDownloadPath()
    if (!fs.existsSync(downloadPath)) {
      return NextResponse.json({ jobs: [] })
    }
    
    const files = fs.readdirSync(downloadPath)
    const jobs = files.map((file, idx) => ({
      id: \`job-\${idx}\`,
      file_name: file,
      file_type: path.extname(file).replace('.', ''),
      status: 'completed',
      progress: 100,
      created_at: fs.statSync(path.join(downloadPath, file)).mtime.toISOString(),
      file_url: \`/api/download?file=\${encodeURIComponent(file)}\`
    }))
    
    return NextResponse.json({ jobs })
  } catch (e: any) {
    return NextResponse.json({ jobs: [] })
  }
}

export async function POST(request: Request) {
  return NextResponse.json({ success: true, jobId: 'standalone-job', message: 'Exportação encaminhada para o agente local.' }, { status: 202 })
}

export async function DELETE(request: Request) {
  return NextResponse.json({ success: true })
}
`)
    }

    // Export standalone API para download local
    const downloadApiFolder = this.zip.folder('src/app/api/download')
    if (downloadApiFolder) {
      downloadApiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function getDownloadPath() {
  if (process.env.LOCAL_DOWNLOAD_PATH) {
    return process.env.LOCAL_DOWNLOAD_PATH
  }
  return path.join(process.cwd(), 'downloads')
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fileName = url.searchParams.get('file')
    if (!fileName) return new NextResponse('File not specified', { status: 400 })

    const downloadPath = getDownloadPath()
    const filePath = path.join(downloadPath, fileName)

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': \`attachment; filename="\${fileName}"\`,
        'Content-Type': 'application/octet-stream',
      }
    })
  } catch (e: any) {
    return new NextResponse('Internal error', { status: 500 })
  }
}
`)
    }

    // Export Enumerations API
    const enumerationsApiFolder = this.zip.folder('src/app/api/enumerations')
    if (enumerationsApiFolder) {
      enumerationsApiFolder.file('route.ts', `import { NextResponse } from 'next/server'
import enumerations from '@/config/enumerations.json'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  const enumData = (enumerations as any[]).find(e => e.id === id)

  if (!enumData) {
    return NextResponse.json({ error: 'Enumeration not found' }, { status: 404 })
  }

  return NextResponse.json({ data: enumData })
}
`)
    }

    // Export Enumerations Config
    this.zip.folder('src/config')?.file('enumerations.json', JSON.stringify(this.enumerations || [], null, 2))

    if (this.authStrategy !== 'none') {
      const appAuthFolder = this.zip.folder('src/app/auth')
      if (appAuthFolder) {
        await this.copyFolderToZip(path.join(cwd, 'src/app/auth'), appAuthFolder)
        
        // Cleanup actions.ts to remove MetaBuilder specific iclub
        const authActionsPath = path.join(cwd, 'src/app/auth/actions.ts')
        if (fs.existsSync(authActionsPath)) {
          let content = fs.readFileSync(authActionsPath, 'utf8')
          content = content.replace(/await import\('@\/app\/actions\/iclub'\)/g, '{ registerReferral: async (...args: any[]) => {} }')
          appAuthFolder.file('actions.ts', content)
        }

        // Cleanup callback/page.tsx to remove MetaBuilder specific iclub
        const authCallbackPath = path.join(cwd, 'src/app/auth/callback/page.tsx')
        if (fs.existsSync(authCallbackPath)) {
          let content = fs.readFileSync(authCallbackPath, 'utf8')
          content = content.replace(/await import\('@\/app\/actions\/iclub'\)/g, '{ registerReferral: async (...args: any[]) => {} }')
          appAuthFolder.folder('callback')?.file('page.tsx', content)
        }
      }

      const appApiAuthFolder = this.zip.folder('src/app/api/auth')
      if (appApiAuthFolder) {
        await this.copyFolderToZip(path.join(cwd, 'src/app/api/auth'), appApiAuthFolder)
      }
    } else {
      // Quando não há autenticação (None), criamos mocks dos server actions de auth para não quebrar os imports nos componentes
      const appAuthFolder = this.zip.folder('src/app/auth')
      appAuthFolder?.file('actions.ts', `'use server'
export async function login(...args: any[]): Promise<any> { return { success: true } }
export async function signup(...args: any[]): Promise<any> { return { success: true } }
export async function verifyMfaPolicy(...args: any[]): Promise<any> { return { success: true } }
export async function signOut(...args: any[]): Promise<any> { return { success: true } }
export async function updateAvatar(...args: any[]): Promise<any> { return { success: true } }
export async function resetAvatar(...args: any[]): Promise<any> { return { success: true } }
export async function updateProfile(...args: any[]): Promise<any> { return { success: true } }
export async function updateEnforceMfa(...args: any[]): Promise<any> { return { success: true } }
export async function unenrollPersonalMfa(...args: any[]): Promise<any> { return { success: true } }
export async function removePasskeys(...args: any[]): Promise<any> { return { success: true } }
export async function getPostLoginRedirectPath(...args: any[]): Promise<any> { return '/' }
`)
      appAuthFolder?.folder('set-password')?.file('actions.ts', `'use server'
export async function setPasswordAction(...args: any[]): Promise<any> { return { success: true } }
`)
    }
      
      // Inject custom auth API route if legacy or ldap
      if (this.authStrategy === 'legacy' || this.authStrategy === 'ldap') {
        const customApiFolder = this.zip.folder(this.authStrategy === 'legacy' ? 'src/app/api/auth/login' : 'src/app/api/auth/ldap')
        if (customApiFolder) {
          const authConf = this.project?.auth_config || {}
          if (this.authStrategy === 'legacy') {
            const tableName = authConf.db_table_name || 'usuarios'
            const emailCol = authConf.db_email_column || 'email'
            const passCol = authConf.db_password_column || 'senha'
            const idCol = authConf.db_user_role_column || 'id'
            
            const routeContent = `import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
${this.legacyDriver === 'postgres' ? "import { Pool } from 'pg';" : ""}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-replace-me');

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    let user = null;

    ${this.legacyDriver === 'postgres' ? `
    // Postgres Native Mode
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query('SELECT * FROM "${tableName}" WHERE "${emailCol}" = $1 LIMIT 1', [email]);
    if (result.rows.length > 0) user = result.rows[0];
    await pool.end();
    ` : `
    // Supabase SDK Mode
    const supabase = await createClient();
    const { data } = await supabase.from('${tableName}').select('*').eq('${emailCol}', email).limit(1).single();
    user = data;
    `}

    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });

    // ATENÇÃO: Adicione a validação de hash (bcrypt) aqui na implementação final
    if (user["${passCol}"] !== password) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    // Gerar JWT de Sessão
    const token = await new SignJWT({ userId: user["${idCol}"], email: user["${emailCol}"] })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    cookies().set('legacy_auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 });
    return NextResponse.json({ success: true, user: { id: user["${idCol}"], email: user["${emailCol}"] } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`
            customApiFolder.file('route.ts', routeContent)
          } else if (this.authStrategy === 'ldap') {
            const routeContent = `import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import ldap from 'ldapjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-replace-me');

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    // In a real implementation, you would authenticate against the LDAP server using ldapjs.
    // For now, this is a placeholder where you can inject the Active Directory logic:
    // const client = ldap.createClient({ url: process.env.LDAP_URL });
    // client.bind(...) 

    // Simulate LDAP success
    const token = await new SignJWT({ userId: email, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    cookies().set('legacy_auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 });
    return NextResponse.json({ success: true, user: { id: email, email } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}`
            customApiFolder.file('route.ts', routeContent)
          }
        }
      }
    const i18nFolder = this.zip.folder('src/i18n')
    if (i18nFolder) {
       await this.copyFolderToZip(path.join(cwd, 'src/i18n'), i18nFolder)
    }

    // Copiar scripts de deploy para a raiz do ZIP
    const scriptsFolderSrc = path.join(cwd, 'src/templates/export/scripts')
    if (fs.existsSync(scriptsFolderSrc)) {
      const scriptFiles = fs.readdirSync(scriptsFolderSrc)
      for (const scriptFile of scriptFiles) {
        const fullPath = path.join(scriptsFolderSrc, scriptFile)
        if (fs.statSync(fullPath).isFile()) {
          this.zip.file(scriptFile, fs.readFileSync(fullPath))
        }
      }
    }

    // Injetar os Adapters Escolhidos (sobrescrevendo os hooks copiados acima)
    if (this.dataMode !== 'tunnel') {
      const adapterPath = path.join(cwd, 'src/templates/export/adapters', this.dataMode)
      if (fs.existsSync(adapterPath)) {
        const hooksFolder = componentsFolder?.folder('runtime')?.folder('hooks')
        if (hooksFolder && fs.existsSync(path.join(adapterPath, 'hooks'))) {
          await this.copyFolderToZip(path.join(adapterPath, 'hooks'), hooksFolder)
        }
        
        const libFolderDst = this.zip.folder('src/lib')
        if (libFolderDst && fs.existsSync(path.join(adapterPath, 'lib'))) {
          await this.copyFolderToZip(path.join(adapterPath, 'lib'), libFolderDst)
        }
      }
    }

    // Gerar schema.sql
    if (this.dataMode !== 'tunnel') {
      let schemaSql = '-- MetaBuilder Exported Schema\n\n'
      for (const model of this.models) {
        schemaSql += `CREATE TABLE IF NOT EXISTS "${model.table_name}" (\n`
        const columnDefs: string[] = []
        schemaSql += `  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`
        for (const field of model.ui_fields) {
          if (field.column_name === 'id') continue
          let type = 'TEXT'
          if (field.field_type === 'number') type = 'NUMERIC'
          if (field.field_type === 'boolean') type = 'BOOLEAN'
          if (field.field_type === 'timestamp') type = 'TIMESTAMP WITH TIME ZONE'
          columnDefs.push(`  "${field.column_name}" ${type}${field.required ? ' NOT NULL' : ''}`)
        }
        columnDefs.push(`  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n`)
        schemaSql += columnDefs.join(',\n') + '\n);\n\n'
      }
      this.zip.file('schema.sql', schemaSql)
    }

    // Gerar config de Permissões
    if (this.authStrategy !== 'none') {
      const permissionsMap: Record<string, { blockedRoles: string[], allowedRoles: string[], isDefaultBlocked: boolean }> = {}
      const SYSTEM_SLUGS = new Set(['login', 'downloads', 'automations', 'logs'])
      
      for (const view of this.uiViews) {
        const isAutomations = view.slug === 'automations'
        const blockedRoles: string[] = []
        const allowedRoles: string[] = []
        
        for (const rp of this.rolePermissions) {
          if (rp.view_id === view.id) {
            if (rp.can_read === false) blockedRoles.push(rp.role_id)
            if (rp.can_read === true) allowedRoles.push(rp.role_id)
          }
        }
        
        permissionsMap[view.slug] = {
          blockedRoles,
          allowedRoles,
          isDefaultBlocked: isAutomations
        }
      }

      const permissionsCode = `// Generated Permissions Map based on MetaBuilder Roles
export const PERMISSIONS_MAP = ${JSON.stringify(permissionsMap, null, 2)};

export function hasViewAccess(viewSlug: string, roleId: string | null): boolean {
  if (!roleId) return false; // Sem role não acessa nada
  const conf = PERMISSIONS_MAP[viewSlug as keyof typeof PERMISSIONS_MAP];
  if (!conf) return true; // Se não tem config, o default é liberado
  
  if (conf.isDefaultBlocked) {
    return conf.allowedRoles.includes(roleId);
  } else {
    return !conf.blockedRoles.includes(roleId);
  }
}
`
      this.zip.folder('src/config')?.file('permissions.ts', permissionsCode)
      
      const guardCode = `'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasViewAccess } from '@/config/permissions'

function useUserRole() {
  const [role, setRole] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const stored = localStorage.getItem('meta_user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setRole(u.role_id || u.role || null)
      } catch(e) {
        setRole(null)
      }
    } else {
      setRole(null)
    }
  }, [])
  return role
}

export function PermissionGuard({ viewSlug, children }: { viewSlug: string, children: React.ReactNode }) {
  const roleId = useUserRole()
  const router = useRouter()

  if (roleId === undefined) return null

  if (!hasViewAccess(viewSlug, roleId)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-2xl">!</div>
        <h2 className="text-2xl font-bold text-rose-900">Acesso Restrito</h2>
        <p className="text-neutral-500 max-w-md">Seu perfil atual não possui permissões suficientes para visualizar esta tela.</p>
        <button onClick={() => router.push('/')} className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors">Voltar ao Início</button>
      </div>
    )
  }

  return <>{children}</>
}
`
      this.zip.folder('src/components/auth')?.file('PermissionGuard.tsx', guardCode)
    } else {
      // Quando não há autenticação (None), criamos um Guard de mentira apenas para não quebrar o import
      const dummyGuardCode = `'use client'
import React from 'react'

export function PermissionGuard({ children }: { viewSlug: string, children: React.ReactNode }) {
  return <>{children}</>
}
`
      this.zip.folder('src/components/auth')?.file('PermissionGuard.tsx', dummyGuardCode)
    }

    // 2. Setup src/app structure and default pages
    generateAppRouter(this.zip, { ...this.project, db_type: this.dataMode }, this.models, this.uiViews, this.authStrategy, this.projectRelations)
    generateFeatures(this.zip, this.models, this.uiViews, this.dataMode)
    generateBYOC(this.zip, this.customComponents)

    // Prevent Next.js favicon 404 in console
    this.zip.folder('public')?.file('favicon.ico', '')
  }
}
