import { redirect } from 'next/navigation'
import { currentSlot } from '@/lib/sessions/currentSlot'
import { claimSlot } from '@/lib/sessions/slotService'
import { safeNext } from '@/lib/sessions/slotCore'
import { ActiveSessionChooser } from '@/components/auth/ActiveSessionChooser'
import { maskEmail } from '../../../../supabase/functions/_shared/partnerCommission'

export const dynamic = 'force-dynamic'

/**
 * Depois de autenticar (senha, Google ou passkey), se a vaga de IDE ou de navegador já está em uso em outro dispositivo,
 * o usuário escolhe: ficar lá (sai daqui) ou encerrar a outra sessão e entrar aqui.
 */
export default async function ActiveSessionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next)

  const slot = await currentSlot()
  if (!slot) redirect('/login')

  const result = await claimSlot(slot.input)
  // Livre, desligado ou erro nosso: segue para o destino. Encerrada: o portão do proxy trata (limpa o login e avisa).
  if (!result || result.status !== 'occupied' || !result.other) redirect(target)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-200 p-6 text-neutral-900 transition-colors duration-300 dark:from-neutral-900 dark:to-black dark:text-white">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="rounded-[2.5rem] border border-neutral-200 bg-white/80 p-8 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/50">
          <ActiveSessionChooser other={result.other} kind={slot.input.kind} email={maskEmail(slot.user.email)} next={target} />
        </div>
      </div>
    </main>
  )
}
