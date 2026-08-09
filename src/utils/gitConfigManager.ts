import { isTauri } from '@/utils/tauriUtils'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { BaseDirectory } from '@tauri-apps/api/path'

export interface GitConfig {
  remoteUrl?: string
  accessToken?: string
  branchLocal?: string
  branchUpstream?: string
  branchSandbox?: string
}

export class GitConfigManager {
  private projectDir: string
  private configPath: string

  constructor(projectSlug: string) {
    this.projectDir = `.metabuilder/${projectSlug}`
    this.configPath = `${this.projectDir}/git-config.json`
  }

  public async getConfig(): Promise<GitConfig> {
    if (!isTauri()) return {}
    try {
      const exists = await tauriFs.exists(this.configPath, { baseDir: BaseDirectory.Home })
      if (!exists) return {}
      const content = await tauriFs.readTextFile(this.configPath, { baseDir: BaseDirectory.Home })
      return JSON.parse(content)
    } catch (e) {
      console.warn("Failed to read git-config.json", e)
      return {}
    }
  }

  public async saveConfig(config: GitConfig): Promise<void> {
    if (!isTauri()) return
    try {
      const exists = await tauriFs.exists(this.projectDir, { baseDir: BaseDirectory.Home })
      if (!exists) {
        await tauriFs.mkdir(this.projectDir, { baseDir: BaseDirectory.Home, recursive: true })
      }
      const existingConfig = await this.getConfig()
      const newConfig = { ...existingConfig, ...config }
      await tauriFs.writeTextFile(this.configPath, JSON.stringify(newConfig, null, 2), { baseDir: BaseDirectory.Home })
    } catch (e) {
      console.error("Failed to save git-config.json", e)
      throw new Error("Não foi possível salvar as configurações do Git.")
    }
  }
}
