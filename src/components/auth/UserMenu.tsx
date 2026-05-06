'use client'

import { useState, useRef, useEffect } from 'react'
import { User, LogOut, Camera, ChevronDown, LayoutDashboard, Loader2, RefreshCcw } from 'lucide-react'
import { signOut, updateAvatar, resetAvatar } from '@/app/auth/actions'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ProfileDrawer } from '@/components/profile/ProfileDrawer'

import { useI18n } from '@/i18n/I18nContext'

interface UserMenuProps {
  user: any
  profile?: any
}

export function UserMenu({ user, profile: initialProfile }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [localProfile, setLocalProfile] = useState(initialProfile)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    setLocalProfile(initialProfile)
  }, [initialProfile])

  const metadata = user?.user_metadata || {}
  
  const avatarUrl = 
    localProfile?.avatar_url ||
    metadata.custom_avatar ||
    metadata.avatar_url || 
    metadata.picture
  
  const fullName = localProfile?.full_name || metadata.full_name || metadata.name || user?.email || t('common.enterprise')
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()

  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)

    try {
      await updateAvatar(formData)
      router.refresh()
    } catch (error) {
      console.error('Erro no upload:', error)
    } finally {
      setIsUploading(false)
      setIsOpen(false)
    }
  }

  const handleReset = async () => {
    setIsUploading(true)
    try {
      await resetAvatar()
      router.refresh()
    } catch (error) {
      console.error('Erro ao restaurar:', error)
    } finally {
      setIsUploading(false)
      setIsOpen(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  const googleAvatar = metadata.picture || metadata.avatar_url
  const isCustomAvatar = localProfile?.avatar_url && localProfile.avatar_url !== googleAvatar

  return (
    <div 
      className="relative" 
      ref={menuRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        className="flex items-center gap-3 p-1 pr-3 rounded-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/30 transition-all group cursor-default shadow-sm"
      >
        <div className="relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
            accept="image/*"
          />
          <div 
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-blue-500/20 group-hover:border-blue-500/50 transition-all relative cursor-pointer"
          >
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
            {avatarUrl && !imgError ? (
              <img 
                src={avatarUrl} 
                alt={fullName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-xs">
                {initials}
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full flex items-center justify-center text-[8px] text-neutral-400 group-hover:text-blue-500 transition-colors">
            <Camera className="w-2.5 h-2.5" />
          </div>
        </div>
        <div className="hidden md:flex flex-col items-start">
          <span className="text-[11px] font-bold text-neutral-900 dark:text-white leading-none mb-1">
            {fullName.split(' ')[0]}
          </span>
          <span className="text-[9px] text-neutral-500 font-medium uppercase tracking-wider">
            {t('common.enterprise')}
          </span>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform duration-300", isOpen && "rotate-180")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 pt-2 w-72 z-[100]"
          >
            <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">{t('common.logged_in_as')}</span>
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{fullName}</p>
                <p className="text-[11px] text-neutral-500 truncate">{user?.email}</p>
              </div>

              <div className="p-3">
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-blue-500/5 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-white transition-all group"
                >
                  <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-all text-blue-500">
                    <LayoutDashboard className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-sm font-bold">{t('common.dashboard')}</span>
                </Link>
                
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setIsProfileOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all group"
                >
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-all text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-sm font-bold">{t('common.profile')}</span>
                </button>

                {isCustomAvatar && (
                  <button
                    onClick={handleReset}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-blue-500/5 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-blue-500 dark:hover:text-white transition-all group"
                  >
                    <div className="p-2 bg-blue-500/5 dark:bg-neutral-800 rounded-xl group-hover:bg-blue-500/20 transition-all text-blue-400 group-hover:text-blue-500">
                      <RefreshCcw className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">{t('profile.avatar_google')}</span>
                  </button>
                )}
              </div>

              <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/10">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-500/5 text-neutral-500 hover:text-red-500 transition-all group"
                >
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-800 group-hover:bg-red-500/10 rounded-xl transition-all text-neutral-400 group-hover:text-red-500">
                    <LogOut className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-sm font-bold">{t('common.logout')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ProfileDrawer 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        profile={localProfile} 
        user={user}
        onUpdate={(updatedData) => setLocalProfile((prev: any) => ({ ...prev, ...updatedData }))}
      />
    </div>
  )
}
