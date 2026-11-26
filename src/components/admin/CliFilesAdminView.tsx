'use client'

import { useState, useEffect } from 'react'
import { IdeUpdaterButton } from '@/components/runtime/IdeUpdaterButton'
import { createClient } from '@/utils/supabase/client'
import { Download, Upload, Trash2, File as FileIcon, Loader2, X, Check, Filter } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n/I18nContext'

export function CliFilesAdminView() {
  const { t } = useI18n()
  const k = (key: string, vars: Record<string, string> = {}) => {
    let out = t('admin_cli_files.' + key)
    for (const [name, v] of Object.entries(vars)) out = out.split('{' + name + '}').join(v)
    return out
  }
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showOlderReleases, setShowOlderReleases] = useState(false)
  const [localVersion, setLocalVersion] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [releaseNotesList, setReleaseNotesList] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, bucketPath: string, name: string, category: string } | null>(null)

  // Filter state
  const [filter, setFilter] = useState<'all' | 'cli-win' | 'cli-linux' | 'template' | 'manual' | 'ide-win' | 'ide-mac' | 'ide-linux'>('all')

  // Form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'cli-win',
    version: '',
    isActive: true,
    file: null as File | null
  })

  const supabase = createClient()
  const { toast } = useToast()

  const fetchFiles = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('app_downloads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast(k('t_load_error', { msg: error.message }), 'error')
    } else {
      setFiles(data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFiles()
    
    // Fetch release notes and local version for Auto Updater
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReleaseNotesList(data)
      })

    const checkVersion = async () => {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (!isTauri()) {
        setLocalVersion('Web App Edition')
        return
      }
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        setLocalVersion(`IDE Engine v${v}`)
      } catch (e: any) {
        setLocalVersion(`Erro: ${e.message || String(e)}`)
      }
    }
    checkVersion()
  }, [])

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForm.file || !uploadForm.name || !uploadForm.version) {
      toast(k('t_fill_all'), 'error')
      return
    }

    setIsUploading(true)

    // 1. Upload to Storage
    // Format path: cli/v1.0.0/filename or template/v1.0.0/filename
    const folderName = uploadForm.category.startsWith('cli') ? 'cli' : uploadForm.category
    const bucketPath = `${folderName}/v${uploadForm.version}/${uploadForm.file.name}`

    const { error: uploadError } = await supabase.storage
      .from('releases')
      .upload(bucketPath, uploadForm.file, {
        upsert: true
      })

    if (uploadError) {
      toast(k('t_upload_error', { msg: uploadError.message }), 'error')
      setIsUploading(false)
      return
    }

    // 2. Insert into Database
    const { error: dbError } = await supabase
      .from('app_downloads')
      .insert([{
        name: uploadForm.name,
        category: uploadForm.category,
        version: uploadForm.version,
        bucket_path: bucketPath,
        size_bytes: uploadForm.file.size,
        is_active: uploadForm.isActive
      }])

    if (dbError) {
      toast(k('t_db_error', { msg: dbError.message }), 'error')
    } else {
      toast(k('t_uploaded'), 'success')
      setShowModal(false)
      setUploadForm({ name: '', category: 'cli-win', version: '', isActive: true, file: null })
      fetchFiles()
    }
    setIsUploading(false)
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('app_downloads')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      toast(k('t_status_error', { msg: error.message }), 'error')
    } else {
      toast(k('t_status_ok'), 'success')
      setFiles(files.map(f => f.id === id ? { ...f, is_active: !currentStatus } : f))
    }
  }

  const handleDeleteClick = (id: string, bucketPath: string, name: string, category: string) => {
    setDeleteConfirm({ id, bucketPath, name, category })
  }

  const handleDownloadFile = async (bucketPath: string, name: string) => {
    try {
      const { data, error } = await supabase.storage.from('releases').createSignedUrl(bucketPath, 60 * 60)
      if (error || !data) {
        toast(k('t_link_error', { msg: error?.message || k('t_unknown') }), 'error')
        return
      }
      window.open(data.signedUrl, '_blank')
    } catch (e: any) {
      toast(k('t_download_fail', { msg: e.message }), 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    setIsLoading(true)
    const { id, bucketPath, category } = deleteConfirm
    setDeleteConfirm(null)

    // 1. Delete from storage
    await supabase.storage.from('releases').remove([bucketPath])

    // 2. Delete from DB
    const { error } = await supabase.from('app_downloads').delete().eq('id', id)

    if (!error && category.startsWith('ide-')) {
      try {
        toast(k('t_deleting_github'), 'info')
        await fetch(`/api/admin/release/assets?category=${category}`, { method: 'DELETE' })
      } catch (e) {
        console.error('Failed to delete github assets', e)
      }
    }

    if (error) {
      toast(k('t_delete_db_error', { msg: error.message }), 'error')
    } else {
      toast(k('t_deleted'), 'success')
      fetchFiles()
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cli-win': return k('cat_cli_win')
      case 'cli-linux': return k('cat_cli_linux')
      case 'template': return k('cat_template')
      case 'manual': return k('cat_manual')
      case 'ide-win': return k('cat_ide_win')
      case 'ide-mac': return k('cat_ide_mac')
      case 'ide-linux': return k('cat_ide_linux')
      default: return cat
    }
  }

  const filteredFiles = files.filter(f => filter === 'all' || f.category === filter)

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-black p-8 pt-10">
      <div className="max-w-5xl mx-auto w-full space-y-6">

        {releaseNotesList.length > 0 && localVersion && (
          (() => {
            const installed = localVersion.replace('IDE Engine v', '').trim()
            const latest = releaseNotesList[0].version.replace('v', '')
            const isOutdated = localVersion.startsWith('IDE Engine') && installed !== latest && installed !== 'Erro:' && !localVersion.includes('Erro')
            
            if (isOutdated) {
              return (
                <div className="relative flex items-center justify-center mb-10 z-10">
                  <button 
                    onClick={async () => {
                      try {
                        setIsUpdating(true)
                        const { check } = await import('@tauri-apps/plugin-updater')
                        const update = await check()
                        if (update) {
                          await import('@tauri-apps/api/core').then(m => m.invoke('stopcli')).catch(() => {});
                                    await new Promise(r => setTimeout(r, 1500)); // Aguarda o SO liberar o arquivo
                                    await update.downloadAndInstall()
                        }
                      } catch (e) {
                        console.error('Update failed', e)
                      } finally {
                        setIsUpdating(false)
                      }
                    }}
                    disabled={isUpdating}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {k('updating')}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {k('update_to', { v: latest })}
                      </>
                    )}
                  </button>
                </div>
              )
            }
            return null
          })()
        )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 dark:text-white">{k('title')}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{k('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm"
        >
          <Upload className="w-5 h-5" />
          {k('upload')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500 dark:text-neutral-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{k('filters')}</span>
        </div>
        {[
          { id: 'all', label: k('f_all') },
          { id: 'ide-win', label: k('cat_ide_win') },
          { id: 'ide-mac', label: k('cat_ide_mac') },
          { id: 'ide-linux', label: k('cat_ide_linux') },
          { id: 'cli-win', label: k('f_cli_win') },
          { id: 'cli-linux', label: k('f_cli_linux') },
          { id: 'template', label: k('f_template') },
          { id: 'manual', label: k('f_manual') }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f.id
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm shadow-sm border-b border-neutral-200 dark:border-neutral-700">
              <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('col_file')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('col_category')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('col_version')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">{k('col_size')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-center">{k('col_active')}</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">{k('col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredFiles.length > 0 ? (
              filteredFiles.map(file => (
                <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{file.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                      {getCategoryLabel(file.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    v{file.version}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {(file.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleActive(file.id, file.is_active)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${file.is_active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${file.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownloadFile(file.bucket_path, file.name)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-neutral-400 hover:text-indigo-500 rounded-lg transition-colors"
                        title={k('download')}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(file.id, file.bucket_path, file.name, file.category)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                        title={k('delete')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">{k('empty')}</p>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white">{k('modal_title')}</h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">{k('name_label')}</label>
                <input
                  type="text"
                  required
                  placeholder={k('name_ph')}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                  value={uploadForm.name}
                  onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">{k('col_category')}</label>
                  <select
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                    value={uploadForm.category}
                    onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                  >
                    <option value="cli-win">{k('cat_cli_win')}</option>
                    <option value="cli-linux">{k('cat_cli_linux')}</option>
                    <option value="template">{k('cat_template')}</option>
                    <option value="manual">{k('cat_manual')}</option>
                    <option value="ide-win">{k('opt_ide_win')}</option>
                    <option value="ide-mac">{k('opt_ide_mac')}</option>
                    <option value="ide-linux">{k('opt_ide_linux')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">{k('col_version')}</label>
                  <input
                    type="text"
                    required
                    placeholder={k('version_ph')}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                    value={uploadForm.version}
                    onChange={e => setUploadForm({ ...uploadForm, version: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">{k('pick_file')}</label>
                <input
                  type="file"
                  required
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                />
              </div>

              <label className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer w-6 h-6 rounded-md border-2 border-neutral-300 dark:border-neutral-600 appearance-none checked:bg-indigo-500 checked:border-indigo-500 transition-colors"
                    checked={uploadForm.isActive}
                    onChange={e => setUploadForm({ ...uploadForm, isActive: e.target.checked })}
                  />
                  <Check className="w-4 h-4 text-white absolute left-1 pointer-events-none opacity-0 peer-checked:opacity-100" />
                </div>
                <div>
                  <div className="text-sm font-bold text-neutral-900 dark:text-white">{k('active_q')}</div>
                  <div className="text-xs text-neutral-500">{k('active_hint')}</div>
                </div>
              </label>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold transition-all text-sm"
                >
                  {k('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all text-sm disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isUploading ? k('sending') : k('save_send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">{k('delete_title')}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              {k('delete_q_pre')}<strong>{deleteConfirm.name}</strong>{k('delete_q_post')}<br />
              {k('delete_irreversible')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold transition-all text-sm"
              >
                {k('cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-sm"
              >
                {k('delete_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
