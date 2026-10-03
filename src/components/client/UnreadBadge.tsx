import React from 'react'

/** Bolinha com a quantidade de itens não lidos (não renderiza nada quando é zero) */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center leading-none"
      title={`${count} ${count === 1 ? 'mensagem nova' : 'mensagens novas'}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
