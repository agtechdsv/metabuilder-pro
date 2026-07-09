import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron authentication to ensure this is only called securely
    // In production, Vercel sends an authorization header.
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 2. We use the Supabase Service Role Key to bypass RLS and delete files/rows securely
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Find all expired builds
    const { data: expiredBuilds, error: fetchError } = await supabaseAdmin
      .from('desktop_builds')
      .select('id, download_url')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired builds:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch expired builds' }, { status: 500 })
    }

    if (!expiredBuilds || expiredBuilds.length === 0) {
      return NextResponse.json({ success: true, message: 'No expired builds to clean up.' })
    }

    // 4. Extract storage paths from download_urls
    // Assuming download_urls look like: https://[project].supabase.co/storage/v1/object/public/releases/desktop-builds/...
    const bucketName = 'releases'
    const pathsToDelete: string[] = []
    
    for (const build of expiredBuilds) {
      if (build.download_url) {
        // Try to parse the file path from the URL
        try {
          const urlObj = new URL(build.download_url)
          // The path after /object/public/releases/ is the file path
          const pathSegments = urlObj.pathname.split(`/object/public/${bucketName}/`)
          if (pathSegments.length > 1) {
            const filePath = decodeURIComponent(pathSegments[1])
            pathsToDelete.push(filePath)
          }
        } catch (e) {
          console.warn(`Could not parse URL for build ${build.id}: ${build.download_url}`)
        }
      }
    }

    // 5. Delete files from Supabase Storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin
        .storage
        .from(bucketName)
        .remove(pathsToDelete)
        
      if (storageError) {
        console.error('Error deleting files from storage:', storageError)
        // We log the error but proceed to delete the DB records anyway
      }
    }

    // 6. Delete records from database
    const buildIds = expiredBuilds.map(b => b.id)
    const { error: deleteError } = await supabaseAdmin
      .from('desktop_builds')
      .delete()
      .in('id', buildIds)

    if (deleteError) {
      console.error('Error deleting records from desktop_builds:', deleteError)
      return NextResponse.json({ error: 'Failed to delete DB records' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleaned up ${buildIds.length} expired builds.`,
      deleted_files: pathsToDelete.length
    })

  } catch (error: any) {
    console.error('Cron job failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
