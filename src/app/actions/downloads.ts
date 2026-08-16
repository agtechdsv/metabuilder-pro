'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DeleteDownloadItemParams {
  id: string
  context: 'desktop_build' | 'app_download'
}

export async function deleteDownloadItem({ id, context }: DeleteDownloadItemParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    // Fetch user profile to check if super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = !!profile?.is_super_admin
    const adminSupabase = createAdminClient()
    const bucketName = 'releases'

    if (context === 'desktop_build') {
      // 1. Fetch the build to verify ownership
      const { data: build, error: fetchErr } = await adminSupabase
        .from('desktop_builds')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr || !build) {
        throw new Error('Build não encontrado.')
      }

      // Check ownership
      if (build.user_id !== user.id && !isSuperAdmin) {
        throw new Error('Acesso negado: Você só pode excluir suas próprias compilações/builds.')
      }

      // 2. Delete storage files
      const pathsToDelete: string[] = []

      // If download_url exists, parse its path
      if (build.download_url) {
        try {
          const urlObj = new URL(build.download_url)
          const publicSegments = urlObj.pathname.split(`/object/public/${bucketName}/`)
          if (publicSegments.length > 1) {
            pathsToDelete.push(decodeURIComponent(publicSegments[1]))
          } else {
            const authSegments = urlObj.pathname.split(`/object/authenticated/${bucketName}/`)
            if (authSegments.length > 1) {
              pathsToDelete.push(decodeURIComponent(authSegments[1]))
            } else {
              const genericSegments = urlObj.pathname.split(`/${bucketName}/`)
              if (genericSegments.length > 1) {
                pathsToDelete.push(decodeURIComponent(genericSegments[1]))
              }
            }
          }
        } catch {
          if (build.download_url.includes('/')) {
            pathsToDelete.push(build.download_url)
          }
        }
      }

      // Also clean up folder desktop-builds/${build.id} if any files exist (icon, binaries, etc)
      const folderPath = `desktop-builds/${build.id}`
      const { data: folderFiles } = await adminSupabase.storage.from(bucketName).list(folderPath)
      if (folderFiles && folderFiles.length > 0) {
        for (const file of folderFiles) {
          pathsToDelete.push(`${folderPath}/${file.name}`)
        }
      }

      // Remove unique paths from storage bucket
      const uniquePaths = Array.from(new Set(pathsToDelete.filter(Boolean)))
      if (uniquePaths.length > 0) {
        const { error: storageErr } = await adminSupabase.storage.from(bucketName).remove(uniquePaths)
        if (storageErr) {
          console.warn('Erro ao remover arquivos do storage:', storageErr)
        }
      }

      // 3. Delete DB record
      const { error: deleteErr } = await adminSupabase
        .from('desktop_builds')
        .delete()
        .eq('id', id)

      if (deleteErr) {
        throw new Error(deleteErr.message)
      }

    } else {
      // context === 'app_download'
      if (!isSuperAdmin) {
        throw new Error('Acesso negado: Apenas administradores globais podem excluir downloads oficiais.')
      }

      const { data: downloadFile, error: fetchErr } = await adminSupabase
        .from('app_downloads')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr || !downloadFile) {
        throw new Error('Arquivo não encontrado.')
      }

      if (downloadFile.bucket_path) {
        await adminSupabase.storage.from(bucketName).remove([downloadFile.bucket_path])
      }

      const { error: deleteErr } = await adminSupabase
        .from('app_downloads')
        .delete()
        .eq('id', id)

      if (deleteErr) {
        throw new Error(deleteErr.message)
      }
    }

    revalidatePath('/client/dashboard')
    revalidatePath('/downloads')
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao excluir item de download:', err)
    return { success: false, error: err.message || 'Erro ao excluir arquivo.' }
  }
}
