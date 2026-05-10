'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Building2, Save, Mail, Phone, Hash, MapPin, Loader2, CheckCircle2, Camera, RefreshCcw } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { updateProfile, updateAvatar, resetAvatar } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'

interface ProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  profile: any
  user: any
  onUpdate: (updatedData: any) => void
}

type Tab = 'basic' | 'company'

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export function ProfileDrawer({ isOpen, onClose, profile, user, onUpdate }: ProfileDrawerProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Refs para Foco
  const nameInputRef = useRef<HTMLInputElement>(null)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        whatsapp: profile.whatsapp || '',
        company_name: profile.company_name || '',
        cnpj: profile.cnpj || '',
        address_zip: profile.address_zip || '',
        address_street: profile.address_street || '',
        address_number: profile.address_number || '',
        address_complement: profile.address_complement || '',
        address_neighborhood: profile.address_neighborhood || '',
        address_city: profile.address_city || '',
        address_state: profile.address_state || '',
      })
    }
  }, [profile, isOpen])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (activeTab === 'basic') {
          nameInputRef.current?.focus()
        } else {
          companyInputRef.current?.focus()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isOpen, activeTab])

  const applyMask = (name: string, value: string) => {
    let v = value.replace(/\D/g, '')
    if (name === 'whatsapp') {
      v = v.substring(0, 11)
      if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3')
      else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2')
      else if (v.length > 0) v = v.replace(/^(\d*)/, '($1')
      return v
    }
    if (name === 'cnpj') {
      v = v.substring(0, 14)
      v = v.replace(/^(\d{2})(\d)/, '$1.$2')
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
      v = v.replace(/(\d{4})(\d)/, '$1-$2')
      return v
    }
    if (name === 'address_zip') {
      v = v.substring(0, 8)
      if (v.length > 5) v = v.replace(/^(\d{5})(\d{3}).*/, '$1-$2')
      return v
    }
    return value
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const maskedValue = applyMask(name, value)
    setFormData((prev: any) => ({ ...prev, [name]: maskedValue }))

    if (name === 'address_zip' && maskedValue.replace(/\D/g, '').length === 8) {
      fetchViaCEP(maskedValue.replace(/\D/g, ''))
    }
  }

  const fetchViaCEP = async (cep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setFormData((prev: any) => ({
          ...prev,
          address_street: data.logradouro,
          address_neighborhood: data.bairro,
          address_city: data.localidade,
          address_state: data.uf
        }))
      }
    } catch (err) {
      console.error('Erro ViaCEP:', err)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const data = new FormData()
    data.append('avatar', file)
    try {
      const newUrl = await updateAvatar(data)
      if (newUrl) {
        onUpdate({ avatar_url: newUrl })
        router.refresh()
      }
    } catch (err) {
      console.error('Erro upload:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAvatarReset = async () => {
    setIsUploading(true)
    try {
      await resetAvatar()
      router.refresh()
    } catch (err) {
      console.error('Erro reset:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => data.append(key, value as string))
    try {
      const result = await updateProfile(data)
      if (result.success) {
        onUpdate(formData)
        setIsSuccess(true)
        setTimeout(() => setIsSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Erro salvar:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const googleAvatar = user?.user_metadata?.picture || user?.user_metadata?.avatar_url
  const isCustomAvatar = profile?.avatar_url && profile.avatar_url !== googleAvatar

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-md z-[150]" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-[#0a0a0a] border-l border-neutral-200 dark:border-neutral-800/50 z-[160] shadow-[-20px_0_80px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col">
            
            {/* Header */}
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800/50 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-900/20">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">{t('profile.title')}</h2>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 uppercase tracking-widest font-bold">{t('profile.subtitle')}</p>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-xl bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 bg-neutral-50 dark:bg-neutral-900/30 border-b border-neutral-100 dark:border-neutral-800/50">
              <button type="button" onClick={() => setActiveTab('basic')} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all", activeTab === 'basic' ? "bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20 shadow-sm" : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5")}><User className="w-4 h-4" />{t('profile.tab_basic')}</button>
              <button type="button" onClick={() => setActiveTab('company')} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all", activeTab === 'company' ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 border border-indigo-500/20 shadow-sm" : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5")}><Building2 className="w-4 h-4" />{t('profile.tab_company')}</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
              <AnimatePresence mode="wait">
                {activeTab === 'basic' ? (
                  <motion.div key="basic" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.full_name')}</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                        <input ref={nameInputRef} name="full_name" value={formData.full_name} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="Ex: Alexandre Santos" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.email')}</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                        <input name="email" value={formData.email} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="email@exemplo.com" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.whatsapp')}</label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                        <input name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="(00) 00000-0000" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                      <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1 mb-4 block">{t('profile.avatar')}</label>
                      <div className="flex items-center gap-6 p-4 bg-neutral-50 dark:bg-neutral-900/40 rounded-2xl border border-neutral-100 dark:border-neutral-800/50">
                        <div className="relative group">
                          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-neutral-200 dark:border-neutral-800 group-hover:border-blue-500/50 transition-all relative shadow-sm">
                            {isUploading && (
                              <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                              </div>
                            )}
                            <img src={profile?.avatar_url || googleAvatar} className="w-full h-full object-cover" alt="Profile" />
                          </div>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all">
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium leading-tight">{t('profile.avatar_hint')}</p>
                          {isCustomAvatar && (
                            <button type="button" onClick={handleAvatarReset} className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors uppercase tracking-wider">
                              <RefreshCcw className="w-3 h-3" />
                              {t('profile.avatar_google')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="company" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.company_name')}</label>
                        <div className="relative group">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                          <input ref={companyInputRef} name="company_name" value={formData.company_name} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="Nome da sua empresa" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.cnpj')}</label>
                        <div className="relative group">
                          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                          <input name="cnpj" value={formData.cnpj} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="00.000.000/0000-00" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.cep')}</label>
                        <div className="relative group">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                          <input name="address_zip" value={formData.address_zip} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" placeholder="00000-000" />
                        </div>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.address')}</label>
                        <input name="address_street" value={formData.address_street} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.number')}</label>
                        <input name="address_number" value={formData.address_number} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.complement')}</label>
                        <input name="address_complement" value={formData.address_complement} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.neighborhood')}</label>
                        <input name="address_neighborhood" value={formData.address_neighborhood} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.city')}</label>
                        <input name="address_city" value={formData.address_city} onChange={handleChange} className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all placeholder:text-neutral-300 dark:placeholder:text-neutral-700" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">{t('profile.state')}</label>
                        <select 
                          name="address_state" 
                          value={formData.address_state} 
                          onChange={handleChange} 
                          className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl py-[11px] px-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white dark:focus:bg-neutral-900 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">UF</option>
                          {BR_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-900/20 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-all font-bold text-sm">
                {t('profile.cancel')}
              </button>
              <button type="submit" onClick={handleSubmit} disabled={isLoading} className={cn("flex-[2] py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2", isSuccess ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20")}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSuccess ? <><CheckCircle2 className="w-5 h-5" /> {t('common.success')}</> : <><Save className="w-5 h-5" /> {t('profile.save')}</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
