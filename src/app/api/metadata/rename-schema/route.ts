import { NextResponse } from 'next/server';
import { createClient as createClientServer } from '@/utils/supabase/server';
import { createClient as createClientJS } from '@supabase/supabase-js';


export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const secretToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

    let supabase;
    let hasAccess = false;
    let targetProjectId = null;

    if (secretToken) {
      // Autenticação via CLI
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      supabase = createClientJS(supabaseUrl, supabaseServiceKey);
    } else {
      // Autenticação via UI (Studio)
      supabase = await createClientServer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, oldSchema, newSchema } = body;
    targetProjectId = projectId;

    if (!projectId || !oldSchema || !newSchema) {
      return NextResponse.json({ error: 'Missing projectId, oldSchema, or newSchema' }, { status: 400 });
    }

    if (secretToken) {
      const { data: project } = await supabase.from('projects').select('id, secret_token').eq('id', projectId).single();
      if (project && project.secret_token === secretToken) hasAccess = true;
    } else {
      const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single();
      if (project) hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
    }

    // 3. Atualizar o schema na tabela models
    const { error: updateError } = await supabase
      .from('models')
      .update({ db_schema_name: newSchema })
      .eq('project_id', targetProjectId)
      .eq('db_schema_name', oldSchema);

    if (updateError) {
      console.error('[RenameSchema] Error updating models:', updateError);
      return NextResponse.json(
        { error: 'Failed to update models schema' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Schema renamed from ${oldSchema} to ${newSchema} successfully`,
    });
  } catch (error: any) {
    console.error('[RenameSchema] Server error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
