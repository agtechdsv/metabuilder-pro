/** Linguagens/stacks do Eject & Sync que aceitam "Quero ser avisado" (public.stack_interest.stack) */
export const STACK_INTEREST_STACKS = [
  { id: 'nodejs', label: 'Node.js', icon: '🟢' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'csharp', label: 'C#', icon: '💜' },
  { id: 'nestjs', label: 'NestJS', icon: '🦅' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'php', label: 'PHP', icon: '🐘' },
  { id: 'go', label: 'Go', icon: '🐹' },
  { id: 'rails', label: 'Rails', icon: '💎' },
] as const

export type StackInterestId = typeof STACK_INTEREST_STACKS[number]['id']

export interface StackInterestSummaryRow { stack: string; total: number }

export interface StackInterestUser {
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface StackMessageResult {
  userId: string
  name: string
  email: { ok: boolean; error?: string }
  chat: { ok: boolean; error?: string }
}
