import { useState, useEffect, useRef } from 'react'
import { getPosts, createPost, toggleLikePost, getComments, createComment } from '@/app/actions/community'

export function useCommunityFeed(supabase: any, isSimulator: boolean, currentUser: any) {
  const [posts, setPosts] = useState<any[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [newPostContent, setNewPostContent] = useState('')
  const [postImageFile, setPostImageFile] = useState<File | null>(null)
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLiking, setIsLiking] = useState<Record<string, boolean>>({})

  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null)
  const [commentsForPost, setCommentsForPost] = useState<Record<string, any[]>>({})
  const [isLoadingComments, setIsLoadingComments] = useState<Record<string, boolean>>({})
  const [newCommentText, setNewCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const openCommentsPostIdRef = useRef<string | null>(null)
  const commentsForPostRef = useRef<Record<string, any[]>>({})

  useEffect(() => {
    openCommentsPostIdRef.current = openCommentsPostId
  }, [openCommentsPostId])

  useEffect(() => {
    commentsForPostRef.current = commentsForPost
  }, [commentsForPost])

  const fetchPosts = async (silent = false) => {
    if (!silent) setIsLoadingPosts(true)
    try {
      const result = await getPosts()
      if (result.success && result.posts) {
        setPosts(result.posts)
      }
    } catch (err) {
      console.error("COMMUNITY_DEBUG [fetchPosts exception]:", err)
    }
    setIsLoadingPosts(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    if (isSimulator) return

    const postsChannel = supabase
      .channel('community_posts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        fetchPosts(true)
      })
      .subscribe()

    const likesChannel = supabase
      .channel('community_post_likes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_post_likes' }, () => {
        fetchPosts(true)
      })
      .subscribe()

    const commentsChannel = supabase
      .channel('community_comments_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, (payload: any) => {
        fetchPosts(true)
        const activePostId = openCommentsPostIdRef.current
        if (activePostId) {
          const changedPostId = payload.new?.post_id
          const deletedCommentId = payload.old?.id
          const isRelatedToActivePost = 
            (changedPostId && changedPostId === activePostId) || 
            (deletedCommentId && commentsForPostRef.current[activePostId]?.some((c: any) => c.id === deletedCommentId))

          if (isRelatedToActivePost) {
            getComments(activePostId).then(result => {
              if (result.success && result.comments) {
                setCommentsForPost(prev => ({ ...prev, [activePostId]: result.comments }))
              }
            })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(postsChannel)
      supabase.removeChannel(likesChannel)
      supabase.removeChannel(commentsChannel)
    }
  }, [isSimulator, supabase])

  const uploadPostImage = async (file: File): Promise<string | null> => {
    if (!currentUser) return null
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `post-${currentUser.id}-${Date.now()}.${fileExt}`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('community')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('community')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (err) {
      console.error('Image upload failed:', err)
      return null
    }
  }

  const handlePublishPost = async () => {
    if (!newPostContent.trim() && !postImageFile) return
    setIsPublishing(true)

    if (isSimulator) {
      setTimeout(() => {
        const newMockPost = {
          id: `mock-post-${Date.now()}`,
          content: newPostContent,
          image_url: postImagePreview || '',
          created_at: new Date().toISOString(),
          likesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          user: {
            id: currentUser?.id || 'mock-user-id',
            name: currentUser?.user_metadata?.full_name || 'Alexandre Silva',
            avatar: currentUser?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            role: 'DEV'
          }
        }
        setPosts(prev => [newMockPost, ...prev])
        setNewPostContent('')
        setPostImageFile(null)
        setPostImagePreview(null)
        setIsPublishing(false)
      }, 1000)
      return
    }

    try {
      let imageUrl = ''
      if (postImageFile) {
        const uploadedUrl = await uploadPostImage(postImageFile)
        if (uploadedUrl) imageUrl = uploadedUrl
      }

      const result = await createPost(newPostContent, imageUrl)
      if (result.success) {
        setNewPostContent('')
        setPostImageFile(null)
        setPostImagePreview(null)
        fetchPosts(true)
      } else {
        console.error('Erro ao publicar:', result.error)
      }
    } catch (err: any) {
      console.error('Erro inesperado:', err.message)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleLikePost = async (postId: string) => {
    if (!currentUser) return
    setIsLiking(prev => ({ ...prev, [postId]: true }))
    
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likedByMe: !p.likedByMe,
          likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1
        }
      }
      return p
    }))

    if (isSimulator) {
      setIsLiking(prev => ({ ...prev, [postId]: false }))
      return
    }

    const result = await toggleLikePost(postId)
    if (!result.success) {
      fetchPosts(true)
    }
    
    setIsLiking(prev => ({ ...prev, [postId]: false }))
  }

  const handleToggleComments = async (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null)
      return
    }

    setOpenCommentsPostId(postId)
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }))
    
    const result = await getComments(postId)
    if (result.success && result.comments) {
      setCommentsForPost(prev => ({ ...prev, [postId]: result.comments }))
    }

    setIsLoadingComments(prev => ({ ...prev, [postId]: false }))
  }

  const handleSubmitComment = async (postId: string) => {
    if (!newCommentText.trim()) return
    setIsSubmittingComment(true)

    if (isSimulator) {
      setTimeout(() => {
        const newMockComment = {
          id: `mock-comment-${Date.now()}`,
          post_id: postId,
          content: newCommentText,
          created_at: new Date().toISOString(),
          is_hidden: false,
          user: {
            id: currentUser?.id || 'mock-user-id',
            name: currentUser?.user_metadata?.full_name || 'Alexandre Silva',
            avatar: currentUser?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            role: 'DEV',
            is_blocked_community: false
          }
        }
        setCommentsForPost(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newMockComment]
        }))
        setNewCommentText('')
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, commentsCount: p.commentsCount + 1 }
          }
          return p
        }))
        setIsSubmittingComment(false)
      }, 800)
      return
    }

    const result = await createComment(postId, newCommentText)
    if (result.success) {
      setNewCommentText('')
      const commentRes = await getComments(postId)
      if (commentRes.success && commentRes.comments) {
        setCommentsForPost(prev => ({ ...prev, [postId]: commentRes.comments }))
      }
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, commentsCount: p.commentsCount + 1 }
        }
        return p
      }))
    } else {
      alert('Erro ao enviar comentário: ' + result.error)
    }
    setIsSubmittingComment(false)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPostImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setPostImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handlePostPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          setPostImageFile(file)
          const reader = new FileReader()
          reader.onloadend = () => setPostImagePreview(reader.result as string)
          reader.readAsDataURL(file)
        }
        break
      }
    }
  }

  return {
    posts, setPosts, isLoadingPosts,
    newPostContent, setNewPostContent,
    postImageFile, setPostImageFile,
    postImagePreview, setPostImagePreview,
    isPublishing, isLiking,
    openCommentsPostId, setOpenCommentsPostId,
    commentsForPost, setCommentsForPost,
    isLoadingComments,
    newCommentText, setNewCommentText,
    isSubmittingComment,
    fetchPosts, handlePublishPost, handleLikePost,
    handleToggleComments, handleSubmitComment,
    handleImageChange, handlePostPaste
  }
}
