const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const artifactPathsJson = process.env.ARTIFACT_PATHS;
  const version = process.env.VERSION || 'v1.0.0';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!artifactPathsJson) {
    console.log('No ARTIFACT_PATHS provided. Skipping upload.');
    return;
  }

  let artifactPaths = [];
  try {
    artifactPaths = JSON.parse(artifactPathsJson);
  } catch (e) {
    console.error('Error parsing ARTIFACT_PATHS:', e.message);
    process.exit(1);
  }

  // Manually search for the updater JSON file in src-tauri/target
  // Because tauri-action@v0 might omit it from ARTIFACT_PATHS in Tauri v2
  const findFiles = (dir, ext, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        findFiles(filePath, ext, fileList);
      } else if (filePath.endsWith(ext)) {
        fileList.push(filePath);
      }
    }
    return fileList;
  };

  try {
    const targetDir = path.join(process.cwd(), 'src-tauri', 'target');
    const jsonFiles = findFiles(targetDir, '.json');
    
    let updaterJson = null;
    
    // First: check if we have the manually generated latest.json
    const manualLatestJson = path.join(targetDir, 'latest.json');
    if (fs.existsSync(manualLatestJson)) {
      try {
        const content = JSON.parse(fs.readFileSync(manualLatestJson, 'utf8'));
        if (content.version && content.platforms) {
          updaterJson = manualLatestJson;
          console.log('[FIX] Found manually generated latest.json');
        }
      } catch(e) {}
    }
    
    // Fallback: scan all json files for version+platforms signature
    if (!updaterJson) {
      for (const f of jsonFiles) {
        try {
          const content = JSON.parse(fs.readFileSync(f, 'utf8'));
          if (content.version && content.platforms) {
            updaterJson = f;
            break;
          }
        } catch(e) {}
      }
    }
    
    if (updaterJson && !artifactPaths.includes(updaterJson)) {
      console.log(`[FIX] Manually found updater JSON: ${updaterJson}`);
      artifactPaths.push(updaterJson);
    }
  } catch (err) {
    console.warn('Could not manually search for updater JSON:', err.message);
  }

  const ws = require('ws');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    realtime: {
      transport: ws
    }
  });

  for (const filePath of artifactPaths) {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    const fileName = path.basename(filePath);
    
    // Determine category based on file extension/name
    let category = null;
    let title = `MetaBuilder PRO v${version}`;
    let isLatestJson = false;

    if (fileName.endsWith('.json')) {
      isLatestJson = true;
    } else if (fileName.endsWith('.exe') || fileName.endsWith('.msi')) {
      category = 'ide-win';
      title += ' (Windows)';
    } else if (fileName.endsWith('.dmg') || fileName.endsWith('.app.tar.gz')) {
      category = 'ide-mac';
      title += ' (macOS)';
    } else if (fileName.endsWith('.deb') || fileName.endsWith('.AppImage') || fileName.endsWith('.rpm')) {
      category = 'ide-linux';
      title += ' (Linux)';
    } else {
      console.log(`Skipping unknown artifact type: ${fileName}`);
      continue;
    }

    // Determine storage path
    let storagePath = '';
    if (isLatestJson) {
      storagePath = `ide/latest.json`; // Always override latest.json in root of ide/
    } else {
      storagePath = `ide/v${version}/${fileName}`;
    }

    console.log(`Uploading ${fileName} to ${storagePath}...`);

    let fileBuffer = fs.readFileSync(filePath);

    // Se for o latest.json, precisamos reescrever as URLs do Github para as do Supabase!
    // Porque se o repo for privado, o Tauri não conseguirá baixar as atualizações do Github.
    if (isLatestJson) {
      try {
        const latestData = JSON.parse(fileBuffer.toString('utf-8'));
        const supabaseBaseUrl = `${supabaseUrl}/storage/v1/object/public/releases/ide/v${version}`;
        
        if (latestData.platforms) {
          for (const platform of Object.keys(latestData.platforms)) {
            const platformData = latestData.platforms[platform];
            // Extrai apenas o nome do arquivo da URL original do Github
            const originalFilename = platformData.url.split('/').pop();
            // Troca pela URL do seu Supabase
            platformData.url = `${supabaseBaseUrl}/${originalFilename}`;
            
            // Corrige a assinatura se ela estiver encodada em base64 (tauri-action@v0 faz isso)
            // Tauri v2 exige a string crua do arquivo .sig (com quebras de linha e "untrusted comment:")
            if (platformData.signature && !platformData.signature.includes('untrusted comment:')) {
              try {
                platformData.signature = Buffer.from(platformData.signature, 'base64').toString('utf-8');
                console.log(`[FIX] Decoded base64 signature for platform ${platform}`);
              } catch (e) {
                console.error(`Erro ao decodificar assinatura para ${platform}:`, e);
              }
            }
          }
        }
        
        fileBuffer = Buffer.from(JSON.stringify(latestData, null, 2), 'utf-8');
        console.log('URLs do latest.json foram reescritas para o Supabase com sucesso.');
      } catch (e) {
        console.error('Erro ao reescrever URLs no latest.json:', e);
      }
    }
    
    // Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('releases')
      .upload(storagePath, fileBuffer, {
        upsert: true,
        contentType: isLatestJson ? 'application/json' : 'application/octet-stream'
      });

    if (uploadError) {
      console.error(`Error uploading ${fileName}:`, uploadError.message);
      continue;
    }

    console.log(`Successfully uploaded ${fileName}`);

    // Insert record in app_downloads (except for latest.json)
    if (!isLatestJson && category) {
      // Check if it already exists to avoid duplicates
      const { data: existingRecords } = await supabase
        .from('app_downloads')
        .select('id')
        .eq('name', title)
        .eq('version', version)
        .eq('category', category)
        .eq('is_active', true);

      if (existingRecords && existingRecords.length > 0) {
        console.log(`Database record already exists for ${title}`);
      } else {
        const stats = fs.statSync(filePath);
        const sizeBytes = stats.size;

        console.log(`Inserting database record for ${title}...`);
        const { error: dbError } = await supabase
          .from('app_downloads')
          .insert({
            name: title,
            version: version,
            category: category,
            bucket_path: storagePath,
            size_bytes: sizeBytes,
            is_active: true
          });

        if (dbError) {
          console.error(`Error inserting DB record for ${fileName}:`, dbError.message);
          throw new Error(`Database insert failed: ${dbError.message}`);
        } else {
          console.log(`Database record created for ${title}.`);
        }
      }
    }
  }

  console.log('Upload script finished.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
