'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

interface DynamicIconProps extends LucideProps {
  icon: any
  className?: string
}

export function DynamicIcon({ icon, className, ...props }: DynamicIconProps) {
  if (!icon) return <LucideIcons.HelpCircle className={className} {...props} />

  // Se o ícone não for uma string (pode ser um JSX/Elemento React), renderiza direto
  if (typeof icon !== 'string') {
    return <>{icon}</>
  }

  // Verifica se é um SVG bruto
  if (icon.trim().startsWith('<svg')) {
    return (
      <div 
        className={className}
        dangerouslySetInnerHTML={{ __html: icon }}
        style={{ width: props.size || '1em', height: props.size || '1em' }}
      />
    )
  }

  // Caso contrário, trata como um nome de ícone do Lucide
  const IconComponent = (LucideIcons as any)[icon] || LucideIcons.HelpCircle
  return <IconComponent className={className} {...props} />
}
