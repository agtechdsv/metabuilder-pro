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
      await this.copyFolderToZip(path.join(cwd, 'src/components/auth'), componentsFolder.folder('auth')!)
      await this.copyFolderToZip(path.join(cwd, 'src/components/shared'), componentsFolder.folder('shared')!)
      
      // Root components
      const rootFiles = ['CustomThemeProvider.tsx', 'ProgressBarProvider.tsx']
      for (const file of rootFiles) {
        const filePath = path.join(cwd, 'src/components', file)
        if (fs.existsSync(filePath)) {
          componentsFolder.file(file, fs.readFileSync(filePath))
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
