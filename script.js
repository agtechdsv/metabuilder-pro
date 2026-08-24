const fs = require('fs');
const file = 'c:/AgTech/Apps/metabuilder-pro/src/contexts/IDESyncContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix executeCloseFiles cleanup
content = content.replace(
  /const executeCloseFiles = \(pathsToClose: string\[\]\) => \{([\s\S]*?)setOpenFiles\(prev => \{/g,
  \const executeCloseFiles = (pathsToClose: string[]) => {
    if (monacoRef.current) {
      const monaco = monacoRef.current;
      pathsToClose.forEach(p => {
        const models = monaco.editor.getModels();
        for (const m of models) {
          if (m.uri.toString().toLowerCase().includes(p.toLowerCase())) {
            m.dispose();
          }
        }
      });
    }
    setFileContents(prev => {
      const next = { ...prev };
      pathsToClose.forEach(p => delete next[p]);
      return next;
    });
    setOriginalFileContents(prev => {
      const next = { ...prev };
      pathsToClose.forEach(p => delete next[p]);
      return next;
    });
    setOpenFiles(prev => {\
);

// 2. Add padding to MonacoDiffEditor
content = content.replace(
  /fontSize: 13,?\s*\}\}\s*onMount=/g,
  \ontSize: 13,
                              padding: { top: 16 }
                            }}
                            onMount=\
);

// 3. Fix fullPath in Commit Modal

// a) openCommitModal
content = content.replace(
  /let localContent = '';\s*if \(fileContents\[firstFile\] !== undefined\) \{\s*localContent = fileContents\[firstFile\];\s*\} else \{\s*localContent = await syncManager\.getFileLocalContent\(firstFile\);\s*\}/g,
  \let localContent = '';
        const fullPath = target ? \\\AGTech/MetaBuilderPRO/\/\\\\ : firstFile;
        if (fileContents[fullPath] !== undefined) {
          localContent = fileContents[fullPath];
        } else {
          localContent = await syncManager.getFileLocalContent(firstFile);
        }\
);

// b) handleSelectDiffFile
content = content.replace(
  /let localContent = '';\s*if \(fileContents\[filepath\] !== undefined\) \{\s*localContent = fileContents\[filepath\];\s*\} else \{\s*localContent = await syncManager\.getFileLocalContent\(filepath\);\s*\}/g,
  \let localContent = '';
      const fullPath = target ? \\\AGTech/MetaBuilderPRO/\/\\\\ : filepath;
      if (fileContents[fullPath] !== undefined) {
        localContent = fileContents[fullPath];
      } else {
        localContent = await syncManager.getFileLocalContent(filepath);
      }\
);

// c) confirmRevertFile
content = content.replace(
  /const originalContent = await syncManager\.getFileHeadContent\(filepath\);\s*if \(fileContents\[filepath\] !== undefined\) \{\s*setFileContents\(prev => \(\{ \.\.\.prev, \[filepath\]: originalContent \}\)\);\s*setOriginalFileContents\(prev => \(\{ \.\.\.prev, \[filepath\]: originalContent \}\)\);\s*if \(monacoRef\.current\) \{\s*const models = monacoRef\.current\.editor\.getModels\(\);\s*for \(const m of models\) \{\s*if \(m\.uri\.toString\(\)\.includes\(filepath\) \|\| m\.uri\.path === filepath\) \{\s*m\.setValue\(originalContent\);\s*\}\s*\}\s*\}\s*\}/g,
  \const originalContent = await syncManager.getFileHeadContent(filepath);
        const fullPath = target ? \\\AGTech/MetaBuilderPRO/\/\\\\ : filepath;
        if (fileContents[fullPath] !== undefined) {
          setFileContents(prev => ({ ...prev, [fullPath]: originalContent }));
          setOriginalFileContents(prev => ({ ...prev, [fullPath]: originalContent }));
          if (monacoRef.current) {
            const models = monacoRef.current.editor.getModels();
            for (const m of models) {
              if (m.uri.toString().toLowerCase().includes(fullPath.toLowerCase())) {
                m.setValue(originalContent);
              }
            }
          }
        }\
);

// d) handleCommitAdvanced reset state
content = content.replace(
  /setOriginalFileContents\(prev => \{\s*const next = \{ \.\.\.prev \};\s*Object\.keys\(next\)\.forEach\(path => \{\s*if \(fileContents\[path\] !== undefined && selectedCommitFiles\.has\(path\)\) \{\s*next\[path\] = fileContents\[path\];\s*\}\s*\}\);\s*return next;\s*\}\);/g,
  \setOriginalFileContents(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(path => {
          const relPath = target ? path.replace(\\\AGTech/MetaBuilderPRO/\/\\\, '') : path;
          if (fileContents[path] !== undefined && selectedCommitFiles.has(relPath)) {
            next[path] = fileContents[path];
          }
        });
        return next;
      });\
);

// e) MonacoDiffEditor onChange save
content = content.replace(
  /diffSaveTimeoutRef\.current = setTimeout\(async \(\) => \{\s*try \{\s*await syncManager\?\.saveFileLocalContent\(currentFile, val\);\s*setFileContents\(prev => \(\{ \.\.\.prev, \[currentFile\]: val \}\)\);\s*\} catch \(err\) \{\s*console\.error\(err\);\s*\}\s*\}, 500\);/g,
  \diffSaveTimeoutRef.current = setTimeout(async () => {
                                    try {
                                      await syncManager?.saveFileLocalContent(currentFile, val);
                                      const fullPath = target ? \\\AGTech/MetaBuilderPRO/\/\\\\ : currentFile;
                                      setFileContents(prev => {
                                        if (prev[fullPath] !== undefined) {
                                          return { ...prev, [fullPath]: val }
                                        }
                                        return prev;
                                      });
                                    } catch (err) {
                                      console.error("Error saving partial revert:", err);
                                    }
                                  }, 500);\
);

// 4. Tab auto-scroll
content = content.replace(
  /const collapseAll = \(\) => \{\s*setExpandedFolders\(new Set\(\)\)\s*\}/g,
  \const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  useEffect(() => {
    if (activeFile && tabsContainerRef.current) {
      const activeTab = tabsContainerRef.current.querySelector(\\\[data-path="\"]\\\);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
      }
    }
  }, [activeFile, openFiles]);\
);

content = content.replace(
  /return \(\s*<div\s*key=\{path\}\s*onClick=\{\(\) => setActiveFile\(path\)\}/g,
  \eturn (
                            <div 
                              key={path}
                              data-path={path}
                              onClick={() => setActiveFile(path)}\
);

fs.writeFileSync(file, content);
