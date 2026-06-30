import TunnelSettingsClient from './TunnelSettingsClient';
import { createClient } from '@/utils/supabase/server';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export default async function TunnelSettingsPage({ params }: { params: Promise<{ workspace_slug: string, project_slug: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();

  // Garante o contexto de autenticação para o RLS
  const { data: { user } } = await supabase.auth.getUser();

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', resolvedParams.workspace_slug)
    .single();

  if (wsError) console.error('Workspace fetch error:', wsError);

  let projectId = '';
  let projectToken = '';
  let projectName = '';

  if (workspace) {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, secret_token, name')
      .eq('workspace_id', workspace.id)
      .eq('slug', resolvedParams.project_slug)
      .single();

    if (projError) console.error('Project fetch error:', projError);

    if (project) {
      projectId = project.id;
      projectToken = project.secret_token || '';
      projectName = project.name || '';
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <Breadcrumbs 
        workspaceName={workspace?.name}
        projectName={projectName}
        workspaceSlug={resolvedParams.workspace_slug}
        projectSlug={resolvedParams.project_slug}
        viewName="Configurações de Bancos (JSON)"
      />
      <div className="mt-4">
        <TunnelSettingsClient 
          workspaceSlug={resolvedParams.workspace_slug} 
          projectSlug={resolvedParams.project_slug}
          initialProjectId={projectId}
          initialProjectToken={projectToken}
        />
      </div>
    </div>
  );
}
