'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, Image as ImageIcon, Heart, MessageCircle, UserPlus, Check, X, 
  MoreHorizontal, MessageSquare, ExternalLink, Loader2, ArrowLeft, 
  Paperclip, Trash2, UserMinus, MessageSquareOff, EyeOff, Eye, UserX, UserCheck, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/utils/supabase/client'

import { useCommunityAuth } from './hooks/community/useCommunityAuth'
import { useCommunityConnections } from './hooks/community/useCommunityConnections'
import { useCommunityFeed } from './hooks/community/useCommunityFeed'
import { useCommunityChat } from './hooks/community/useCommunityChat'
import { useCommunityAdmin } from './hooks/community/useCommunityAdmin'
import { useI18n } from '@/i18n'

export default function CommunityHubView({ 
  hideHeader = false,
  isSimulator = false
}: { 
  hideHeader?: boolean
  isSimulator?: boolean
}) {
  const { t } = useI18n()
  const supabase = createClient()
  const imageInputRef = useRef<HTMLInputElement>(null)
  
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'chat'>('feed')
  const [activeConnection, setActiveConnection] = useState<any>(null)
  
  const { currentUser, isCurrentUserAdmin } = useCommunityAuth(supabase)
  
  const {
    connections, setConnections, suggestions, setSuggestions, isLoadingConnections,
    isProcessingConnection, fetchConnectionsData, handleConnectionAction
  } = useCommunityConnections(supabase, isSimulator)

  const {
    posts, setPosts, isLoadingPosts, newPostContent, setNewPostContent,
    postImageFile, setPostImageFile, postImagePreview, setPostImagePreview,
    isPublishing, isLiking, openCommentsPostId, setOpenCommentsPostId,
    commentsForPost, setCommentsForPost, isLoadingComments, newCommentText, setNewCommentText,
    isSubmittingComment, fetchPosts, handlePublishPost, handleLikePost,
    handleToggleComments, handleSubmitComment, handleImageChange, handlePostPaste
  } = useCommunityFeed(supabase, isSimulator, currentUser)

  const {
    activeRoomId, setActiveRoomId, messages, setMessages, isLoadingMessages,
    newMessageText, setNewMessageText, isSendingMessage, handleOpenChat,
    handleSendMessage, handleKeyPress, messagesEndRef
  } = useCommunityChat(supabase, isSimulator, currentUser, setActiveSubTab, setActiveConnection)

  const {
    processingAdminAction, confirmModal, setConfirmModal,
    handleAdminTogglePostHide, handleAdminDeletePost, handleAdminToggleCommentHide,
    handleAdminDeleteComment, handleAdminToggleUserBlock
  } = useCommunityAdmin(isSimulator, fetchPosts, fetchConnectionsData, setPosts, setCommentsForPost, setConnections, openCommentsPostId, setOpenCommentsPostId)

  // Separate connection categories
  const activeConnections = connections.filter(c => c.status === 'ACCEPTED')
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.isRequester)
  const pendingOutgoing = connections.filter(c => c.status === 'PENDING' && c.isRequester)

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      
      {/* Header Banner */}
      {!hideHeader && (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/10 border border-white/20 backdrop-blur-md uppercase tracking-widest">
                <Users className="w-3.5 h-3.5 text-blue-400" /> {t('client_views.community.tag', 'Networking & Hub')}
              </span>
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/client/community/popout', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                  }
                }}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
                title={t('client_views.community.focus_mode_tooltip', 'Abrir em Nova Janela (Modo Foco)')}
              >
                <span className="hidden md:inline text-xs font-bold uppercase tracking-widest group-hover:text-white">{t('client_views.community.focus_mode', 'Modo Foco')}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">{t('client_views.community.title', 'MetaBuilders')}</h2>
            <p className="text-indigo-100 text-sm md:text-base leading-relaxed">
              {t('client_views.community.desc', 'Conecte-se com outros Owners e Desenvolvedores, compartilhe insights e faça networking.')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Column (Feed or Chat) */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            
            {activeSubTab === 'feed' ? (
              <motion.div
                key="feed-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Create Post Input */}
                {currentUser && (
                  <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 transition-all">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold shrink-0 overflow-hidden">
                        {currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture ? (
                          <img 
                            src={currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{currentUser.email?.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-4">
                        <textarea 
                          placeholder={t('client_views.community.create_post_placeholder', 'O que você quer compartilhar com a comunidade? (Cole uma imagem com Ctrl+V)')}
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          onPaste={handlePostPaste}
                          className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[80px] text-neutral-900 dark:text-white placeholder:text-neutral-400 text-lg focus:outline-none"
                        />
                        
                        {postImagePreview && (
                          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-850">
                            <img src={postImagePreview} alt="Preview" className="max-h-72 w-full object-cover" />
                            <button 
                              onClick={() => {
                                setPostImageFile(null)
                                setPostImagePreview(null)
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-neutral-950/80 hover:bg-neutral-950 text-white rounded-full transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
                          <input 
                            type="file" 
                            ref={imageInputRef} 
                            onChange={handleImageChange} 
                            className="hidden" 
                            accept="image/*" 
                          />
                          <button 
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2 text-neutral-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={handlePublishPost}
                            disabled={isPublishing || (!newPostContent.trim() && !postImageFile)}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
                          >
                            {isPublishing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t('client_views.community.publishing', 'Publicando...')}</span>
                              </>
                            ) : (
                              <>
                                <span>{t('client_views.community.publish', 'Publicar')}</span>
                                <Send className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feed Posts */}
                {isLoadingPosts ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                    <p className="text-neutral-400 font-medium">{t('client_views.community.loading_feed', 'Carregando feed...')}</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                    <MessageSquareOff className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
                    <p className="text-neutral-500 dark:text-neutral-400 font-bold">{t('client_views.community.empty_posts_title', 'Nenhuma publicação ainda.')}</p>
                    <p className="text-xs text-neutral-400 mt-1">{t('client_views.community.empty_posts_desc', 'Seja o primeiro a compartilhar algo com a comunidade!')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map(post => (
                      <div key={post.id} className={cn("bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border transition-colors", post.is_hidden ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10" : "border-neutral-200 dark:border-neutral-800")}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-800" />
                            <div>
                              <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                {post.user.name}
                                <span className={cn(
                                  "px-2 py-0.5 text-[9px] font-black uppercase rounded-full",
                                  post.user.role === 'ADMIN' && "bg-red-550/10 text-red-500",
                                  post.user.role === 'OWNER' && "bg-indigo-500/10 text-indigo-500",
                                  post.user.role === 'DEV' && "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                                )}>
                                  {post.user.role}
                                </span>
                                {isCurrentUserAdmin && post.is_hidden && (
                                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-700">{t('client_views.community.hidden_badge', 'Oculto')}</span>
                                )}
                              </h4>
                              <span className="text-xs text-neutral-400">
                                {new Date(post.created_at).toLocaleDateString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                          
                          {/* Admin Controls */}
                          {isCurrentUserAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleAdminToggleUserBlock(post.user.id, post.user.is_blocked_community)}
                                disabled={processingAdminAction[`user_block_${post.user.id}`]}
                                title={post.user.is_blocked_community ? t('client_views.community.unblock_user', 'Desbloquear usuário') : t('client_views.community.block_user', 'Bloquear usuário')}
                                className={cn(
                                  "p-1.5 rounded-lg text-xs transition-all active:scale-90 disabled:opacity-50",
                                  post.user.is_blocked_community
                                    ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                    : "text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                )}
                              >
                                {post.user.is_blocked_community ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleAdminTogglePostHide(post.id, post.is_hidden)}
                                disabled={processingAdminAction[`post_hide_${post.id}`]}
                                title={post.is_hidden ? t('client_views.community.show_post', 'Exibir post') : t('client_views.community.hide_post', 'Ocultar post')}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-90 disabled:opacity-50"
                              >
                                {post.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleAdminDeletePost(post.id)}
                                disabled={processingAdminAction[`post_delete_${post.id}`]}
                                title={t('client_views.community.delete_post', 'Excluir post permanentemente')}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-neutral-700 dark:text-neutral-300 mb-4 text-[15px] leading-relaxed whitespace-pre-line">
                          {post.content}
                        </p>

                        {post.image_url && (
                          <div className="rounded-2xl overflow-hidden border border-neutral-150 dark:border-neutral-850 mb-6">
                            <img src={post.image_url} alt="Post Attachment" className="w-full max-h-[420px] object-cover" />
                          </div>
                        )}
                        
                        <div className="flex items-center gap-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                          <button 
                            onClick={() => handleLikePost(post.id)}
                            className={cn(
                              "flex items-center gap-2 transition-colors group",
                              post.likedByMe ? "text-rose-500" : "text-neutral-500 hover:text-rose-500"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-full transition-colors",
                              post.likedByMe ? "bg-rose-500/10" : "group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20"
                            )}>
                              <Heart className="w-5 h-5 fill-current" />
                            </div>
                            <span className="font-bold text-sm">{post.likesCount}</span>
                          </button>
                          
                          <button 
                            onClick={() => handleToggleComments(post.id)}
                            className={cn(
                              "flex items-center gap-2 transition-colors group",
                              openCommentsPostId === post.id ? "text-indigo-500" : "text-neutral-500 hover:text-indigo-500"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-full transition-colors",
                              openCommentsPostId === post.id ? "bg-indigo-500/10" : "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20"
                            )}>
                              <MessageCircle className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm">{post.commentsCount}</span>
                          </button>
                        </div>

                        {/* Comments Drawer / Section */}
                        {openCommentsPostId === post.id && (
                          <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4 animate-in slide-in-from-top-4 duration-200">
                            <h5 className="font-black text-xs uppercase tracking-widest text-neutral-450">{t('client_views.community.comments_title', 'Comentários')}</h5>
                            
                            {isLoadingComments[post.id] ? (
                              <div className="flex items-center gap-2 py-4 justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                <span className="text-xs text-neutral-400">{t('client_views.community.loading_comments', 'Carregando...')}</span>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {(commentsForPost[post.id] || []).length === 0 ? (
                                  <p className="text-xs text-neutral-450 italic py-2 text-center">{t('client_views.community.empty_comments', 'Nenhum comentário. Comece a conversa!')}</p>
                                ) : (
                                  (commentsForPost[post.id] || []).map(comment => (
                                    <div key={comment.id} className={cn("flex gap-3 items-start p-3 rounded-2xl", comment.is_hidden ? "bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50" : "bg-neutral-50 dark:bg-neutral-850")}>
                                      <img src={comment.user.avatar} alt={comment.user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                      <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-xs text-neutral-900 dark:text-white">{comment.user.name}</span>
                                            <span className="px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-800 text-[8px] font-black uppercase text-neutral-500 rounded">
                                              {comment.user.role}
                                            </span>
                                            {isCurrentUserAdmin && comment.is_hidden && (
                                              <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-700">{t('client_views.community.hidden_badge', 'Oculto')}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-neutral-400">
                                              {new Date(comment.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {/* Admin comment controls */}
                                            {isCurrentUserAdmin && (
                                              <>
                                                <button
                                                  onClick={() => handleAdminToggleUserBlock(comment.user.id, comment.user.is_blocked_community)}
                                                  disabled={processingAdminAction[`user_block_${comment.user.id}`]}
                                                  title={comment.user.is_blocked_community ? t('client_views.community.unblock_user', 'Desbloquear usuário') : t('client_views.community.block_user', 'Bloquear usuário')}
                                                  className={cn(
                                                    "p-1 rounded-lg transition-all active:scale-90 disabled:opacity-50",
                                                    comment.user.is_blocked_community
                                                      ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                      : "text-neutral-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                  )}
                                                >
                                                  {comment.user.is_blocked_community ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                  onClick={() => handleAdminToggleCommentHide(post.id, comment.id, comment.is_hidden)}
                                                  disabled={processingAdminAction[`comment_hide_${comment.id}`]}
                                                  title={comment.is_hidden ? t('client_views.community.show_comment', 'Exibir comentário') : t('client_views.community.hide_comment', 'Ocultar comentário')}
                                                  className="p-1 rounded-lg text-neutral-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-90 disabled:opacity-50"
                                                >
                                                  {comment.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                  onClick={() => handleAdminDeleteComment(post.id, comment.id)}
                                                  disabled={processingAdminAction[`comment_delete_${comment.id}`]}
                                                  title={t('client_views.community.delete_comment', 'Excluir comentário')}
                                                  className="p-1 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90 disabled:opacity-50"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-normal whitespace-pre-wrap">
                                          {comment.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* Create Comment Input */}
                            {currentUser && (
                              <div className="flex gap-3 items-center pt-2">
                                <input 
                                  type="text" 
                                  placeholder={t('client_views.community.comment_placeholder', 'Escreva um comentário...')}
                                  value={newCommentText}
                                  onChange={(e) => setNewCommentText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                                  className="flex-1 h-9 px-4 bg-neutral-50 dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-750 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-900 dark:text-white placeholder:text-neutral-400"
                                />
                                <button 
                                  onClick={() => handleSubmitComment(post.id)}
                                  disabled={isSubmittingComment || !newCommentText.trim()}
                                  className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded-xl flex items-center justify-center transition-all shrink-0"
                                >
                                  {isSubmittingComment ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="chat-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col h-[680px] overflow-hidden transition-colors"
              >
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setActiveSubTab('feed')
                        setActiveConnection(null)
                        setActiveRoomId(null)
                      }}
                      className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    {activeConnection && (
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={activeConnection.user.avatar} alt={activeConnection.user.name} className="w-10 h-10 rounded-full object-cover border" />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-neutral-900 rounded-full"></span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2 leading-tight">
                            {activeConnection.user.name}
                            <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase rounded">
                              {activeConnection.user.role}
                            </span>
                          </h4>
                          <span className="text-[10px] text-neutral-400">{t('client_views.community.active_now', 'Ativo agora')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/30 dark:bg-neutral-950/20">
                  {isLoadingMessages ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                      <span className="text-xs text-neutral-400 font-semibold">{t('client_views.community.loading_chat', 'Carregando conversa...')}</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-75">
                      <MessageSquare className="w-12 h-12 text-neutral-350 dark:text-neutral-700 mb-3" />
                      <h4 className="font-bold text-sm text-neutral-500">{t('client_views.community.start_chat_title', 'Inicie a conversa')}</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-[280px]">{t('client_views.community.start_chat_desc', 'As mensagens enviadas aqui são criptografadas e privadas entre vocês.')}</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.sender_id === currentUser?.id
                      return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                            isMe 
                              ? "bg-indigo-600 text-white rounded-br-none" 
                              : "bg-white dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 rounded-bl-none border border-neutral-100 dark:border-neutral-805"
                          )}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <span className={cn(
                              "text-[9px] block text-right mt-1 font-semibold",
                              isMe ? "text-indigo-200" : "text-neutral-400"
                            )}>
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Panel */}
                <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
                  <div className="flex gap-3 items-center">
                    <button className="p-2.5 text-neutral-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    
                    <textarea 
                      placeholder={t('client_views.community.chat_placeholder', 'Escreva sua mensagem...')}
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      rows={1}
                      className="flex-1 bg-white dark:bg-neutral-850 border border-neutral-250 dark:border-neutral-750 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-900 dark:text-white placeholder:text-neutral-400"
                    />

                    <button 
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !newMessageText.trim()}
                      className="h-10 w-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-350 dark:disabled:bg-neutral-800 text-white rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-md shadow-indigo-500/10"
                    >
                      {isSendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Right Sidebar: Connections */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 transition-colors">
            
            {/* Connection Requests (Pending Incoming) */}
            {pendingIncoming.length > 0 && (
              <div className="mb-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="font-black text-xs uppercase tracking-widest text-amber-500 mb-4 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  {t('client_views.community.connection_requests', 'Solicitações de Conexão ({count})').replace('{count}', String(pendingIncoming.length))}
                </h3>
                <div className="space-y-3">
                  {pendingIncoming.map(conn => (
                    <div key={conn.id} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <img src={conn.user.avatar} alt={conn.user.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <h4 className="font-bold text-xs text-neutral-900 dark:text-white">{conn.user.name}</h4>
                          <span className="text-[9px] font-bold text-neutral-400 uppercase">{conn.user.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleConnectionAction('accept', conn.id)}
                          disabled={isProcessingConnection[conn.id]}
                          className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                          title={t('client_views.community.accept', 'Aceitar')}
                        >
                          {isProcessingConnection[conn.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button 
                          onClick={() => handleConnectionAction('reject', conn.id)}
                          disabled={isProcessingConnection[conn.id]}
                          className="p-1 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 rounded-lg transition-colors"
                          title={t('client_views.community.reject', 'Recusar')}
                        >
                          {isProcessingConnection[conn.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Connections List */}
            <h3 className="font-black text-xs uppercase tracking-widest text-neutral-400 mb-6 flex items-center justify-between">
              <span>{t('client_views.community.my_connections', 'Minhas Conexões')}</span>
              <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-bold normal-case text-neutral-500">
                {activeConnections.length} {t('client_views.community.connections_count', 'conexões')}
              </span>
            </h3>
            
            {isLoadingConnections ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : activeConnections.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-4 italic">{t('client_views.community.empty_connections', 'Nenhuma conexão ativa. Conecte-se abaixo!')}</p>
            ) : (
              <div className="space-y-3">
                {activeConnections.map(conn => (
                  <div 
                    key={conn.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
                      activeConnection?.id === conn.id && "bg-indigo-50/50 dark:bg-indigo-950/20 border-l-2 border-indigo-500 rounded-l-none"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={conn.user.avatar} alt={conn.user.name} className="w-10 h-10 rounded-full object-cover" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">{conn.user.name}</h4>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">{conn.user.role}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenChat(conn)}
                        className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                        title={t('client_views.community.send_dm_tooltip', 'Enviar Mensagem Privada')}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      
                      <button 
                        onClick={() => handleConnectionAction('remove', conn.id)}
                        disabled={isProcessingConnection[conn.id]}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title={t('client_views.community.disconnect_tooltip', 'Desconectar')}
                      >
                        {isProcessingConnection[conn.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions & Discover */}
            <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="font-black text-xs uppercase tracking-widest text-neutral-400 mb-4">{t('client_views.community.suggestions_title', 'Sugestões (Descobrir)')}</h3>
              
              {isLoadingConnections ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-2 italic">{t('client_views.community.empty_suggestions', 'Nenhuma sugestão disponível no momento.')}</p>
              ) : (
                <div className="space-y-3">
                  {suggestions.map(sugg => {
                    const isPendingSent = pendingOutgoing.some(o => o.user.id === sugg.id)
                    return (
                      <div key={sugg.id} className="flex items-center justify-between p-3 border border-neutral-100 dark:border-neutral-800 rounded-2xl hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-all">
                        <div className="flex items-center gap-3">
                          <img src={sugg.avatar} alt={sugg.name} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <h4 className="font-bold text-xs text-neutral-900 dark:text-white leading-tight">{sugg.name}</h4>
                            <span className="text-[9px] text-neutral-400 uppercase">{sugg.role}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleConnectionAction('send', sugg.id)}
                          disabled={isProcessingConnection[sugg.id] || isPendingSent}
                          className={cn(
                            "p-2 rounded-lg transition-colors shrink-0",
                            isPendingSent 
                              ? "text-neutral-405 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold" 
                              : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50"
                          )}
                          title={isPendingSent ? t('client_views.community.pending_tooltip', 'Solicitação Pendente') : t('client_views.community.send_connection_tooltip', 'Enviar solicitação de conexão')}
                        >
                          {isProcessingConnection[sugg.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isPendingSent ? (
                            <span className="text-[10px]">{t('client_views.community.pending', 'Pendente')}</span>
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
        title={confirmModal.title}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {confirmModal.message}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              {t('client_views.community.cancel', 'Cancelar')}
            </button>
            <button
              type="button"
              onClick={confirmModal.onConfirm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
            >
              {t('client_views.community.confirm', 'Confirmar')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
