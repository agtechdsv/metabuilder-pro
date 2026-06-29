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

  constructor(project: any, models: any[], customComponents: any[] = []) {
    this.zip = new JSZip()
    this.project = project
    this.models = models
    this.customComponents = customComponents
  }

  public async generate(): Promise<Buffer> {
    generateRootFiles(this.zip, this.project)
    generateEnv(this.zip, this.project)
    generateLib(this.zip)
    generateUIComponents(this.zip)
    generateAppRouter(this.zip, this.project, this.models)
    generateFeatures(this.zip, this.models)
    generateBYOC(this.zip, this.customComponents)

    return await this.zip.generateAsync({ type: 'nodebuffer' })
  }
}
