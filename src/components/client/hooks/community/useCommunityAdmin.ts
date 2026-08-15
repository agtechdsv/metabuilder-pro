import { useState } from 'react'
import { toggleCommunityPostHide, deleteCommunityPostAdmin, toggleCommunityCommentHide, deleteCommunityCommentAdmin, toggleUserCommunityBlock } from '@/app/actions/admin'
import { useI18n } from '@/i18n'

export function useCommunityAdmin(isSimulator: boolean, fetchPosts: any, fetchConnectionsData: any, setPosts: any, setCommentsForPost: any, setConnections: any, openCommentsPostId: string | null, setOpenCommentsPostId: any) {
  const { t } = useI18n()
  const [processingAdminAction, setProcessingAdminAction] = useState<Record<string, boolean>>({})
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  })

  const handleAdminTogglePostHide = async (postId: string, isHidden: boolean) => {
    setProcessingAdminAction(prev => ({ ...prev, [`post_hide_${postId}`]: true }))

    if (isSimulator) {
      setPosts((prev: any[]) => prev.map(p => p.id === postId ? { ...p, is_hidden: !isHidden } : p))
      setProcessingAdminAction(prev => ({ ...prev, [`post_hide_${postId}`]: false }))
      return
    }

    const res = await toggleCommunityPostHide(postId, !isHidden)
    if (res.success) fetchPosts(true)
    setProcessingAdminAction(prev => ({ ...prev, [`post_hide_${postId}`]: false }))
  }

  const handleAdminDeletePost = (postId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('client_views.community.admin_delete_post_title', 'Excluir Publicação'),
      message: t('client_views.community.admin_delete_post_msg', 'Tem certeza de que deseja EXCLUIR permanentemente esta publicação?'),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setProcessingAdminAction(prev => ({ ...prev, [`post_delete_${postId}`]: true }))

        if (isSimulator) {
          setPosts((prev: any[]) => prev.filter(p => p.id !== postId))
          if (openCommentsPostId === postId) setOpenCommentsPostId(null)
          setProcessingAdminAction(prev => ({ ...prev, [`post_delete_${postId}`]: false }))
          return
        }

        const res = await deleteCommunityPostAdmin(postId)
        if (res.success) {
          fetchPosts(true)
          if (openCommentsPostId === postId) setOpenCommentsPostId(null)
        }
        setProcessingAdminAction(prev => ({ ...prev, [`post_delete_${postId}`]: false }))
      }
    })
  }

  const handleAdminToggleCommentHide = async (postId: string, commentId: string, isHidden: boolean) => {
    setProcessingAdminAction(prev => ({ ...prev, [`comment_hide_${commentId}`]: true }))

    if (isSimulator) {
      setCommentsForPost((prev: any) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) => c.id === commentId ? { ...c, is_hidden: !isHidden } : c)
      }))
      setProcessingAdminAction(prev => ({ ...prev, [`comment_hide_${commentId}`]: false }))
      return
    }

    const res = await toggleCommunityCommentHide(commentId, !isHidden)
    if (res.success) {
      fetchPosts(true)
      // Note: Full reload is triggered via realtime in the feed hook
    }
    setProcessingAdminAction(prev => ({ ...prev, [`comment_hide_${commentId}`]: false }))
  }

  const handleAdminDeleteComment = (postId: string, commentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('client_views.community.admin_delete_comment_title', 'Excluir Comentário'),
      message: t('client_views.community.admin_delete_comment_msg', 'Tem certeza de que deseja EXCLUIR permanentemente este comentário?'),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setProcessingAdminAction(prev => ({ ...prev, [`comment_delete_${commentId}`]: true }))

        if (isSimulator) {
          setCommentsForPost((prev: any) => ({ ...prev, [postId]: (prev[postId] || []).filter((c: any) => c.id !== commentId) }))
          setPosts((prev: any[]) => prev.map(p => p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p))
          setProcessingAdminAction(prev => ({ ...prev, [`comment_delete_${commentId}`]: false }))
          return
        }

        const res = await deleteCommunityCommentAdmin(commentId)
        if (res.success) fetchPosts(true)
        setProcessingAdminAction(prev => ({ ...prev, [`comment_delete_${commentId}`]: false }))
      }
    })
  }

  const handleAdminToggleUserBlock = (userId: string, isBlocked: boolean) => {
    const actionText = isBlocked ? t('client_views.community.unblock', 'Desbloquear') : t('client_views.community.block', 'Bloquear')
    setConfirmModal({
      isOpen: true,
      title: `${actionText} ${t('client_views.community.user', 'Usuário')}`,
      message: isBlocked ? t('client_views.community.unblock_user_msg', 'Desbloquear este usuário na Comunidade?') : t('client_views.community.block_user_msg', 'Bloquear este usuário da Comunidade?'),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setProcessingAdminAction(prev => ({ ...prev, [`user_block_${userId}`]: true }))

        if (isSimulator) {
          setPosts((prev: any[]) => prev.map(p => p.user.id === userId ? { ...p, user: { ...p.user, is_blocked_community: !isBlocked } } : p))
          setCommentsForPost((prev: any) => {
            const copy = { ...prev }
            Object.keys(copy).forEach(postId => {
              copy[postId] = copy[postId].map((c: any) => c.user.id === userId ? { ...c, user: { ...c.user, is_blocked_community: !isBlocked } } : c)
            })
            return copy
          })
          setConnections((prev: any[]) => prev.map(c => c.user.id === userId ? { ...c, user: { ...c.user, is_blocked_community: !isBlocked } } : c))
          setProcessingAdminAction(prev => ({ ...prev, [`user_block_${userId}`]: false }))
          return
        }

        const res = await toggleUserCommunityBlock(userId, !isBlocked)
        if (res.success) {
          fetchPosts(true)
          fetchConnectionsData(true)
        }
        setProcessingAdminAction(prev => ({ ...prev, [`user_block_${userId}`]: false }))
      }
    })
  }

  return {
    processingAdminAction,
    confirmModal, setConfirmModal,
    handleAdminTogglePostHide,
    handleAdminDeletePost,
    handleAdminToggleCommentHide,
    handleAdminDeleteComment,
    handleAdminToggleUserBlock
  }
}
