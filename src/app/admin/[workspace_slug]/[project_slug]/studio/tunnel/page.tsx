import TunnelSettingsClient from './TunnelSettingsClient';
import { createClient } from '@/utils/supabase/server';

export default async function TunnelSettingsPage({ params }: { params: Promise<{ workspace_slug: string, project_slug: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();

  // Garante o contexto de autenticação para o RLS
  const { data: { user } } = await supabase.auth.getUser();

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', resolvedParams.workspace_slug)
    .single();

  if (wsError) console.error('Workspace fetch error:', wsError);

  let projectId = '';
  let projectToken = '';

  if (workspace) {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, secret_token')
      .eq('workspace_id', workspace.id)
      .eq('slug', resolvedParams.project_slug)
      .single();

    if (projError) console.error('Project fetch error:', projError);

    if (project) {
      projectId = project.id;
      projectToken = project.secret_token || '';
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <TunnelSettingsClient 
        workspaceSlug={resolvedParams.workspace_slug} 
        projectSlug={resolvedParams.project_slug}
        initialProjectId={projectId}
        initialProjectToken={projectToken}
      />
    </div>
  );
}
