'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Image as ImageIcon, Heart, MessageCircle, UserPlus, Check, X, Ban, MoreHorizontal, MessageSquare, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock Data
const MOCK_POSTS = [
  {
    id: '1',
    user: { name: 'João Silva', role: 'DEV', avatar: 'https://i.pravatar.cc/150?u=1' },
    content: 'Acabei de implementar a nova API de relatórios! Ficou super rápida. Alguém mais testou?',
    likes: 12,
    comments: 3,
    timeAgo: '2h',
  },
  {
    id: '2',
    user: { name: 'Maria Souza', role: 'OWNER', avatar: 'https://i.pravatar.cc/150?u=2' },
    content: 'Pessoal, qual estratégia vocês estão usando para engajar mais usuários na plataforma de vocês?',
    likes: 34,
    comments: 15,
    timeAgo: '5h',
  }
]

const MOCK_CONNECTIONS = [
  { id: '3', name: 'Carlos Santos', role: 'DEV', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Ana Oliveira', role: 'OWNER', avatar: 'https://i.pravatar.cc/150?u=4' },
]

export default function CommunityHubView({ hideHeader = false }: { hideHeader?: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'chat'>('feed')
  const [newPost, setNewPost] = useState('')

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      
      {/* Header Banner */}
      {!hideHeader && (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-md">
                  Networking & Hub
                </span>
              </div>
              
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/client/community/popout', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no')
                  }
                }}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 group"
                title="Abrir em Nova Janela (Modo Foco)"
              >
                <span className="hidden md:inline text-xs font-bold uppercase tracking-widest group-hover:text-white">Modo Foco</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-3xl font-black mb-2">Comunidade PRO</h2>
            <p className="text-indigo-100 max-w-2xl">
              Conecte-se com outros Owners e Desenvolvedores. Compartilhe insights, peça ajuda, ou faça networking.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Feed Column */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Create Post Input */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                EU
              </div>
              <div className="flex-1 space-y-4">
                <textarea 
                  placeholder="O que você quer compartilhar com a comunidade?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[80px] text-neutral-900 dark:text-white placeholder:text-neutral-400 text-lg"
                />
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <button className="p-2 text-neutral-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2">
                    <span>Publicar</span>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feed Posts */}
          <div className="space-y-4">
            {MOCK_POSTS.map(post => (
              <div key={post.id} className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full" />
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        {post.user.name}
                        <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-black uppercase text-neutral-500 rounded-full">
                          {post.user.role}
                        </span>
                      </h4>
                      <span className="text-xs text-neutral-400">{post.timeAgo}</span>
                    </div>
                  </div>
                  <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-neutral-700 dark:text-neutral-300 mb-6 text-[15px] leading-relaxed">
                  {post.content}
                </p>
                
                <div className="flex items-center gap-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <button className="flex items-center gap-2 text-neutral-500 hover:text-rose-500 transition-colors group">
                    <div className="p-2 rounded-full group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20">
                      <Heart className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-2 text-neutral-500 hover:text-indigo-500 transition-colors group">
                    <div className="p-2 rounded-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm">{post.comments}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Sidebar: Connections */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-200 dark:border-neutral-800">
            <h3 className="font-black text-sm uppercase tracking-widest text-neutral-500 mb-6">Minhas Conexões</h3>
            
            <div className="space-y-4">
              {MOCK_CONNECTIONS.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={conn.avatar} alt={conn.name} className="w-10 h-10 rounded-full" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">{conn.name}</h4>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">{conn.role}</span>
                    </div>
                  </div>
                  <button className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="font-black text-xs uppercase tracking-widest text-neutral-400 mb-4">Sugestões (Descobrir)</h3>
              <div className="flex items-center justify-between p-3 border border-neutral-100 dark:border-neutral-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-bold">
                    PL
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-neutral-900 dark:text-white">Pedro Lucas</h4>
                    <span className="text-[9px] text-neutral-400 uppercase">DEV</span>
                  </div>
                </div>
                <button className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
