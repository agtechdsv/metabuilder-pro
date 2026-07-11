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
  private dbType: string
  private dbConfig: any

  constructor(project: any, models: any[], uiViews: any[], customComponents: any[] = [], dbType: string = 'supabase', dbConfig: any = null) {
    this.zip = new JSZip()
    this.project = project
    this.models = models
    this.uiViews = uiViews
    this.customComponents = customComponents
    this.dbType = dbType
    this.dbConfig = dbConfig
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
    generateRootFiles(this.zip, this.project, this.dbType)
    generateEnv(this.zip, this.project, this.dbType, this.dbConfig)
    
    // Fase 2: Copiar a Engrenagem Visual Inteira
    const cwd = process.cwd()
    const componentsFolder = this.zip.folder('src/components')
    if (componentsFolder) {
      await this.copyFolderToZip(path.join(cwd, 'src/components/runtime'), componentsFolder.folder('runtime')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/ui'), componentsFolder.folder('ui')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/layout'), componentsFolder.folder('layout')!)
      
      // Cleanup HeaderActions to remove Tauri specific ReleaseNotes
      const headerActionsPath = path.join(cwd, 'src/components/layout/HeaderActions.tsx')
      if (fs.existsSync(headerActionsPath)) {
        let content = fs.readFileSync(headerActionsPath, 'utf8')
        content = content.replace(/import \{ ReleaseNotes \} from '@\/components\/tauri\/ReleaseNotes'/g, '')
        content = content.replace(/\{!hideReleaseNotes && <ReleaseNotes \/>\}/g, '')
        componentsFolder.folder('layout')?.file('HeaderActions.tsx', content)
      }

      await this.copyFolderToZip(path.join(cwd, 'src/components/auth'), componentsFolder.folder('auth')!)
      
      // Cleanup Tauri dependencies from LoginForm.tsx
      const loginFormPath = path.join(cwd, 'src/components/auth/LoginForm.tsx')
      if (fs.existsSync(loginFormPath)) {
        let content = fs.readFileSync(loginFormPath, 'utf8')
        content = content.replace(/import \{ isTauri, openExternalUrl \} from '@\/utils\/tauriUtils'/g, 'const isTauri = () => false; const openExternalUrl = (url: string) => window.open(url, "_blank");')
        content = content.replace(/import \{ onOpenUrl \} from '@tauri-apps\/plugin-deep-link'/g, 'const onOpenUrl = (cb: (urls: string[]) => void) => {}')
        componentsFolder.folder('auth')?.file('LoginForm.tsx', content)
      }
      await this.copyFolderToZip(path.join(cwd, 'src/components/shared'), componentsFolder.folder('shared')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/profile'), componentsFolder.folder('profile')!)
      
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
    
    const i18nFolder = this.zip.folder('src/i18n')
    if (i18nFolder) {
       await this.copyFolderToZip(path.join(cwd, 'src/i18n'), i18nFolder)
    }

    // Injetar os Adapters Escolhidos (sobrescrevendo os hooks copiados acima)
    const adapterPath = path.join(cwd, 'src/templates/export/adapters', this.dbType)
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

    generateAppRouter(this.zip, this.project, this.models, this.uiViews)
    generateFeatures(this.zip, this.models, this.uiViews, this.dbType)
    generateBYOC(this.zip, this.customComponents)

    return await this.zip.generateAsync({ type: 'nodebuffer' })
  }
}
