import { createClient } from '@/utils/supabase/server'
import { BpmLandingClient } from '@/app/bpm/BpmLandingClient'

export default async function BpmLanding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return <BpmLandingClient user={user} profile={profile} />
}
