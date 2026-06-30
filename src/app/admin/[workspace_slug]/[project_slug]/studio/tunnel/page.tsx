import TunnelSettingsClient from './TunnelSettingsClient';

export default async function TunnelSettingsPage({ params }: { params: { workspace_slug: string, project_slug: string } }) {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <TunnelSettingsClient workspaceSlug={params.workspace_slug} projectSlug={params.project_slug} />
    </div>
  );
}
