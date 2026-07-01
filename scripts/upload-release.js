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

    if (fileName === 'latest.json') {
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

    const fileBuffer = fs.readFileSync(filePath);
    
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
        .eq('title', title)
        .eq('version', version)
        .eq('category', category)
        .eq('is_active', true);

      if (existingRecords && existingRecords.length > 0) {
        console.log(`Database record already exists for ${title}`);
      } else {
        // Calculate file size in MB
        const stats = fs.statSync(filePath);
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

        console.log(`Inserting database record for ${title}...`);
        const { error: dbError } = await supabase
          .from('app_downloads')
          .insert({
            title: title,
            description: `Instalador oficial do MetaBuilder PRO versão ${version}.`,
            version: version,
            category: category,
            bucket_path: storagePath,
            size: sizeMb,
            is_active: true
          });

        if (dbError) {
          console.error(`Error inserting DB record for ${fileName}:`, dbError.message);
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
