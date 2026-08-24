const fs = require('fs');
const file = 'c:/AgTech/Apps/metabuilder-pro/src/utils/localSyncManager.ts';
let content = fs.readFileSync(file, 'utf8');

const diffFunction = \
  public async getMergeDiffFiles(): Promise<{filepath: string, status: 'added'|'modified'|'deleted'}[]> {
    if (!isTauri()) return [];
    
    const { local } = await this.getConfiguredBranches();
    const trees = [git.TREE({ ref: local }), git.WORKDIR()];
    
    const changes: {filepath: string, status: 'added'|'modified'|'deleted'}[] = [];
    
    await git.walk({
      fs: tauriFsAdapter,
      dir: this.projectDir,
      trees,
      map: async function(filepath, [localNode, workdirNode]) {
        if (filepath === '.' || filepath === '.git') return;
        if (filepath === 'node_modules' || filepath.startsWith('node_modules/')) return;
        if (filepath === '.next' || filepath.startsWith('.next/')) return;
        
        let localOid = await localNode?.oid();
        let workdirOid = await workdirNode?.oid();
        
        if (localOid !== workdirOid) {
          if (!localNode) changes.push({ filepath, status: 'added' });
          else if (!workdirNode) changes.push({ filepath, status: 'deleted' });
          else changes.push({ filepath, status: 'modified' });
        }
      }
    });
    
    return changes;
  }\;

content = content.replace(
  /public async getChangedFiles\(\): Promise<\{filepath: string, status: 'added'\|'modified'\|'deleted'\}\[\]> \{/,
  diffFunction + '\n\n  public async getChangedFiles(): Promise<{filepath: string, status: \\'added\\'|\\'modified\\'|\\'deleted\\'}>[] {'
);

fs.writeFileSync(file, content);
