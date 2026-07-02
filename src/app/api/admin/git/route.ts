import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    // SECURITY 1: Ensure this only runs in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Local git commands are only available in development environment.' }, { status: 403 })
    }

    // SECURITY 2: Ensure the user is a super admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, message } = body

    if (action === 'commit') {
      if (!message) {
        return NextResponse.json({ error: 'Commit message is required' }, { status: 400 })
      }
      
      // Add all changes and commit
      await execAsync('git add .')
      const { stdout, stderr } = await execAsync(`git commit -m "${message}"`)
      
      return NextResponse.json({ success: true, stdout, stderr })
    } 
    
    if (action === 'push') {
      const { stdout, stderr } = await execAsync('git push')
      return NextResponse.json({ success: true, stdout, stderr })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Git execution error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
