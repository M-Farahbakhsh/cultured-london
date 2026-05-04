import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('attended_events')
    .select('*, event:events(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ attended: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id, manual_title, manual_venue, manual_date, enjoyed, notes } = body

  const { data, error } = await supabase.from('attended_events')
    .insert({ user_id: user.id, event_id, manual_title, manual_venue, manual_date, enjoyed, notes })
    .select('*, event:events(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attended: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, enjoyed, notes } = await request.json()
  const { data, error } = await supabase.from('attended_events')
    .update({ enjoyed, notes })
    .match({ id, user_id: user.id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attended: data })
}
