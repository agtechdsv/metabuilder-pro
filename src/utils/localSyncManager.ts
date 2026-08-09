import { isTauri } from './tauriUtils';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { BaseDirectory, join } from '@tauri-apps/api/path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { GitConfigManager } from './gitConfigManager';

class NodeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const handleFsError = (err: any) => {
  const msg = err?.message || String(err);
  if (msg.includes('os error 3') || msg.includes('os error 2') || msg.includes('cannot find') || msg.includes('não pode encontrar') || msg.includes('No such file') || msg.includes('not found') || msg.includes('Failed to get metadata')) {
    throw new NodeError(msg, 'ENOENT');
  }
  throw err;
};

// Create a pseudo-fs adapter that maps isomorphic-git's required fs methods to Tauri's plugin-fs
const tauriFsAdapter = {
  promises: {
    readFile: async (path: string, opts?: any) => {
      try {
        const isUtf8 = opts === 'utf8' || opts?.encoding === 'utf8';
        if (isUtf8) {
          return await tauriFs.readTextFile(path, { baseDir: BaseDirectory.Home });
        }
        return await tauriFs.readFile(path, { baseDir: BaseDirectory.Home });
      } catch (err) {
        handleFsError(err);
      }
    },
    writeFile: async (path: string, data: any, opts?: any) => {
      try {
        if (typeof data === 'string') {
          return await tauriFs.writeTextFile(path, data, { baseDir: BaseDirectory.Home });
        }
        return await tauriFs.writeFile(path, data, { baseDir: BaseDirectory.Home });
      } catch (err) {
        handleFsError(err);
      }
    },
    unlink: async (path: string) => {
      try {
        return await tauriFs.remove(path, { baseDir: BaseDirectory.Home });
      } catch (err) {
        handleFsError(err);
      }
    },
    readdir: async (path: string) => {
      try {
        const entries = await tauriFs.readDir(path, { baseDir: BaseDirectory.Home });
        return entries.map(e => e.name);
      } catch (err) {
        handleFsError(err);
        return [];
      }
    },
    mkdir: async (path: string) => {
      try {
        return await tauriFs.mkdir(path, { baseDir: BaseDirectory.Home, recursive: true });
      } catch (err) {
        handleFsError(err);
      }
    },
    rmdir: async (path: string) => {
      try {
        return await tauriFs.remove(path, { baseDir: BaseDirectory.Home, recursive: true });
      } catch (err) {
        handleFsError(err);
      }
    },
    stat: async (path: string) => {
      try {
        const stat = await tauriFs.stat(path, { baseDir: BaseDirectory.Home });
        return {
          ...stat,
          mtime: stat.mtime ? new Date(stat.mtime) : new Date(),
          ctime: stat.mtime ? new Date(stat.mtime) : new Date(),
          mode: (stat as any).mode || (stat.isDirectory ? 0o40000 : 0o100644),
          dev: (stat as any).dev || 1,
          ino: (stat as any).ino || 1,
          uid: (stat as any).uid || 0,
          gid: (stat as any).gid || 0,
          size: stat.size || 0,
          isDirectory: () => stat.isDirectory,
          isFile: () => stat.isFile,
          isSymbolicLink: () => stat.isSymlink,
        };
      } catch (err) {
        handleFsError(err);
      }
    },
    lstat: async (path: string) => {
      try {
        const stat = await tauriFs.lstat(path, { baseDir: BaseDirectory.Home });
        return {
          ...stat,
          mtime: stat.mtime ? new Date(stat.mtime) : new Date(),
          ctime: stat.mtime ? new Date(stat.mtime) : new Date(),
          mode: (stat as any).mode || (stat.isDirectory ? 0o40000 : 0o100644),
          dev: (stat as any).dev || 1,
          ino: (stat as any).ino || 1,
          uid: (stat as any).uid || 0,
          gid: (stat as any).gid || 0,
          size: stat.size || 0,
          isDirectory: () => stat.isDirectory,
          isFile: () => stat.isFile,
          isSymbolicLink: () => stat.isSymlink,
        };
      } catch (err) {
        handleFsError(err);
      }
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
    this.projectDir = `AGTech/MetaBuilderPRO/${this.projectSlug}`;
  }

  public async getConfiguredBranches() {
    const configManager = new GitConfigManager(this.projectSlug);
    const config = await configManager.getConfig();
    return {
      local: config.branchLocal || 'local',
      upstream: config.branchUpstream || 'upstream',
      sandbox: config.branchSandbox || 'sync-sandbox'
    };
  }

  /**
   * Initializes the local project directory and git repository if they don't exist.
   */
  public async initLocalProject() {
    if (!isTauri()) throw new Error("Local sync is only available on the Desktop App.");
    
    // Ensure base directory exists
    await tauriFs.mkdir(this.projectDir, { baseDir: BaseDirectory.Home, recursive: true });

    // Check if .git exists
    let gitExists = false;
    try {
      await tauriFs.stat(`${this.projectDir}/.git`, { baseDir: BaseDirectory.Home });
      gitExists = true;
    } catch {
      gitExists = false;
    }

    if (!gitExists) {
      const { local } = await this.getConfiguredBranches();
      // Doesn't exist, init git
      await git.init({ fs: tauriFsAdapter, dir: this.projectDir, defaultBranch: local });
      
      // Create an initial commit so we have a HEAD, preventing branching errors
      await tauriFsAdapter.promises.writeFile(`${this.projectDir}/.metabuilder`, 'Initialized by MetaBuilder PRO');
      await git.add({ fs: tauriFsAdapter, dir: this.projectDir, filepath: '.metabuilder' });
      await git.commit({
        fs: tauriFsAdapter,
        dir: this.projectDir,
        author: { name: 'System', email: 'system@metabuilder.app' },
        message: 'Initial project setup'
      });
    } else {
      // .git exists, but let's make sure it has at least one commit
      try {
        await git.log({ fs: tauriFsAdapter, dir: this.projectDir, depth: 1 });
      } catch {
        // Repo exists but no commits yet (maybe it crashed halfway previously)
        await tauriFsAdapter.promises.writeFile(`${this.projectDir}/.metabuilder`, 'Initialized by MetaBuilder PRO');
        await git.add({ fs: tauriFsAdapter, dir: this.projectDir, filepath: '.metabuilder' });
        await git.commit({
          fs: tauriFsAdapter,
          dir: this.projectDir,
          author: { name: 'System', email: 'system@metabuilder.app' },
          message: 'Initial project setup'
        });
      }
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
    
    const { local, upstream } = await this.getConfiguredBranches();

    // Check if upstream branch exists
    const branches = await git.listBranches({ fs: tauriFsAdapter, dir: this.projectDir });
    let previousBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir });
    if (!previousBranch) previousBranch = local;

    if (!branches.includes(upstream)) {
      await git.branch({ fs: tauriFsAdapter, dir: this.projectDir, ref: upstream });
    }

    // Checkout upstream branch to write the new files
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: upstream, force: true });

    // Write files to disk
    for (const [relativePath, content] of Object.entries(fileMap)) {
      const fullPath = `${this.projectDir}/${relativePath}`;
      
      // Ensure subdirectories exist
      const parts = relativePath.split('/');
      if (parts.length > 1) {
        const dirParts = parts.slice(0, -1).join('/');
        await tauriFs.mkdir(`${this.projectDir}/${dirParts}`, { baseDir: BaseDirectory.Home, recursive: true });
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

    const { local, upstream, sandbox } = await this.getConfiguredBranches();

    const currentBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir });
    if (currentBranch !== local) {
      await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: local });
    }

    // Create and checkout sandbox branch from local
    await git.branch({ fs: tauriFsAdapter, dir: this.projectDir, ref: sandbox, force: true });
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: sandbox });

    // Merge upstream into sandbox
    const mergeResult = await git.merge({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ours: sandbox,
      theirs: upstream,
      author: { name: 'MetaBuilder Dev', email: 'dev@metabuilder.app' },
      abortOnConflict: false
    });

    // isomorphic-git merge does not update the working tree, we must checkout manually
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: sandbox, force: true });

    return mergeResult; // Can contain conflicts
  }

  /**
   * Confirms the sync, merging sandbox into local.
   */
  public async confirmSync() {
    const { local, sandbox } = await this.getConfiguredBranches();

    // Checkout local
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: local });
    
    // Merge sandbox into local (should be fast-forward)
    await git.merge({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ours: local,
      theirs: sandbox,
      author: { name: 'MetaBuilder Dev', email: 'dev@metabuilder.app' },
      fastForward: true
    });

    // isomorphic-git merge does not update the working tree, we must checkout manually
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: local, force: true });

    // Delete sandbox branch
    await git.deleteBranch({ fs: tauriFsAdapter, dir: this.projectDir, ref: sandbox });
  }

  /**
   * Aborts the sync, destroying the sandbox and returning to local.
   */
  public async abortSync() {
    const { local, sandbox } = await this.getConfiguredBranches();

    // Revert to local
    await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: local, force: true });
    
    // Delete sandbox branch
    await git.deleteBranch({ fs: tauriFsAdapter, dir: this.projectDir, ref: sandbox });

    // Clean up empty directories left by isomorphic-git
    await this.cleanupEmptyDirectories(this.projectDir);

    // Clean up .env files if they were left untracked
    try {
      await tauriFs.remove(`${this.projectDir}/.env.local`, { baseDir: BaseDirectory.Home });
    } catch (e) {}
    try {
      await tauriFs.remove(`${this.projectDir}/.env.example`, { baseDir: BaseDirectory.Home });
    } catch (e) {}
  }

  /**
   * Recursively deletes empty directories inside a given path
   */
  private async cleanupEmptyDirectories(path: string) {
    if (!isTauri()) return;
    try {
      const entries = await tauriFs.readDir(path, { baseDir: BaseDirectory.Home });
      let isEmpty = true;

      for (const entry of entries) {
        if (entry.name === '.git') {
          isEmpty = false;
          continue;
        }
        
        const fullPath = `${path}/${entry.name}`;
        if (entry.isDirectory) {
          const isDirEmpty = await this.cleanupEmptyDirectories(fullPath);
          if (isDirEmpty) {
            await tauriFs.remove(fullPath, { baseDir: BaseDirectory.Home });
          } else {
            isEmpty = false;
          }
        } else {
          isEmpty = false;
        }
      }
      return isEmpty;
    } catch (e) {
      return false;
    }
  }

    /**
     * Retrieves the list of local branches
     */
    public async getBranches() {
      if (!isTauri()) return { branches: [], currentBranch: 'local' };
      try {
        const { local } = await this.getConfiguredBranches();
        const branches = await git.listBranches({ fs: tauriFsAdapter, dir: this.projectDir });
        const currentBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir }) || local;
        return { branches, currentBranch };
      } catch {
        return { branches: [], currentBranch: 'local' };
      }
    }

    /**
     * Creates a new branch from the current branch
     */
    public async createBranch(branchName: string) {
      if (!isTauri()) return;
      await git.branch({ fs: tauriFsAdapter, dir: this.projectDir, ref: branchName });
      await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: branchName });
    }

    /**
     * Checks out an existing branch
     */
    public async checkoutBranch(branchName: string) {
      if (!isTauri()) return;
      await git.checkout({ fs: tauriFsAdapter, dir: this.projectDir, ref: branchName });
    }

    /**
     * Pushes the current branch to a remote repository
     */
    public async pushToRemote(remoteUrl: string, token: string, branchName: string) {
      if (!isTauri()) return;
      await git.push({
        fs: tauriFsAdapter,
        http,
        dir: this.projectDir,
        url: remoteUrl,
        ref: branchName,
        remoteRef: branchName,
        onAuth: () => ({ username: token })
      });
    }

    /**
     * Pulls the branch from a remote repository
     */
    public async pullFromRemote(remoteUrl: string, token: string, branchName: string) {
      if (!isTauri()) return;
      await git.pull({
        fs: tauriFsAdapter,
        http,
        dir: this.projectDir,
        url: remoteUrl,
        ref: branchName,
        singleBranch: true,
        author: { name: 'MetaBuilder Dev', email: 'dev@metabuilder.app' },
        onAuth: () => ({ username: token })
      });
    }

    /**
     * Retrieves the commit log for a given branch or current branch.
     */
    public async getLog(depth: number = 50, ref?: string) {
      if (!isTauri()) return [];
      try {
        const commits = await git.log({ fs: tauriFsAdapter, dir: this.projectDir, depth, ref });
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

  /**
   * Reverts the current branch to a specific commit.
   */
  public async revertToCommit(oid: string) {
    if (!isTauri()) return;
    const { local } = await this.getConfiguredBranches();
    const currentBranch = await git.currentBranch({ fs: tauriFsAdapter, dir: this.projectDir }) || local;
    
    // Update branch pointer to the target commit
    await git.writeRef({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ref: `refs/heads/${currentBranch}`,
      value: oid,
      force: true
    });

    // Checkout files matching the new branch head
    await git.checkout({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      ref: currentBranch,
      force: true
    });
    
    // Cleanup any empty directories left by the checkout
    await this.cleanupEmptyDirectories(this.projectDir);
  }
}
