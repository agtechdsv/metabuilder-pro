-- Project Roles
CREATE TABLE public.project_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Role Permissions (UI Views)
CREATE TABLE public.project_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
    view_id UUID NOT NULL REFERENCES public.ui_views(id) ON DELETE CASCADE,
    can_read BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, view_id)
);

-- Project User Roles
CREATE TABLE public.project_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL, -- ID of the user in the client's database (or LDAP, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, external_user_id)
);

-- RLS
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage roles in their projects" ON public.project_roles
    USING (public.has_project_access(project_id));

CREATE POLICY "Users can manage role permissions in their projects" ON public.project_role_permissions
    USING (
        EXISTS (
            SELECT 1 FROM public.project_roles pr
            WHERE pr.id = project_role_permissions.role_id AND public.has_project_access(pr.project_id)
        )
    );

CREATE POLICY "Users can manage user roles in their projects" ON public.project_user_roles
    USING (public.has_project_access(project_id));
