const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'app');
const adminDir = path.join(srcDir, 'admin');
const workspaceAdminDir = path.join(adminDir, '[workspace_slug]');
const projectAdminDir = path.join(workspaceAdminDir, '[project_slug]');

try {
    fs.mkdirSync(projectAdminDir, { recursive: true });

    // Move studio folder using cpSync and rmSync
    const oldStudioDir = path.join(srcDir, '[workspace_slug]', '[project_slug]', 'studio');
    const newStudioDir = path.join(projectAdminDir, 'studio');
    
    if (fs.existsSync(oldStudioDir)) {
        fs.cpSync(oldStudioDir, newStudioDir, { recursive: true });
        fs.rmSync(oldStudioDir, { recursive: true, force: true });
    }

    console.log('Routes moved successfully!');
} catch(err) {
    console.error(err);
}
