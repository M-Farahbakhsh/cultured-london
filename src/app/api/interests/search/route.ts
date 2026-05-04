import { NextResponse, type NextRequest } from 'next/server'

// Static topic suggestions for autocomplete
const TOPIC_SUGGESTIONS = [
  'Artificial Intelligence', 'Machine Learning', 'AI Safety', 'AI Ethics',
  'Quantum Physics', 'Dark Matter', 'Cosmology', 'Neuroscience',
  'Consciousness', 'Philosophy of Mind', 'Phenomenology',
  'Climate Change', 'Ecology', 'Rewilding', 'Deep Ecology',
  'Mycology', 'Plant Intelligence', 'Biomimicry',
  'Architecture', 'Brutalism', 'Urban Planning',
  'Photography', 'Generative Art', 'Digital Art', 'Street Art',
  'Jazz', 'Ambient Music', 'Electronic Music', 'Classical Music', 'Experimental Music',
  'Science Fiction', 'Speculative Fiction', 'Afrofuturism',
  'Postcolonialism', 'Feminism', 'Critical Theory',
  'Psychoanalysis', 'Jungian Psychology',
  'Mythology', 'Folklore', 'Anthropology',
  'Cognitive Science', 'Linguistics', 'Semiotics',
  'Data Visualisation', 'Information Design',
  'Blockchain', 'Cryptography', 'Open Source',
  'Biohacking', 'Synthetic Biology',
  'Documentary Film', 'Experimental Film', 'Film Theory',
  'Theatre of the Absurd', 'Physical Theatre', 'Immersive Theatre',
  'Poetry', 'Essay Writing', 'Literary Fiction',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const q = searchParams.get('q') ?? ''

  if (q.length < 2) return NextResponse.json({ results: [] })

  try {
    if (type === 'artist') {
      const res = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(q)}&limit=8&fmt=json`,
        { headers: { 'User-Agent': 'CulturedLondon/0.1 (contact@culturedlondon.app)' } }
      )
      const data = await res.json()
      const results = (data.artists ?? []).map((a: { id: string; name: string; disambiguation?: string; country?: string }) => ({
        id: a.id,
        name: a.name,
        description: [a.disambiguation, a.country].filter(Boolean).join(' · '),
      }))
      return NextResponse.json({ results })
    }

    if (type === 'author') {
      const res = await fetch(
        `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=8`
      )
      const data = await res.json()
      const results = (data.docs ?? []).map((a: { key: string; name: string; birth_date?: string; top_work?: string }) => ({
        id: a.key,
        name: a.name,
        description: [a.birth_date, a.top_work].filter(Boolean).join(' · '),
      }))
      return NextResponse.json({ results })
    }

    if (type === 'person') {
      // Search Wikidata for notable people
      const sparql = `
        SELECT ?item ?itemLabel ?description WHERE {
          ?item wikibase:sitelinks ?sitelinks.
          ?item schema:description ?description.
          FILTER(LANG(?description) = "en")
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
          BIND(STR(?item) AS ?itemStr)
        }
        LIMIT 0
      `
      // Simplified: use the Wikidata search API instead
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&type=item&limit=8&format=json&origin=*`
      )
      const data = await res.json()
      const results = (data.search ?? []).map((item: { id: string; label: string; description?: string }) => ({
        id: item.id,
        name: item.label,
        description: item.description,
      }))
      return NextResponse.json({ results })
    }

    if (type === 'topic') {
      const lower = q.toLowerCase()
      const results = TOPIC_SUGGESTIONS
        .filter(t => t.toLowerCase().includes(lower))
        .slice(0, 8)
        .map(t => ({ id: t, name: t, description: undefined }))
      return NextResponse.json({ results })
    }

    // venue and genre: just return simple matches
    return NextResponse.json({ results: [] })

  } catch (err) {
    console.error('Interest search error:', err)
    return NextResponse.json({ results: [] })
  }
}
