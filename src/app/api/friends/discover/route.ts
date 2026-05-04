import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { jaccardSimilarity } from '@/lib/utils'
import type { SimilarProfile } from '@/lib/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get current user's interests
  const { data: myInterests } = await supabase
    .from('interests').select('name').eq('user_id', user.id)
  const myNames = (myInterests ?? []).map(i => i.name)

  if (myNames.length === 0) {
    return NextResponse.json({ profiles: [] })
  }

  // Get existing connections to exclude them
  const { data: connections } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
  const connectedIds = new Set(
    (connections ?? []).flatMap(c => [c.requester_id, c.addressee_id]).filter(id => id !== user.id)
  )

  // Get all public profiles except self and connected users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .neq('id', user.id)
    .limit(100)

  if (!profiles?.length) return NextResponse.json({ profiles: [] })

  const candidates = profiles.filter(p => !connectedIds.has(p.id))

  // Get interests for all candidates in one query
  const candidateIds = candidates.map(p => p.id)
  const { data: allInterests } = await supabase
    .from('interests')
    .select('user_id, name')
    .in('user_id', candidateIds)

  const interestsByUser = (allInterests ?? []).reduce<Record<string, string[]>>((acc, i) => {
    if (!acc[i.user_id]) acc[i.user_id] = []
    acc[i.user_id].push(i.name)
    return acc
  }, {})

  const scored: SimilarProfile[] = candidates
    .map(p => {
      const theirNames = interestsByUser[p.id] ?? []
      const shared = myNames.filter(n =>
        theirNames.some(t => t.toLowerCase() === n.toLowerCase())
      )
      const score = jaccardSimilarity(myNames, theirNames)
      return { ...p, shared_interests: shared, overlap_score: score }
    })
    .filter(p => p.overlap_score > 0)
    .sort((a, b) => b.overlap_score - a.overlap_score)
    .slice(0, 20)

  return NextResponse.json({ profiles: scored })
}
