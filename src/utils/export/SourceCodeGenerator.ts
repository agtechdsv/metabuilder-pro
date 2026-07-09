import JSZip from 'jszip'
import { generateRootFiles, generateEnv } from './generators/RootGenerator'
import { generateAppRouter } from './generators/AppRouterGenerator'
import { generateFeatures } from './generators/FeatureGenerator'
import { generateLib } from './generators/LibGenerator'
import { generateUIComponents } from './generators/UIGenerator'
import { generateBYOC } from './generators/ByocGenerator'

export class SourceCodeGenerator {
  private zip: JSZip
  private project: any
  private models: any[]
  private customComponents: any[]
  private dbType: string

  constructor(project: any, models: any[], customComponents: any[] = [], dbType: string = 'supabase') {
    this.zip = new JSZip()
    this.project = project
    this.models = models
    this.customComponents = customComponents
    this.dbType = dbType
  }

  public async generate(): Promise<Buffer> {
    generateRootFiles(this.zip, this.project, this.dbType)
    generateEnv(this.zip, this.project, this.dbType)
    generateLib(this.zip, this.dbType)
    generateUIComponents(this.zip)
    generateAppRouter(this.zip, this.project, this.models)
    generateFeatures(this.zip, this.models, this.dbType)
    generateBYOC(this.zip, this.customComponents)

    return await this.zip.generateAsync({ type: 'nodebuffer' })
  }
}
