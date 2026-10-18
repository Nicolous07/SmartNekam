import Link from 'next/link'
import { Hash, Lock, Megaphone, Users } from 'lucide-react'

export type RoomCardData = {
  id: string
  kind: string
  name: string
  description: string | null
  member_count: number
  is_member: boolean
  visibility: string
}

const KIND_LABEL: Record<string, string> = {
  lounge: 'Lounge',
  channel: 'Channel',
  group: 'Kikundi',
}

export default function RoomCard({ room, index = 0 }: { room: RoomCardData; index?: number }) {
  const Icon = room.kind === 'lounge' ? Megaphone : room.kind === 'group' ? Users : Hash
  const title = room.kind === 'channel' ? `#${room.name}` : room.name

  return (
    <Link
      href={`/communities/room/${room.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="geometric-card hover-lift anim-fade-up flex items-start gap-3 p-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold text-slate-900 dark:text-slate-100">{title}</span>
          {room.visibility === 'private' && <Lock className="h-3.5 w-3.5 text-slate-400" />}
          {room.is_member && room.kind !== 'lounge' && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Umejiunga
            </span>
          )}
        </span>
        {room.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600 dark:text-slate-400">
            {room.description}
          </span>
        )}
        <span className="mt-1 block text-[11px] font-medium text-slate-400">
          {KIND_LABEL[room.kind] ?? room.kind} · wanachama {room.member_count}
        </span>
      </span>
    </Link>
  )
}
