import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event_id, action } = await request.json()

  if (action === 'unsave') {
    await supabase.from('saved_events').delete().match({ user_id: user.id, event_id })
    return NextResponse.json({ saved: false })
  }

  const { error } = await supabase.from('saved_events')
    .upsert({ user_id: user.id, event_id }, { onConflict: 'user_id,event_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: true })
}
