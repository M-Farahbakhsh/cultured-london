'use client'
import { useEffect, useState } from 'react'
import { Users, UserPlus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import { FriendCard, SimilarProfileCard } from '@/components/FriendCard'
import type { Friendship, Profile, SimilarProfile } from '@/lib/types'

type Tab = 'friends' | 'discover' | 'requests'

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Friendship[]>([])
  const [requests, setRequests] = useState<Friendship[]>([])
  const [similar, setSimilar] = useState<SimilarProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; full_name: string }[]>([])
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: fs }, { data: sim }] = await Promise.all([
        supabase.from('friendships')
          .select('*, profile:profiles!addressee_id(*)')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        fetch('/api/friends/discover').then(r => r.json()),
      ])

      const allFriendships: Friendship[] = (fs ?? []).map((f: Friendship & { profile: Profile }) => ({
        ...f,
        profile: f.profile,
      }))

      setFriends(allFriendships.filter(f => f.status === 'accepted'))
      setRequests(allFriendships.filter(f => f.status === 'pending' && f.addressee_id === user.id))
      setSimilar(sim.profiles ?? [])
    }
    load()
  }, [])

  const searchUsers = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', userId!)
      .limit(5)
    setSearchResults(data ?? [])
  }

  const sendRequest = async (addresseeId: string) => {
    if (!userId) return
    await supabase.from('friendships').insert({ requester_id: userId, addressee_id: addresseeId })
    setSentRequests(prev => new Set(Array.from(prev).concat(addresseeId)))
    setSearchResults([])
    setSearchQuery('')
  }

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    await supabase.from('friendships').update({ status }).eq('id', id)
    if (status === 'accepted') {
      const req = requests.find(r => r.id === id)
      if (req) setFriends(prev => [...prev, { ...req, status: 'accepted' }])
    }
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  const TABS: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'friends', label: 'My friends', count: friends.length },
    { id: 'discover', label: 'Discover', count: similar.length },
    { id: 'requests', label: 'Requests', count: requests.length },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="md:pl-56 pb-20 md:pb-8">
        <div className="page-container py-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-ink mb-1">Friends</h1>
          <p className="text-muted text-sm mb-6">Connect with people who share your taste</p>

          {/* Find by username */}
          <div className="card p-4 mb-6">
            <p className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
              <UserPlus size={15} className="text-accent" /> Find someone by username
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value) }}
                placeholder="Search username or name..."
                className="input pl-9"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-bg">
                    <div>
                      <p className="text-sm font-medium text-ink">{u.full_name || u.username}</p>
                      <p className="text-xs text-muted">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => sendRequest(u.id)}
                      disabled={sentRequests.has(u.id)}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                    >
                      {sentRequests.has(u.id) ? 'Sent' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {TABS.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5
                  ${tab === id ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink'}`}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full
                    ${tab === id ? 'bg-accent/10 text-accent' : 'bg-border text-muted'}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'friends' && (
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="text-center py-16">
                  <Users size={36} className="text-border mx-auto mb-3" />
                  <p className="text-muted">No connections yet</p>
                  <p className="text-sm text-muted mt-1">Search above or discover people with similar taste</p>
                </div>
              ) : friends.map(f => (
                <FriendCard key={f.id} friendship={f} currentUserId={userId!} />
              ))}
            </div>
          )}

          {tab === 'discover' && (
            <div className="space-y-3">
              {similar.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted">Add more interests to your profile to discover similar people</p>
                </div>
              ) : similar.map(p => (
                <SimilarProfileCard
                  key={p.id}
                  profile={p}
                  onRequest={sendRequest}
                  alreadySent={sentRequests.has(p.id)}
                />
              ))}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted">No pending requests</p>
                </div>
              ) : requests.map(f => (
                <FriendCard
                  key={f.id}
                  friendship={f}
                  currentUserId={userId!}
                  onAccept={() => respond(f.id, 'accepted')}
                  onDecline={() => respond(f.id, 'declined')}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
