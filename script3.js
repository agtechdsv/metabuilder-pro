const fs = require('fs');
const file = 'c:/AgTech/Apps/metabuilder-pro/src/utils/localSyncManager.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = \
    public async revertFile(filepath: string, targetRef: string = 'HEAD'): Promise<void> {
      if (!isTauri()) return;
      try {
        let existsInRef = false;
        try {
          const oid = await git.resolveRef({ fs: tauriFsAdapter, dir: this.projectDir, ref: targetRef });
          const { blob } = await git.readBlob({ fs: tauriFsAdapter, dir: this.projectDir, oid, filepath });
          existsInRef = !!blob;
        } catch(e) {}
        
        if (!existsInRef) {
          // File doesn't exist in targetRef, revert means delete
          const fullPath = await join(this.projectDir, filepath);
          try { await tauriFsAdapter.promises.unlink(fullPath); } catch(e) {}
        } else {
          // Restore from targetRef
          await git.checkout({
            fs: tauriFsAdapter,
            dir: this.projectDir,
            ref: targetRef,
            filepaths: [filepath],
            force: true
          });
        }
      } catch (err) {
        console.error("Error in revertFile:", err);
      }
    }\;

content = content.replace(
  /public async revertFile\\(filepath: string\\): Promise<void> \\{[\\s\\S]*?force: true\\s*\\}\\);\\s*\\}\\s*\\} catch \\(err\\) \\{\\s*console\\.error\\("Error in revertFile:", err\\);\\s*\\}\\s*\\}/,
  replacement
);

fs.writeFileSync(file, content);
