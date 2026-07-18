import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }
    const secretToken = authHeader.replace('Bearer ', '');

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, secret_token')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.secret_token !== secretToken) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
    }

    const { data: models } = await supabase
      .from('models')
      .select('db_schema_name')
      .eq('project_id', projectId);

    const schemas = Array.from(new Set((models || []).map(m => m.db_schema_name || 'public')));

    return NextResponse.json({ schemas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
