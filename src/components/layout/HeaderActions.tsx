'use client'

import { ThemeToggle } from './ThemeToggle'
import { LanguageSelector } from './LanguageSelector'
import { UserMenu } from '@/components/auth/UserMenu'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

interface HeaderActionsProps {
  user?: any
  profile?: any
  hideUser?: boolean
  hideTheme?: boolean
}

export function HeaderActions({ 
  user: initialUser, 
  profile: initialProfile, 
  hideUser = false,
  hideTheme = false 
}: HeaderActionsProps) {
  const [user, setUser] = useState(initialUser)
  const [profile, setProfile] = useState(initialProfile)
  const supabase = createClient()

  useEffect(() => {
    if (!initialUser && !hideUser) {
      const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setProfile(data)
        }
      }
      fetchUser()
    }
  }, [initialUser, supabase, hideUser])

  return (
    <div className="flex items-center gap-3 md:gap-4">
      <div className="flex items-center gap-2 pr-2 border-r border-neutral-200 dark:border-neutral-800">
        {!hideTheme && <ThemeToggle />}
        <LanguageSelector />
      </div>

      {!hideUser && user && (
        <UserMenu user={user} profile={profile} />
      )}
    </div>
  )
}
