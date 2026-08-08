import { isTauri } from './tauriUtils';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { BaseDirectory, join } from '@tauri-apps/api/path';
import git from 'isomorphic-git';

// Create a pseudo-fs adapter that maps isomorphic-git's required fs methods to Tauri's plugin-fs
const tauriFsAdapter = {
  promises: {
    readFile: async (path: string, opts?: any) => {
      const isUtf8 = opts === 'utf8' || opts?.encoding === 'utf8';
      if (isUtf8) {
        return await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Document });
      }
      return await tauriFs.readFile(path, { baseDir: BaseDirectory.Document });
    },
    writeFile: async (path: string, data: any, opts?: any) => {
      if (typeof data === 'string') {
        return await tauriFs.writeTextFile(path, data, { baseDir: BaseDirectory.Document });
      }
      return await tauriFs.writeFile(path, data, { baseDir: BaseDirectory.Document });
    },
    unlink: async (path: string) => {
      return await tauriFs.remove(path, { baseDir: BaseDirectory.Document });
    },
    readdir: async (path: string) => {
      const entries = await tauriFs.readDir(path, { baseDir: BaseDirectory.Document });
      return entries.map(e => e.name);
    },
    mkdir: async (path: string) => {
      return await tauriFs.mkdir(path, { baseDir: BaseDirectory.Document, recursive: true });
    },
    rmdir: async (path: string) => {
      return await tauriFs.remove(path, { baseDir: BaseDirectory.Document, recursive: true });
    },
    stat: async (path: string) => {
      const stat = await tauriFs.stat(path, { baseDir: BaseDirectory.Document });
      return {
        ...stat,
        isDirectory: () => stat.isDirectory,
        isFile: () => stat.isFile,
        isSymbolicLink: () => stat.isSymlink,
      };
    },
    lstat: async (path: string) => {
      const stat = await tauriFs.lstat(path, { baseDir: BaseDirectory.Document });
      return {
        ...stat,
        isDirectory: () => stat.isDirectory,
        isFile: () => stat.isFile,
        isSymbolicLink: () => stat.isSymlink,
      };
    },
    readlink: async (path: string) => {
      throw new Error("Symlinks not fully supported by this adapter");
    },
    symlink: async (target: string, path: string) => {
      throw new Error("Symlinks not fully supported by this adapter");
    }
  }
};

export class LocalSyncManager {
  private projectId: string;
  private projectSlug: string;
  private projectDir: string;

  constructor(projectId: string, projectSlug: string) {
    this.projectId = projectId;
    this.projectSlug = projectSlug || 'default-project';
    this.projectDir = `MetaBuilderPro/${this.projectSlug}`;
  }

  /**
   * Initializes the local project directory and git repository if they don't exist.
   */
  public async initLocalProject() {
    if (!isTauri()) throw new Error("Local sync is only available on the Desktop App.");
    
    // Ensure base directory exists
    await tauriFs.mkdir(this.projectDir, { baseDir: BaseDirectory.Document, recursive: true });

    // Check if .git exists
    try {
      await tauriFs.stat(`${this.projectDir}/.git`, { baseDir: BaseDirectory.Document });
    } catch {
      // Doesn't exist, init git
      await git.init({ fs: tauriFsAdapter, dir: this.projectDir, defaultBranch: 'local' });
    }
  }

  /**
   * Fetches the latest source code from the web, puts it into the upstream branch, and commits it.
   */
  public async syncFromWeb(apiEndpoint: string, authHeader: string, bodyPayload?: Record<string, any>) {
    if (!isTauri()) throw new Error("Local sync is only available on the Desktop App.");

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(bodyPayload || { projectId: this.projectId })
    });

    if (!res.ok) {
      throw new Error("Failed to fetch project source from web.");
    }

    const fileMap: Record<string, string> = await res.json();

    // Ensure git is initialized
    await this.initLocalProject();

    // Check if upstream branch exists
    const branches = await git.listBranches({ fs: tauriFsAdapter, dir: this.projectDir });
    let previousBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir });
    if (!previousBranch) previousBranch = 'local';

    if (!branches.includes('upstream')) {
      await git.branch({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'upstream' });
    }

    // Checkout upstream branch to write the new files
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'upstream', force: true });

    // Write files to disk
    for (const [relativePath, content] of Object.entries(fileMap)) {
      const fullPath = `${this.projectDir}/${relativePath}`;
      
      // Ensure subdirectories exist
      const parts = relativePath.split('/');
      if (parts.length > 1) {
        const dirParts = parts.slice(0, -1).join('/');
        await tauriFs.mkdir(`${this.projectDir}/${dirParts}`, { baseDir: BaseDirectory.Document, recursive: true });
      }

      await tauriFsAdapter.promises.writeFile(fullPath, content);
    }

    // Add all files
    for (const relativePath of Object.keys(fileMap)) {
      await git.add({ fs: tauriFsAdapter, dir: this.projectDir, filepath: relativePath });
    }

    // Commit to upstream
    await git.commit({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      author: { name: 'MetaBuilder Web', email: 'system@metabuilder.app' },
      message: `Sync from Web at ${new Date().toISOString()}`
    });

    // Return back to previous branch
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: previousBranch, force: true });
  }

  /**
   * Starts the sandbox merge process (creates sync-sandbox branch from local and merges upstream).
   */
  public async startSyncSandbox() {
    if (!isTauri()) throw new Error("Local sync is only available on the Desktop App.");

    const currentBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir });
    if (currentBranch !== 'local') {
      await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'local' });
    }

    // Create and checkout sandbox branch from local
    await git.branch({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'sync-sandbox', force: true });
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'sync-sandbox' });

    // Merge upstream into sandbox
    const mergeResult = await git.merge({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ours: 'sync-sandbox',
      theirs: 'upstream',
      author: { name: 'MetaBuilder Dev', email: 'dev@metabuilder.app' },
      abortOnConflict: false
    });

    return mergeResult; // Can contain conflicts
  }

  /**
   * Confirms the sync, merging sandbox into local.
   */
  public async confirmSync() {
    // Checkout local
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'local' });
    
    // Merge sandbox into local (should be fast-forward)
    await git.merge({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ours: 'local',
      theirs: 'sync-sandbox',
      author: { name: 'MetaBuilder Dev', email: 'dev@metabuilder.app' },
      fastForward: true
    });

    // Delete sandbox branch
    await git.deleteBranch({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'sync-sandbox' });
  }

  /**
   * Aborts the sync, destroying the sandbox and returning to local.
   */
  public async abortSync() {
    // Revert to local
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'local', force: true });
    
    // Delete sandbox branch
    await git.deleteBranch({ fs: tauriFsAdapter, dir: this.projectDir, ref: 'sync-sandbox' });
  }

  /**
   * Retrieves the commit log for the current branch.
   */
  public async getLog(depth: number = 50) {
    if (!isTauri()) return [];
    try {
      const commits = await git.log({ fs: tauriFsAdapter, dir: this.projectDir, depth });
      return commits.map(c => ({
        oid: c.oid,
        message: c.commit.message,
        author: c.commit.author.name,
        timestamp: new Date(c.commit.author.timestamp * 1000).toLocaleString()
      }));
    } catch (e) {
      return [];
    }
  }
}
