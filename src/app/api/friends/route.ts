import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('friendships')
    .select('*, requester:profiles!requester_id(id,username,full_name,avatar_url), addressee:profiles!addressee_id(id,username,full_name,avatar_url)')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const enriched = (data ?? []).map(f => ({
    ...f,
    profile: f.requester_id === user.id ? f.addressee : f.requester,
  }))

  return NextResponse.json({ friendships: enriched })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addressee_id } = await request.json()
  const { data, error } = await supabase.from('friendships')
    .insert({ requester_id: user.id, addressee_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ friendship: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await request.json()
  const { data, error } = await supabase.from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .match({ id, addressee_id: user.id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ friendship: data })
}
