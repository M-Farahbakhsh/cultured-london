import type { Friendship, SimilarProfile } from '@/lib/types'
import { UserCircle, Users } from 'lucide-react'

interface FriendCardProps {
  friendship: Friendship
  onAccept?: () => void
  onDecline?: () => void
  currentUserId: string
}

export function FriendCard({ friendship, onAccept, onDecline, currentUserId }: FriendCardProps) {
  const profile = friendship.profile
  const isPending = friendship.status === 'pending'
  const isIncoming = isPending && friendship.addressee_id === currentUserId

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-bg rounded-full flex items-center justify-center shrink-0">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
          : <UserCircle size={24} className="text-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">
          {profile?.full_name || profile?.username}
        </p>
        <p className="text-xs text-muted">@{profile?.username}</p>
        {friendship.shared_interest_count !== undefined && (
          <p className="text-xs text-accent mt-0.5 flex items-center gap-1">
            <Users size={11} />
            {friendship.shared_interest_count} shared interests
          </p>
        )}
      </div>
      {isIncoming && (
        <div className="flex gap-2">
          <button onClick={onAccept} className="btn-primary text-xs py-1.5 px-3">Accept</button>
          <button onClick={onDecline} className="btn-secondary text-xs py-1.5 px-3">Decline</button>
        </div>
      )}
      {isPending && !isIncoming && (
        <span className="text-xs text-muted bg-bg border border-border px-2.5 py-1 rounded-full">
          Pending
        </span>
      )}
    </div>
  )
}

interface SimilarCardProps {
  profile: SimilarProfile
  onRequest: (userId: string) => void
  alreadySent: boolean
}

export function SimilarProfileCard({ profile, onRequest, alreadySent }: SimilarCardProps) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-bg rounded-full flex items-center justify-center shrink-0">
        {profile.avatar_url
          ? <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
          : <UserCircle size={24} className="text-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{profile.full_name || profile.username}</p>
        <p className="text-xs text-muted">@{profile.username}</p>
        {profile.shared_interests.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {profile.shared_interests.slice(0, 4).map(i => (
              <span key={i} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{i}</span>
            ))}
            {profile.shared_interests.length > 4 && (
              <span className="text-xs text-muted">+{profile.shared_interests.length - 4} more</span>
            )}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-accent">
          {Math.round(profile.overlap_score * 100)}%
        </p>
        <p className="text-xs text-muted">match</p>
        <button
          onClick={() => onRequest(profile.id)}
          disabled={alreadySent}
          className="btn-primary text-xs py-1 px-2.5 mt-1.5 disabled:opacity-50"
        >
          {alreadySent ? 'Sent' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
