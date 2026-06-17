import { useState, useEffect } from 'react'

export function useCommunityAuth(supabase: any, onSyncComplete?: () => void) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false)

  useEffect(() => {
    async function fetchAndSyncUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, full_name, is_super_admin')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.is_super_admin) {
          setIsCurrentUserAdmin(true)
        }

        if (profile) {
          const googleAvatar = user.user_metadata?.picture || user.user_metadata?.avatar_url
          const googleName = user.user_metadata?.full_name
          const updates: any = {}

          if (!profile.avatar_url && googleAvatar) {
            updates.avatar_url = googleAvatar
          }
          if (!profile.full_name && googleName) {
            updates.full_name = googleName
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id)

            if (!updateError && onSyncComplete) {
              onSyncComplete()
            }
          }
        }
      }
    }
    fetchAndSyncUser()
  }, [])

  return { currentUser, isCurrentUserAdmin }
}
