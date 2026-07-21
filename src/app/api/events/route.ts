import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { getDateRange } from '@/lib/utils'
import type { DateFilter } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const supabase = await createClient()

  let query = supabase
    .from('events')
    .select('*')
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(60)

  const categories = (searchParams.get('categories') ?? '').split(',').filter(Boolean)
  if (categories.length) {
    query = query.overlaps('categories', categories)
  }

  if (searchParams.get('free') === 'true') {
    query = query.eq('is_free', true)
  }

  const search = searchParams.get('search')
  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const date = searchParams.get('date') as DateFilter | null
  if (date && date !== 'all') {
    const { from, to } = getDateRange(date)
    query = query.gte('start_datetime', from.toISOString()).lt('start_datetime', to.toISOString())
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data })
}
