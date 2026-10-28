'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Check, CircleUserRound, Loader2, MessageCircle, MessageSquareText,
  Search, Send, ShieldCheck, X, Users, Plus, Reply, Pencil, Trash2, Smile, Globe2, UserPlus, Paperclip, Download, FileAudio, Mic, Square, Phone, PhoneOff, PhoneIncoming, Volume2, VolumeX, Settings2, Crown, UserMinus, UserCog, Copy, CheckCircle2, LogOut, ImagePlus, RefreshCw, Play,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDataSaver } from '@/components/data-saver/DataSaverProvider'
import { compressImageForLowData } from '@/lib/compressImageForLowData'

type SearchUser = {
  user_id: string
  full_name: string
  username: string
  avatar_url: string | null
  role: string
  can_message: boolean
}

type InboxItem = {
  conversation_id: string
  conversation_type: 'direct' | 'group' | 'mentor'
  group_visibility: 'public' | 'private' | null
  other_user_id: string | null
  other_full_name: string
  other_username: string | null
  other_avatar_url: string | null
  last_message: string | null
  last_message_at: string
  unread_count: number
  can_message: boolean
}

type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  sender_username: string
  sender_avatar: string | null
  body: string
  attachment_path: string | null
  message_type: string
  reply_to_message_id: string | null
  edited_at: string | null
  created_at: string
  deleted_at?: string | null
}

type Reaction = { message_id: string; user_id: string; reaction: string }
type ChatGroup = { conversation_id: string; title: string; description: string; visibility: 'public' | 'private'; member_count: number; created_by: string; creator_name: string; created_at: string; is_member: boolean }
type GroupMember = { user_id: string; full_name: string; username: string; avatar_url: string | null; participant_role: 'admin' | 'member'; joined_at: string; is_creator: boolean }
type GroupJoinRequest = { id: string; user_id: string; full_name: string; username: string; avatar_url: string | null; requested_at: string }
type GroupManagement = {
  conversation_id: string
  can_manage: boolean
  is_creator: boolean
  settings: {
    title: string
    description: string
    visibility: 'public' | 'private'
    invite_code: string
    icon_path: string | null
    icon_url?: string | null
    send_messages_policy: 'everyone' | 'admins'
    edit_group_info_policy: 'everyone' | 'admins'
    approve_new_members: boolean
    allow_member_adds: boolean
    disappearing_messages_seconds: 86400 | 604800 | 7776000 | null
    lock_disappearing_messages: boolean
    updated_at: string
  }
  members: GroupMember[]
  requests: GroupJoinRequest[]
}
type CallSignal = { type: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject'; from: string; to: string; conversationId: string; callSignalId?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
type IncomingCallAction = { action: 'answer' | 'reject'; conversationId: string; callSignalId?: string; callerId?: string }
type CallStatus = 'idle' | 'incoming' | 'calling' | 'connecting' | 'connected'
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏']

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((piece) => piece[0]?.toUpperCase() ?? '').join('') || 'S'
}

function Avatar({ name, url, size = 'h-11 w-11' }: { name: string; url: string | null; size?: string }) {
  const { lowDataMode } = useDataSaver()
  return <span className={`${size} sn-chat-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-700 font-extrabold text-white`}>
    {url && !lowDataMode ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : initials(name)}
  </span>
}

function clock(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return clock(value)
  return date.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })
}

function resolveIncomingCallNotice(callSignalId?: string | null, conversationId?: string | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('smartnekam:call-resolved', { detail: { callSignalId: callSignalId || undefined, conversationId: conversationId || undefined } }))
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const message = { type: 'SMARTNEKAM_CALL_RESOLVED', callSignalId: callSignalId || undefined, conversationId: conversationId || undefined }
    try { navigator.serviceWorker.controller?.postMessage(message) } catch { /* browser may not have a controlling worker yet */ }
    void navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.active?.postMessage(message)
      registration?.waiting?.postMessage(message)
    }).catch(() => undefined)
  }
}

function clearCallActionFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('callAction')
  url.searchParams.delete('callSignalId')
  url.searchParams.delete('callerId')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export default function DirectMessages() {
  const supabase = useMemo(() => createClient(), [])
  const { lowDataMode } = useDataSaver()
  const [myUserId, setMyUserId] = useState('')
  const [myProfile, setMyProfile] = useState<{ full_name: string; avatar_url: string | null }>({ full_name: 'Wewe', avatar_url: null })
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [revealedChatMedia, setRevealedChatMedia] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStartRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [pendingAudioPreview, setPendingAudioPreview] = useState('')
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const handledCallOfferIdsRef = useRef<Set<string>>(new Set())
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localCallStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const [callChannelReady, setCallChannelReady] = useState(false)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const callStatusRef = useRef<CallStatus>('idle')
  const [callPeerId, setCallPeerId] = useState<string | null>(null)
  const [incomingCallSignal, setIncomingCallSignal] = useState<CallSignal | null>(null)
  const [incomingCallSignalId, setIncomingCallSignalId] = useState<string | null>(null)
  const incomingCallSignalIdRef = useRef<string | null>(null)
  const pendingIncomingCallActionRef = useRef<IncomingCallAction | null>(null)
  const [pendingCallActionRevision, setPendingCallActionRevision] = useState(0)
  const [callMuted, setCallMuted] = useState(false)
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [startingUser, setStartingUser] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [reactionMenuMessageId, setReactionMenuMessageId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [showGroupTools, setShowGroupTools] = useState(false)
  const [groups, setGroups] = useState<ChatGroup[]>([])
  const [groupTitle, setGroupTitle] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupVisibility, setGroupVisibility] = useState<'public' | 'private'>('private')
  const [inviteCode, setInviteCode] = useState('')
  const [groupBusy, setGroupBusy] = useState(false)
  const [groupInviteOpen, setGroupInviteOpen] = useState(false)
  const [groupInviteQuery, setGroupInviteQuery] = useState('')
  const [groupInviteResults, setGroupInviteResults] = useState<SearchUser[]>([])
  const [groupInviteSelected, setGroupInviteSelected] = useState<string[]>([])
  const [groupInviteSearching, setGroupInviteSearching] = useState(false)
  const [groupInviteAdding, setGroupInviteAdding] = useState(false)
  const [groupManagementOpen, setGroupManagementOpen] = useState(false)
  const [groupManagement, setGroupManagement] = useState<GroupManagement | null>(null)
  const [groupActionBusy, setGroupActionBusy] = useState(false)
  const groupIconInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeConversation = inbox.find((item) => item.conversation_id === selectedId) ?? null
  const canSendInActiveConversation = activeConversation?.conversation_type === 'group'
    ? (groupManagement?.settings.send_messages_policy !== 'admins' || groupManagement?.can_manage === true)
    : Boolean(activeConversation?.can_message)

  useEffect(() => {
    const queueAction = (detail: IncomingCallAction) => {
      if (!detail || !['answer', 'reject'].includes(detail.action) || !detail.conversationId) return
      pendingIncomingCallActionRef.current = detail
      setPendingCallActionRevision((revision) => revision + 1)
      setSelectedId(detail.conversationId)
    }

    const params = new URLSearchParams(window.location.search)
    const action = params.get('callAction')
    const conversationId = params.get('conversation')
    if ((action === 'answer' || action === 'reject') && conversationId) {
      queueAction({
        action,
        conversationId,
        callSignalId: params.get('callSignalId') || undefined,
        callerId: params.get('callerId') || undefined,
      })
    }

    const handleCallAction = (event: Event) => {
      const detail = (event as CustomEvent<IncomingCallAction>).detail
      if (detail) queueAction(detail)
    }
    window.addEventListener('smartnekam:incoming-call-action', handleCallAction)
    return () => window.removeEventListener('smartnekam:incoming-call-action', handleCallAction)
  }, [])

  useEffect(() => {
    if (!pendingAttachment?.type.startsWith('audio/')) {
      setPendingAudioPreview('')
      return
    }
    const url = URL.createObjectURL(pendingAttachment)
    setPendingAudioPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingAttachment])

  useEffect(() => {
    if (recorderRef.current?.state === 'recording') {
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
      // Discard a recording when the conversation changes; never attach it to another chat.
      recorderRef.current.onstop = null
      recorderRef.current.stop()
      recorderRef.current = null
      recordingChunksRef.current = []
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      setIsRecordingVoice(false)
    }
    setPendingAttachment(null)
    setDraft('')
    setReplyTo(null)
    setEditingMessageId(null)
  }, [selectedId])

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current)
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const loadGroups = useCallback(async () => {
    const { data } = await supabase.rpc('discover_smartnekam_chat_groups', { p_query: '' })
    setGroups((data ?? []) as ChatGroup[])
  }, [supabase])

  const loadInbox = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_chat_inbox')
    if (error) {
      setNotice('Imeshindikana kupakia chats. Hakikisha umeendesha SQL 016 na SQL 006/013 zimefanikiwa.')
    } else {
      const items = (data ?? []) as InboxItem[]
      setInbox(items)
      const requestedConversation = new URLSearchParams(window.location.search).get('conversation')
      if (requestedConversation && items.some((item) => item.conversation_id === requestedConversation)) {
        setSelectedId(requestedConversation)
      }
      setNotice('')
    }
    setLoadingInbox(false)
  }, [supabase])

  const loadGroupManagement = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase.rpc('get_smartnekam_chat_group_management', { p_conversation_id: conversationId })
    if (error || !data) {
      setGroupManagement(null)
      if (error) setNotice(`Imeshindikana kupakia mipangilio ya group. Hakikisha SQL 040 imeendeshwa. ${error.message}`)
      return
    }
    const details = data as GroupManagement
    if (details.settings?.icon_path) {
      const { data: signed } = await supabase.storage.from('smartnekam-chat-attachments').createSignedUrl(details.settings.icon_path, 60 * 60)
      details.settings.icon_url = signed?.signedUrl ?? null
    } else if (details.settings) {
      details.settings.icon_url = null
    }
    setGroupManagement(details)
  }, [supabase])

  function updateGroupSettingsDraft(patch: Partial<GroupManagement['settings']>) {
    setGroupManagement((current) => current ? { ...current, settings: { ...current.settings, ...patch } } : current)
  }

  async function saveGroupSettings() {
    if (!selectedId || activeConversation?.conversation_type !== 'group' || !groupManagement || groupActionBusy) return
    setGroupActionBusy(true); setNotice('')
    const s = groupManagement.settings
    const { error } = await supabase.rpc('update_smartnekam_chat_group_settings', {
      p_conversation_id: selectedId,
      p_title: s.title,
      p_description: s.description,
      p_visibility: s.visibility,
      p_icon_path: s.icon_path,
      p_send_messages_policy: s.send_messages_policy,
      p_edit_group_info_policy: s.edit_group_info_policy,
      p_approve_new_members: s.approve_new_members,
      p_allow_member_adds: s.allow_member_adds,
      p_disappearing_messages_seconds: s.disappearing_messages_seconds,
      p_lock_disappearing_messages: s.lock_disappearing_messages,
    })
    if (error) setNotice(`Mipangilio haikuhifadhiwa: ${error.message}`)
    else { await Promise.all([loadGroupManagement(selectedId), loadInbox(), loadGroups()]); setNotice('Mipangilio ya group imehifadhiwa.') }
    setGroupActionBusy(false)
  }

  async function uploadGroupIcon(file: File | null) {
    if (!file || !selectedId || !groupManagement || activeConversation?.conversation_type !== 'group') return
    const canEditInfo = groupManagement.can_manage || groupManagement.settings.edit_group_info_policy === 'everyone'
    if (!canEditInfo) { setNotice('Admin pekee ndiye anayeweza kubadilisha picha ya group.'); return }
    if (!file.type.startsWith('image/')) { setNotice('Chagua faili la picha.'); return }
    if (file.size > 5 * 1024 * 1024) { setNotice('Picha ya group isizidi 5 MB.'); return }
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${selectedId}/${myUserId}/group-icon-${Date.now()}.${extension}`
    setGroupActionBusy(true); setNotice('')
    const { error } = await supabase.storage.from('smartnekam-chat-attachments').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) setNotice(`Picha haikupakiwa: ${error.message}`)
    else {
      updateGroupSettingsDraft({ icon_path: path, icon_url: URL.createObjectURL(file) })
      setNotice('Picha imepakiwa. Bonyeza Hifadhi mipangilio ili iwe picha rasmi ya group.')
    }
    setGroupActionBusy(false)
    if (groupIconInputRef.current) groupIconInputRef.current.value = ''
  }

  async function reviewGroupRequest(requestId: string, decision: 'approved' | 'rejected') {
    if (!selectedId || groupActionBusy) return
    setGroupActionBusy(true); setNotice('')
    const { error } = await supabase.rpc('review_smartnekam_chat_group_join_request', { p_request_id: requestId, p_decision: decision })
    if (error) setNotice(`Ombi halikuchakatwa: ${error.message}`)
    else { await Promise.all([loadGroupManagement(selectedId), loadInbox()]); setNotice(decision === 'approved' ? 'Ombi limekubaliwa.' : 'Ombi limekataliwa.') }
    setGroupActionBusy(false)
  }

  async function changeGroupAdmin(member: GroupMember, makeAdmin: boolean) {
    if (!selectedId || groupActionBusy) return
    const prompt = makeAdmin ? `Mteue ${member.full_name} kuwa admin wa group?` : `Mvue ${member.full_name} madaraka ya admin?`
    if (!window.confirm(prompt)) return
    setGroupActionBusy(true); setNotice('')
    const { error } = await supabase.rpc('set_smartnekam_chat_group_admin', { p_conversation_id: selectedId, p_user_id: member.user_id, p_make_admin: makeAdmin })
    if (error) setNotice(`Role haikubadilishwa: ${error.message}`)
    else { setNotice(makeAdmin ? 'Mwanachama ameteuliwa kuwa admin.' : 'Mwanachama amevuliwa u-admin.'); await loadGroupManagement(selectedId) }
    setGroupActionBusy(false)
  }

  async function removeGroupMember(member: GroupMember) {
    if (!selectedId || groupActionBusy) return
    if (!window.confirm(member.user_id === myUserId ? 'Unataka kutoka kwenye group hili?' : `Ondoa ${member.full_name} kwenye group?`)) return
    setGroupActionBusy(true); setNotice('')
    const { error } = await supabase.rpc('remove_smartnekam_chat_group_member', { p_conversation_id: selectedId, p_user_id: member.user_id })
    if (error) setNotice(`Mwanachama hakuondolewa: ${error.message}`)
    else if (member.user_id === myUserId) { setSelectedId(null); setGroupManagement(null); setGroupManagementOpen(false); await Promise.all([loadInbox(), loadGroups()]); setNotice('Umetoka kwenye group.') }
    else { setNotice('Mwanachama ameondolewa.'); await Promise.all([loadGroupManagement(selectedId), loadInbox()]) }
    setGroupActionBusy(false)
  }

  async function resetGroupInvite() {
    if (!selectedId || groupActionBusy || !window.confirm('Reset invite link? Link/code ya zamani itakoma kufanya kazi.')) return
    setGroupActionBusy(true); setNotice('')
    const { data, error } = await supabase.rpc('reset_smartnekam_chat_group_invite_link', { p_conversation_id: selectedId })
    if (error) setNotice(`Invite link haikubadilishwa: ${error.message}`)
    else { updateGroupSettingsDraft({ invite_code: String(data) }); setNotice('Invite code mpya imetengenezwa; code ya zamani imezimwa.') }
    setGroupActionBusy(false)
  }

  async function deleteGroup() {
    if (!selectedId || groupActionBusy || !window.confirm('Futa group hili kwa wanachama wote? Mazungumzo hayataonekana tena na invite code itazimwa.')) return
    const oldId = selectedId
    setGroupActionBusy(true); setNotice('')
    const { error } = await supabase.rpc('delete_smartnekam_chat_group', { p_conversation_id: oldId })
    if (error) setNotice(`Group halikufutwa: ${error.message}`)
    else { setSelectedId(null); setGroupManagement(null); setGroupManagementOpen(false); setGroupInviteOpen(false); await Promise.all([loadInbox(), loadGroups()]); setNotice('Group limefutwa.') }
    setGroupActionBusy(false)
  }

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    // Expiring group chats are cleaned at read time as well as when new messages arrive.
    try { await supabase.rpc('purge_smartnekam_expired_group_messages', { p_conversation_id: conversationId }) } catch { /* older database migration may not have been applied yet */ }
    const { data, error } = await supabase.rpc('get_smartnekam_chat_messages', {
      p_conversation_id: conversationId,
      p_limit: lowDataMode ? 40 : 80,
    })
    if (error) {
      setNotice('Hatuwezi kufungua ujumbe huu. Hakikisha bado una ruhusa ya mazungumzo.')
      setMessages([])
    } else {
      const nextMessages = (data ?? []) as ChatMessage[]
      setMessages(nextMessages)
      const attachmentPaths = [...new Set(nextMessages.map((message) => message.attachment_path).filter((path): path is string => Boolean(path)))]
      const externalEntries = attachmentPaths.filter((path) => /^https?:\/\//i.test(path)).map((path) => [path, path] as const)
      const storagePaths = attachmentPaths.filter((path) => !/^https?:\/\//i.test(path))
      let signedEntries: (readonly [string, string])[] = externalEntries
      if (storagePaths.length) {
        // One signed-URL request for all visible conversation attachments instead of one request per file.
        const { data: signedRows } = await supabase.storage.from('smartnekam-chat-attachments').createSignedUrls(storagePaths, 60 * 60)
        const storageEntries = (signedRows ?? []).map((item) => [item.path ?? '', item.signedUrl ?? ''] as const)
        signedEntries = [...externalEntries, ...storageEntries]
      }
      setAttachmentUrls(Object.fromEntries(signedEntries.filter((entry) => Boolean(entry[0] && entry[1]))))
      if (nextMessages.length) {
        const { data: reactionRows } = await supabase.from('chat_message_reactions').select('message_id,user_id,reaction').in('message_id', nextMessages.map((message) => message.id))
        setReactions((reactionRows ?? []) as Reaction[])
      } else {
        setReactions([])
      }
      await supabase.from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', myUserId)
    }
    setLoadingMessages(false)
  }, [myUserId, supabase, lowDataMode])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) {
        setMyUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name,avatar_url').eq('id', user.id).maybeSingle()
        if (!cancelled && profile) setMyProfile({ full_name: profile.full_name || 'Wewe', avatar_url: profile.avatar_url || null })
      }
      if (!cancelled) await Promise.all([loadInbox(), loadGroups()])
    }
    void initialize()
    return () => { cancelled = true }
  }, [loadInbox, loadGroups, supabase])

  useEffect(() => {
    const q = search.trim().replace(/^@/, '')
    if (q.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.rpc('search_smartnekam_users', { p_query: q, p_limit: 12 })
      if (!cancelled) {
        if (error) {
          setSearchResults([])
          setNotice('Utafutaji wa username haujapatikana. Hakikisha umeendesha SQL 016.')
        } else {
          setSearchResults((data ?? []) as SearchUser[])
          setNotice('')
        }
        setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search, supabase])

  useEffect(() => {
    const query = groupInviteQuery.trim().replace(/^@/, '')
    if (!groupInviteOpen || query.length < 2) {
      setGroupInviteResults([])
      setGroupInviteSearching(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setGroupInviteSearching(true)
      const { data, error } = await supabase.rpc('search_smartnekam_users', { p_query: query, p_limit: 20 })
      if (!cancelled) {
        setGroupInviteResults(error ? [] : (data ?? []) as SearchUser[])
        if (error) setNotice(`Utafutaji wa wanachama umeshindwa: ${error.message}`)
        setGroupInviteSearching(false)
      }
    }, 280)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [groupInviteOpen, groupInviteQuery, supabase])

  useEffect(() => {
    setGroupManagementOpen(false)
    if (!selectedId || activeConversation?.conversation_type !== 'group') {
      setGroupManagement(null)
      return
    }
    void loadGroupManagement(selectedId)
  }, [selectedId, activeConversation?.conversation_type, loadGroupManagement])

  useEffect(() => {
    setGroupInviteOpen(false)
    setGroupInviteSelected([])
    setGroupInviteQuery('')
    if (!selectedId || !myUserId) return
    void loadMessages(selectedId)
    const channel = supabase.channel(`smartnekam-chat-${selectedId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}`,
      }, () => {
        void loadMessages(selectedId)
        void loadInbox()
      })
      .subscribe()
    const reactionChannel = supabase.channel(`smartnekam-reactions-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => { void loadMessages(selectedId) })
      .subscribe()
    return () => { void supabase.removeChannel(channel); void supabase.removeChannel(reactionChannel) }
  }, [selectedId, myUserId, supabase, loadInbox, loadMessages])

  useEffect(() => {
    if (!selectedId || !myUserId) {
      setCallChannelReady(false)
      return
    }

    // A caller may insert the offer while the receiver is on another page or
    // the browser is closed. On opening the chat from a push notification,
    // load the recent pending offer as well as subscribing to future signals.
    const receiveSignalRow = (row: unknown) => {
      const record = row as {
        id?: string
        conversation_id?: string
        sender_id?: string
        recipient_id?: string
        signal?: CallSignal
      }
      const signal = record.signal
      if (!signal || record.conversation_id !== selectedId || record.recipient_id !== myUserId || signal.conversationId !== selectedId || signal.to !== myUserId || signal.from !== record.sender_id || signal.from === myUserId) return

      if (signal.type === 'offer') {
        if (record.id && handledCallOfferIdsRef.current.has(record.id)) return
        if (record.id) {
          handledCallOfferIdsRef.current.add(record.id)
          if (handledCallOfferIdsRef.current.size > 100) {
            const oldest = handledCallOfferIdsRef.current.values().next().value
            if (oldest) handledCallOfferIdsRef.current.delete(oldest)
          }
        }
        if (callStatusRef.current !== 'idle') {
          void sendCallSignal({ type: 'reject', from: myUserId, to: signal.from, conversationId: selectedId })
          return
        }
        setIncomingCallSignal(signal)
        incomingCallSignalIdRef.current = record.id ?? signal.callSignalId ?? null
        setIncomingCallSignalId(incomingCallSignalIdRef.current)
        setCallPeerId(signal.from)
        updateCallStatus('incoming')
        return
      }
      if (signal.type === 'ice-candidate' && signal.candidate) {
        const pc = peerConnectionRef.current
        if (pc?.remoteDescription) void pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => undefined)
        else queuedIceCandidatesRef.current.push(signal.candidate)
        return
      }
      if (signal.type === 'answer' && signal.description) {
        const pc = peerConnectionRef.current
        if (!pc) return
        void pc.setRemoteDescription(new RTCSessionDescription(signal.description)).then(async () => {
          const candidates = queuedIceCandidatesRef.current.splice(0)
          for (const candidate of candidates) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
          updateCallStatus('connecting')
        }).catch(() => setNotice('Jibu la simu halikuunganishwa. Jaribu kupiga tena.'))
        return
      }
      if (signal.type === 'hangup' || signal.type === 'reject') {
        if (callStatusRef.current === 'incoming' || incomingCallSignalIdRef.current) {
          resolveIncomingCallNotice(incomingCallSignalIdRef.current, selectedId)
        }
        releaseAudioCall()
        incomingCallSignalIdRef.current = null
        setIncomingCallSignalId(null)
        setNotice(signal.type === 'reject' ? 'Mtumiaji hakuweza kupokea simu kwa sasa.' : 'Simu ya sauti imeisha.')
      }
    }

    // Signaling uses an app-owned table; never alter Supabase's managed
    // realtime.messages table. The notification itself is created by SQL 037.
    const channel = supabase.channel(`smartnekam-call-signals:${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'smartnekam_call_signals',
        filter: `conversation_id=eq.${selectedId}`,
      }, ({ new: row }) => receiveSignalRow(row))
      .subscribe((status) => {
        const ready = status === 'SUBSCRIBED'
        setCallChannelReady(ready)
        if (ready) {
          callChannelRef.current = channel
          const requestedCallSignalId = pendingIncomingCallActionRef.current?.callSignalId
          let pendingOfferQuery = supabase.from('smartnekam_call_signals')
            .select('id,conversation_id,sender_id,recipient_id,signal,created_at')
            .eq('conversation_id', selectedId)
            .eq('recipient_id', myUserId)
          if (requestedCallSignalId) {
            pendingOfferQuery = pendingOfferQuery.eq('id', requestedCallSignalId)
          } else {
            pendingOfferQuery = pendingOfferQuery
              .filter('signal->>type', 'eq', 'offer')
              .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
          }
          void pendingOfferQuery.maybeSingle().then(({ data, error }) => {
            if (!error && data) receiveSignalRow(data)
          })
        }
      })
    return () => {
      setCallChannelReady(false)
      if (callChannelRef.current === channel) callChannelRef.current = null
      releaseAudioCall()
      void supabase.removeChannel(channel)
    }
    // This channel is scoped to the selected conversation and current user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, myUserId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function startChat(target: SearchUser) {
    if (!target.can_message) {
      setNotice('Mtumiaji huyu ameweka mipangilio ya faragha inayozuia DM mpya. Unaweza kuwasiliana naye ikiwa ruhusa itaruhusu, kwa mfano mkiwa kwenye study group moja.')
      return
    }
    setStartingUser(target.user_id)
    setNotice('')
    const { data, error } = await supabase.rpc('create_or_get_direct_conversation', { p_other_user_id: target.user_id })
    if (error || !data) {
      setNotice(error?.message?.includes('privacy') || error?.message?.includes('unavailable')
        ? 'Mazungumzo mapya hayaruhusiwi na mipangilio ya faragha ya mtumiaji huyu.'
        : 'Imeshindikana kuanzisha chat. Jaribu tena.')
    } else {
      const conversationId = data as string
      await loadInbox()
      setSelectedId(conversationId)
      setSearch('')
      setSearchResults([])
      setDraft('')
    }
    setStartingUser(null)
  }

  function stopVoiceRecording() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function startVoiceRecording() {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('Kurekodi sauti hakupatikani kwenye browser hii. Tumia browser ya kisasa kwenye HTTPS au localhost.')
      return
    }
    if (!canSendInActiveConversation || !selectedId || editingMessageId) return
    try {
      setNotice('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      recordingChunksRef.current = []
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setNotice('Kurekodi sauti kumesimama kwa hitilafu. Jaribu tena.')
        setIsRecordingVoice(false)
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(recordingChunksRef.current, { type })
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
        recorderRef.current = null
        setIsRecordingVoice(false)
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        if (blob.size === 0) {
          setNotice('Sauti haikurekodiwa. Angalia ruhusa ya microphone kisha ujaribu tena.')
          return
        }
        if (blob.size > 10 * 1024 * 1024) {
          setNotice('Sauti imezidi 10 MB. Rekodi ujumbe mfupi kisha ujaribu tena.')
          return
        }
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `smartnekam-voice-${Date.now()}.${extension}`, { type })
        setPendingAttachment(file)
        setDraft((current) => current.trim() ? current : '🎤 Ujumbe wa sauti')
        setNotice('Sauti imerekodiwa. Isikilize hapa chini, kisha tuma.')
      }
      recorder.start(250)
      recordingStartRef.current = Date.now()
      setRecordSeconds(0)
      setIsRecordingVoice(true)
      setNotice('Inarekodi sauti… bonyeza kitufe chekundu kusimamisha.')
      recordingTimerRef.current = window.setInterval(() => {
        const started = recordingStartRef.current
        if (!started) return
        const elapsed = Math.floor((Date.now() - started) / 1000)
        setRecordSeconds(elapsed)
        if (elapsed >= 90) stopVoiceRecording()
      }, 1000)
    } catch (error) {
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Ruhusu SmartNekam kutumia microphone kwenye mipangilio ya browser ili kurekodi sauti.'
        : 'Imeshindikana kutumia microphone. Hakikisha hakuna app nyingine inayozuia microphone.'
      setNotice(message)
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      recordingStreamRef.current = null
      setIsRecordingVoice(false)
    }
  }

  function updateCallStatus(status: CallStatus) {
    callStatusRef.current = status
    setCallStatus(status)
  }

  function releaseAudioCall(updateUi = true) {
    peerConnectionRef.current?.getSenders().forEach((sender) => sender.track?.stop())
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localCallStreamRef.current?.getTracks().forEach((track) => track.stop())
    localCallStreamRef.current = null
    queuedIceCandidatesRef.current = []
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    if (updateUi) {
      updateCallStatus('idle')
      setCallPeerId(null)
      setIncomingCallSignal(null)
      incomingCallSignalIdRef.current = null
      setIncomingCallSignalId(null)
      setCallMuted(false)
    }
  }

  async function sendCallSignal(signal: CallSignal) {
    if (!callChannelRef.current) throw new Error('Muunganisho wa simu haujawa tayari. Subiri sekunde chache kisha jaribu tena.')
    const { error } = await supabase.from('smartnekam_call_signals').insert({
      conversation_id: signal.conversationId,
      sender_id: signal.from,
      recipient_id: signal.to,
      signal,
    })
    if (error) throw new Error('Ujumbe wa kuunganisha simu haukutumwa. Hakikisha SQL ya signaling imewekwa na ujaribu tena.')
  }

  async function createAudioPeer(remoteUserId: string) {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('Simu ya sauti haiungwi mkono na browser hii. Tumia browser ya kisasa kwenye HTTPS au localhost.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localCallStreamRef.current = stream
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    peerConnectionRef.current = pc
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0]
        void remoteAudioRef.current.play().catch(() => setNotice('Bonyeza play kwenye sauti ya simu kama browser imezuia autoplay.'))
      }
      updateCallStatus('connected')
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate || !selectedId) return
      void sendCallSignal({ type: 'ice-candidate', from: myUserId, to: remoteUserId, conversationId: selectedId, candidate: event.candidate.toJSON() }).catch(() => undefined)
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') updateCallStatus('connected')
      if (pc.connectionState === 'failed') setNotice('Muunganisho wa simu umeshindikana. Jaribu tena au kagua mtandao.')
    }
    return pc
  }

  async function startAudioCall() {
    const conversation = activeConversation
    if (!conversation || conversation.conversation_type === 'group' || !conversation.other_user_id || !selectedId || !callChannelReady || callStatus !== 'idle') return
    try {
      setNotice('')
      setCallPeerId(conversation.other_user_id)
      updateCallStatus('calling')
      const pc = await createAudioPeer(conversation.other_user_id)
      const offer = await pc.createOffer({ offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)
      await sendCallSignal({ type: 'offer', from: myUserId, to: conversation.other_user_id, conversationId: selectedId, description: pc.localDescription?.toJSON() })
    } catch (error) {
      releaseAudioCall()
      setNotice(error instanceof Error ? error.message : 'Imeshindikana kuanzisha simu ya sauti.')
    }
  }

  async function answerAudioCall(incomingOverride?: CallSignal) {
    const incoming = incomingOverride ?? incomingCallSignal
    const conversationId = incoming?.conversationId ?? selectedId
    if (!incoming || !conversationId) return
    try {
      setNotice('')
      if (!incoming.description) {
        setNotice('Taarifa za kuanzisha simu hazijakamilika. Mwambie mpigaji apige tena.')
        return
      }
      const pc = await createAudioPeer(incoming.from)
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.description))
      const candidates = queuedIceCandidatesRef.current.splice(0)
      for (const candidate of candidates) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await sendCallSignal({ type: 'answer', from: myUserId, to: incoming.from, conversationId, callSignalId: incomingCallSignalId ?? incoming.callSignalId, description: pc.localDescription?.toJSON() })
      resolveIncomingCallNotice(incomingCallSignalIdRef.current ?? incomingCallSignalId ?? incoming.callSignalId, conversationId)
      setIncomingCallSignal(null)
      incomingCallSignalIdRef.current = null
      setIncomingCallSignalId(null)
      clearCallActionFromUrl()
      updateCallStatus('connecting')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Imeshindikana kujibu simu ya sauti.')
      // Clean up partial WebRTC resources but preserve the ringing offer so the user can retry.
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
      localCallStreamRef.current?.getTracks().forEach((track) => track.stop())
      localCallStreamRef.current = null
      queuedIceCandidatesRef.current = []
      setIncomingCallSignal(incoming)
      incomingCallSignalIdRef.current = incomingCallSignalId ?? incoming.callSignalId ?? null
      setIncomingCallSignalId(incomingCallSignalIdRef.current)
      setCallPeerId(incoming.from)
      updateCallStatus('incoming')
    }
  }

  async function endAudioCall() {
    const wasIncoming = callStatus === 'incoming'
    const incomingId = incomingCallSignalIdRef.current ?? incomingCallSignalId ?? incomingCallSignal?.callSignalId ?? null
    const conversationId = incomingCallSignal?.conversationId ?? selectedId
    const peerId = callPeerId ?? incomingCallSignal?.from
    if (peerId && conversationId && callStatus !== 'idle') {
      const type = wasIncoming ? 'reject' : 'hangup'
      try {
        await sendCallSignal({ type, from: myUserId, to: peerId, conversationId, callSignalId: wasIncoming ? incomingId ?? undefined : undefined })
        if (wasIncoming) resolveIncomingCallNotice(incomingId, conversationId)
      } catch (error) {
        if (wasIncoming) {
          setNotice(error instanceof Error ? error.message : 'Imeshindikana kukataa simu. Jaribu tena.')
          return
        }
      }
    }
    clearCallActionFromUrl()
    releaseAudioCall()
  }

  function toggleCallMute() {
    const next = !callMuted
    localCallStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next })
    setCallMuted(next)
  }

  useEffect(() => {
    const pending = pendingIncomingCallActionRef.current
    if (!pending || pending.conversationId !== selectedId || callStatus !== 'incoming' || !incomingCallSignal) return
    if (pending.callerId && pending.callerId !== incomingCallSignal.from) return
    if (pending.callSignalId && incomingCallSignalId && pending.callSignalId !== incomingCallSignalId) return
    // Wait for the exact offer attached to the push notification; never answer another call by accident.
    if (pending.callSignalId && !incomingCallSignalId) return
    pendingIncomingCallActionRef.current = null
    clearCallActionFromUrl()
    if (pending.action === 'answer') void answerAudioCall(incomingCallSignal)
    else void endAudioCall()
  }, [pendingCallActionRevision, selectedId, callStatus, incomingCallSignal, incomingCallSignalId])

  async function sendMessage() {
    const body = draft.trim()
    const file = pendingAttachment
    if ((!body && !file) || !selectedId || sending || !myUserId) return
    setSending(true)
    setNotice('')
    if (editingMessageId) {
      if (!body) { setNotice('Ujumbe uliohaririwa hauwezi kuwa tupu.'); setSending(false); return }
      const { error } = await supabase.rpc('edit_smartnekam_chat_message', { p_message_id: editingMessageId, p_body: body })
      if (error) setNotice('Ujumbe haukuhaririwa. Hakikisha SQL 017 imeendeshwa na ni ujumbe wako.')
      else { setDraft(''); setEditingMessageId(null); await loadMessages(selectedId) }
      setSending(false)
      return
    }

    let uploadedPath: string | null = null
    let messageType = 'text'
    try {
      if (file) {
        const uploadFile = lowDataMode ? await compressImageForLowData(file) : file
        if (uploadFile.size > 10 * 1024 * 1024) throw new Error('Kiambatisho kisiwe zaidi ya 10 MB.')
        if (uploadFile.type.startsWith('image/')) messageType = 'image'
        else if (uploadFile.type.startsWith('audio/')) messageType = 'audio'
        else if (uploadFile.type.startsWith('video/')) messageType = 'video'
        else messageType = 'file'
        const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_') || `attachment-${Date.now()}`
        uploadedPath = `${selectedId}/${myUserId}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('smartnekam-chat-attachments').upload(uploadedPath, uploadFile, {
          contentType: uploadFile.type || 'application/octet-stream',
          upsert: false,
        })
        if (uploadError) throw new Error(`Kiambatisho hakikupakiwa: ${uploadError.message}`)
      }
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: selectedId,
        sender_id: myUserId,
        body,
        attachment_path: uploadedPath,
        message_type: messageType,
        reply_to_message_id: replyTo?.id ?? null,
      })
      if (error) {
        if (uploadedPath) await supabase.storage.from('smartnekam-chat-attachments').remove([uploadedPath])
        setNotice(error.message.includes('policy') || error.message.includes('row-level')
          ? 'Ujumbe haukutumwa kwa sababu ya mipangilio ya faragha au block.'
          : `Ujumbe haukutumwa. ${error.message}`)
      } else {
        setDraft(''); setPendingAttachment(null); setReplyTo(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await loadMessages(selectedId); await loadInbox()
      }
    } catch (caught) {
      if (uploadedPath) await supabase.storage.from('smartnekam-chat-attachments').remove([uploadedPath])
      setNotice(caught instanceof Error ? caught.message : 'Ujumbe haukutumwa. Jaribu tena.')
    }
    setSending(false)
  }

  async function createGroup() {
    if (groupTitle.trim().length < 3) { setNotice('Jina la group liwe na angalau herufi 3.'); return }
    setGroupBusy(true); setNotice('')
    const { data, error } = await supabase.rpc('create_smartnekam_chat_group', { p_title: groupTitle.trim(), p_description: groupDescription.trim(), p_visibility: groupVisibility })
    const created = (Array.isArray(data) ? data[0] : data) as { conversation_id?: string; invite_code?: string } | null
    if (error) {
      const reason = [error.message, error.details, error.hint].filter(Boolean).join(' · ')
      setNotice(`Group haikuundwa: ${reason || 'Kosa lisilojulikana kutoka Supabase.'}`)
    } else if (!created?.conversation_id) {
      setNotice('Supabase haikurudisha conversation_id. Kagua kama migration ya SQL 017/020 imekamilika.')
    } else {
      setNotice(groupVisibility === 'private' ? `Group imeundwa. Invite code: ${created.invite_code}` : 'Public chat group imeundwa.')
      setGroupTitle(''); setGroupDescription(''); await Promise.all([loadInbox(), loadGroups()]); setSelectedId(created.conversation_id); setShowGroupTools(false)
    }
    setGroupBusy(false)
  }

  async function addGroupMembers() {
    if (!selectedId || activeConversation?.conversation_type !== 'group' || groupInviteSelected.length === 0 || groupInviteAdding) return
    setGroupInviteAdding(true)
    setNotice('')
    const { data, error } = await supabase.rpc('add_smartnekam_chat_group_members', {
      p_conversation_id: selectedId,
      p_user_ids: groupInviteSelected,
    })
    if (error) {
      setNotice(`Imeshindikana kuongeza watu: ${[error.message, error.details, error.hint].filter(Boolean).join(' · ')}`)
    } else {
      const total = Number(data ?? 0)
      setNotice(total > 0 ? `Watu ${total} wameongezwa kwenye group.` : 'Hakuna mwanachama mpya aliyeongezwa; waliochaguliwa wanaweza kuwa tayari ni wanachama.')
      setGroupInviteSelected([])
      setGroupInviteQuery('')
      setGroupInviteResults([])
      setGroupInviteOpen(false)
      await loadInbox()
    }
    setGroupInviteAdding(false)
  }

  async function joinPublicGroup(group: ChatGroup) {
    if (group.is_member) { setSelectedId(group.conversation_id); return }
    setGroupBusy(true); setNotice('')
    const { data, error } = await supabase.rpc('request_smartnekam_public_chat_group_join', { p_conversation_id: group.conversation_id })
    if (error) setNotice(`Imeshindikana kujiunga: ${error.message}`)
    else if (data === 'pending') { setNotice('Ombi lako la kujiunga limetumwa kwa admin wa group.'); await loadGroups() }
    else { await Promise.all([loadInbox(), loadGroups()]); setSelectedId(group.conversation_id); setShowGroupTools(false) }
    setGroupBusy(false)
  }

  async function joinPrivateGroup() {
    if (!inviteCode.trim()) return
    setGroupBusy(true); setNotice('')
    const { data, error } = await supabase.rpc('request_smartnekam_private_chat_group_join', { p_invite_code: inviteCode.trim() })
    const result = (Array.isArray(data) ? data[0] : data) as { conversation_id?: string; request_status?: string } | null
    if (error || !result?.conversation_id) setNotice(`Invite code si sahihi au group haipatikani${error?.message ? `: ${error.message}` : '.'}`)
    else if (result.request_status === 'pending') { setInviteCode(''); setNotice('Ombi lako limetumwa kwa admin wa group kwa ajili ya kuidhinishwa.') }
    else { setInviteCode(''); await loadInbox(); setSelectedId(result.conversation_id); setShowGroupTools(false) }
    setGroupBusy(false)
  }

  async function toggleReaction(message: ChatMessage, reaction: string) {
    const existing = reactions.some((item) => item.message_id === message.id && item.user_id === myUserId && item.reaction === reaction)
    if (existing) await supabase.from('chat_message_reactions').delete().eq('message_id', message.id).eq('user_id', myUserId).eq('reaction', reaction)
    else await supabase.from('chat_message_reactions').insert({ message_id: message.id, user_id: myUserId, reaction })
    if (messages.length) {
      const { data } = await supabase.from('chat_message_reactions').select('message_id,user_id,reaction').in('message_id', messages.map((item) => item.id))
      setReactions((data ?? []) as Reaction[])
    }
  }

  async function deleteMessage(message: ChatMessage) {
    if (!window.confirm('Una uhakika unataka kufuta ujumbe huu kwa washiriki wote?')) return
    const isGroupAdminDeletingOthers = activeConversation?.conversation_type === 'group' && groupManagement?.can_manage && message.sender_id !== myUserId
    const { error } = await supabase.rpc(isGroupAdminDeletingOthers ? 'admin_delete_smartnekam_group_message' : 'delete_smartnekam_chat_message', { p_message_id: message.id })
    if (error) setNotice(`Ujumbe haukufutwa: ${error.message}`)
    else if (selectedId) await loadMessages(selectedId)
  }

  const showingSearch = search.trim().replace(/^@/, '').length >= 2

  const chatContainerClass = selectedId
    ? 'sn-chat-shell sn-chat-shell-active fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none border-0 md:static md:h-auto md:w-auto md:flex-none md:rounded-[28px] md:border'
    : 'sn-chat-shell overflow-hidden rounded-[28px] border'

  return <section className={chatContainerClass}>
    <div className={`${selectedId ? 'hidden md:flex' : 'flex'} sn-chat-topbar relative items-center justify-between overflow-hidden border-b px-4 py-4 text-white sm:px-5`}>
      <div className="pointer-events-none absolute -right-6 -top-12 h-32 w-32 rounded-full border-[18px] border-white/10" />
      <div className="relative">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">SmartNekam · Connect</p>
        <h2 className="mt-1 text-lg font-extrabold sm:text-xl">Messages</h2>
        <p className="mt-0.5 text-xs text-emerald-50/90">SmartNekam · Chat, voice notes na study groups.</p>
      </div>
      <span className="relative flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold backdrop-blur-sm sm:text-xs"><span className="h-2 w-2 rounded-full bg-lime-300" /> Private chats</span>
    </div>

    <div className={`${selectedId ? 'flex-1 h-full min-h-0 max-h-none md:h-[76dvh] md:min-h-[520px] md:max-h-[900px] md:flex-none' : 'h-[76dvh] min-h-[520px] max-h-[900px]'} sn-chat-layout grid grid-cols-1 md:grid-cols-[310px_minmax(0,1fr)]`}>
      <aside className={`${selectedId ? 'hidden md:flex' : 'flex'} sn-chat-sidebar min-h-0 flex-col border-r text-white`}>
        <div className="border-b border-emerald-900/50 p-3 dark:border-slate-800">
          <label className="flex items-center gap-2 rounded-2xl border border-emerald-900/60 bg-[#102a2c] px-3 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tafuta username..." aria-label="Tafuta user kwa username" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-400" />
            {search && <button type="button" aria-label="Futa utafutaji" onClick={() => setSearch('')}><X className="h-4 w-4 text-slate-400" /></button>}
          </label>
          <p className="mt-2 text-[11px] text-slate-400">Andika angalau herufi 2; username inaweza kuanza na @.</p>
          <button type="button" onClick={() => setShowGroupTools((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-500"><Users className="h-4 w-4" /> {showGroupTools ? 'Ficha chat groups' : 'Chat Groups · Unda / Jiunge'}</button>
        </div>

        {showGroupTools && <div className="max-h-[52vh] space-y-3 overflow-y-auto border-b border-emerald-100 p-3 dark:border-slate-800">
          <div className="rounded-2xl border border-emerald-100 p-3 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Unda chat group</h3>
            <input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value.slice(0,100))} placeholder="Jina la group" className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            <textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value.slice(0,1000))} placeholder="Maelezo ya group (hiari)" rows={2} className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            <select value={groupVisibility} onChange={(e) => setGroupVisibility(e.target.value as 'public'|'private')} className="mt-2 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="private">Private · invite code inahitajika</option><option value="public">Public · wanafunzi wanaweza kuipata</option></select>
            <button type="button" disabled={groupBusy || groupTitle.trim().length < 3} onClick={() => void createGroup()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {groupBusy ? 'Subiri...' : 'Unda group'}</button>
          </div>
          <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Jiunge na private group</h3>
            <div className="mt-2 flex gap-2"><input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0,20))} placeholder="Invite code" className="min-w-0 flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"/><button type="button" disabled={groupBusy || !inviteCode.trim()} onClick={() => void joinPrivateGroup()} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-emerald-700">Jiunge</button></div>
          </div>
          <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Public chat groups</h3><button type="button" onClick={() => void loadGroups()} className="text-xs font-bold text-emerald-700">Refresh</button></div>
            {groups.length ? groups.map((group) => <div key={group.conversation_id} className="mb-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex items-start gap-2"><span className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"><Globe2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 dark:text-white">{group.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{group.description || 'Public chat group'} · {group.member_count} members</p></div></div><button type="button" onClick={() => void joinPublicGroup(group)} className="mt-2 w-full rounded-lg border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-800 dark:border-emerald-900 dark:text-emerald-200">{group.is_member ? 'Fungua group' : 'Jiunge na group'}</button></div>) : <p className="text-xs text-slate-500">Bado hakuna public chat groups.</p>}
          </div>
          <p className="text-[11px] leading-5 text-slate-500">Chat Groups ni tofauti na Study Groups za masomo. Public Study Groups zinaendelea kuonekana kwenye tab ya Study Groups.</p>
        </div>}

        {showingSearch && <div className="max-h-56 overflow-y-auto border-b border-emerald-100 p-2 dark:border-slate-800">
          <p className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Watumiaji</p>
          {searching ? <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Inatafuta...</div>
            : searchResults.length ? searchResults.map((person) => <button type="button" key={person.user_id} onClick={() => void startChat(person)} disabled={startingUser === person.user_id} className="flex w-full items-center gap-2 rounded-xl p-2 text-left transition hover:bg-emerald-50 disabled:opacity-60 dark:hover:bg-slate-800">
              <Avatar name={person.full_name} url={person.avatar_url} size="h-9 w-9" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{person.full_name}</span><span className="block truncate text-xs text-slate-500">@{person.username}</span></span>
              {startingUser === person.user_id ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : person.can_message ? <MessageCircle className="h-4 w-4 text-emerald-600" /> : <ShieldCheck className="h-4 w-4 text-amber-500" />}
            </button>)
            : <p className="px-3 py-4 text-sm text-slate-500">Hakuna mtumiaji aliyepatikana kwa utafutaji huo.</p>}
        </div>}

        {!showGroupTools && !showingSearch && <div className="border-b border-emerald-900/50 bg-gradient-to-br from-[#103a38] via-[#0c2628] to-[#071b1d] px-4 pb-3 pt-4 dark:border-slate-800 dark:from-[#14372e] dark:via-[#111923] dark:to-[#121826]">
          <div className="mb-3 flex items-end justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-300">SmartNekam Community</p><h3 className="mt-1 text-base font-extrabold leading-tight text-white">Watu wako</h3></div><span className="text-[10px] font-semibold text-slate-400">Telezesha kuona zaidi</span></div>
          {inbox.length ? <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#10b981_transparent]">
            {inbox.slice(0, 12).map((item) => <button key={item.conversation_id} type="button" onClick={() => { setSelectedId(item.conversation_id); setNotice('') }} className="flex w-[62px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2 transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-white/5" title={`Fungua chat ya ${item.other_full_name}`}>
              <span className={`relative rounded-full p-[2px] ${selectedId === item.conversation_id ? 'bg-emerald-600' : 'bg-gradient-to-br from-emerald-300 to-lime-400'}`}><Avatar name={item.other_full_name} url={item.other_avatar_url} size="h-11 w-11" />{Number(item.unread_count) > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />}</span>
              <span className="w-full truncate text-center text-[10px] font-bold text-slate-100">{item.other_full_name.split(/\s+/)[0]}</span>
            </button>)}
          </div> : <p className="rounded-xl border border-dashed border-emerald-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-black/10">Anza chat mpya kwa kutafuta username hapo juu.</p>}
        </div>}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between px-4 pb-2 pt-3"><h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Chats zako</h3><button type="button" onClick={() => void loadInbox()} className="text-xs font-bold text-emerald-300 dark:text-emerald-300">Refresh</button></div>
          {loadingInbox ? <div className="space-y-3 p-4"><div className="shimmer-element h-12 rounded-xl" /><div className="shimmer-element h-12 rounded-xl" /><div className="shimmer-element h-12 rounded-xl" /></div>
            : inbox.length ? inbox.map((item) => <button type="button" key={item.conversation_id} onClick={() => { setSelectedId(item.conversation_id); setNotice('') }} className={`flex w-full items-center gap-3 border-b border-emerald-900/30 px-3 py-3 text-left transition hover:bg-white/5 dark:border-slate-800 dark:hover:bg-slate-900 ${selectedId === item.conversation_id ? 'bg-emerald-950/70 dark:bg-slate-900' : ''}`}>
              <Avatar name={item.other_full_name} url={item.other_avatar_url} />
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-white">{item.other_full_name}</span>{Number(item.unread_count) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold text-white">{item.unread_count}</span>}</span><span className="block truncate text-xs text-slate-400">{item.last_message || (item.conversation_type === 'group' ? `Chat group · ${item.group_visibility}` : item.conversation_type === 'mentor' ? `Mentorship · @${item.other_username}` : `@${item.other_username}`)}</span></span>
              <span className="shrink-0 text-[10px] text-slate-500">{dayLabel(item.last_message_at)}</span>
            </button>)
            : <div className="px-5 py-10 text-center"><MessageSquareText className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-2 text-sm font-bold text-white">Bado huna chat</p><p className="mt-1 text-xs leading-5 text-slate-400">Tafuta username ya rafiki yako ili kuanzisha mazungumzo.</p></div>}
        </div>
      </aside>

      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} sn-chat-stage min-h-0 min-w-0 flex-col overflow-hidden`}>
        {selectedId && activeConversation ? <>
          <header className="sn-chat-conversation-header flex items-center gap-3 border-b px-3 py-3 text-white backdrop-blur-md">
            <button type="button" onClick={() => { setSelectedId(null); setGroupManagementOpen(false); setGroupInviteOpen(false); setNotice('') }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-800/60 bg-[#123536] text-white transition hover:bg-emerald-700 active:scale-95 md:hidden" aria-label="Rudi kwenye chats" title="Rudi kwenye chats"><ArrowLeft className="h-5 w-5" /></button>
            <Avatar name={activeConversation.other_full_name} url={activeConversation.conversation_type === 'group' ? (groupManagement?.settings.icon_url ?? null) : activeConversation.other_avatar_url} size="h-10 w-10" />
            <div className="min-w-0 flex-1"><p className="truncate font-extrabold text-white">{activeConversation.other_full_name}</p><p className="text-xs text-slate-400">{activeConversation.conversation_type === 'group' ? `${activeConversation.group_visibility === 'public' ? 'Public' : 'Private'} group · ${groupManagement?.members.length ?? '…'} members` : activeConversation.conversation_type === 'mentor' ? `Peer mentorship · @${activeConversation.other_username}` : `@${activeConversation.other_username}`}</p></div>
            {activeConversation.conversation_type === 'group' ? <div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => { setGroupInviteOpen((open) => !open); setGroupInviteSelected([]); setGroupInviteQuery('') }} aria-expanded={groupInviteOpen} disabled={groupManagement?.settings.allow_member_adds === false && !groupManagement?.can_manage} title="Ongeza watu" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-40"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Ongeza watu</span><span className="sm:hidden">Ongeza</span></button><button type="button" onClick={() => { setGroupManagementOpen((open) => !open); if (!groupManagement) void loadGroupManagement(selectedId) }} aria-expanded={groupManagementOpen} title="Mipangilio na wanachama wa group" className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${groupManagementOpen ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-emerald-100 text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-900'}`}><Settings2 className="h-4 w-4" /></button></div> : <div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 sm:inline">{activeConversation.conversation_type === 'mentor' ? 'Mentorship' : 'Private chat'}</span><button type="button" onClick={() => void startAudioCall()} disabled={!callChannelReady || callStatus !== 'idle' || !activeConversation.other_user_id} aria-label="Piga simu ya sauti" title={callChannelReady ? 'Piga simu ya sauti' : 'Inaunganisha...'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"><Phone className="h-4 w-4" /></button></div>}
          </header>
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" aria-label="Sauti ya simu inayoingia" />
          {callStatus !== 'idle' && <div className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/50">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${callStatus === 'incoming' ? 'bg-lime-400 text-emerald-950' : 'bg-emerald-600 text-white'}`}>{callStatus === 'incoming' ? <PhoneIncoming className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-slate-900 dark:text-white">{callStatus === 'incoming' ? 'Simu ya sauti inayoingia' : callStatus === 'calling' ? 'Inapiga simu…' : callStatus === 'connecting' ? 'Inaunganisha sauti…' : 'Simu ya sauti imeunganishwa'}</p><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{activeConversation.other_full_name} · {callStatus === 'incoming' ? 'Jibu au kataa simu.' : 'Sauti tu; kamera haitumiki.'}</p></div>
            {callStatus === 'incoming' ? <><button type="button" onClick={() => void answerAudioCall()} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500">Jibu</button><button type="button" onClick={() => void endAudioCall()} className="rounded-full border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 dark:border-red-900 dark:text-red-300">Kataa</button></> : <><button type="button" onClick={toggleCallMute} aria-label={callMuted ? 'Washa kipaza sauti' : 'Nyamazisha kipaza sauti'} title={callMuted ? 'Washa sauti' : 'Nyamazisha'} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">{callMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button><button type="button" onClick={() => void endAudioCall()} aria-label="Maliza simu" className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500"><PhoneOff className="h-4 w-4" /></button></>}
          </div>}
          {activeConversation.conversation_type === 'group' && groupInviteOpen && <section className="space-y-3 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#121826]">
            <div><h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Ongeza wanachama kwenye group</h3><p className="mt-0.5 text-xs leading-5 text-slate-500">Tafuta kwa jina au username. Ruhusa za kuongeza watu zinafuata settings za group.</p></div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900"><Search className="h-4 w-4 text-slate-400" /><input value={groupInviteQuery} onChange={(event) => setGroupInviteQuery(event.target.value)} placeholder="Tafuta mwanafunzi kwa username..." className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none dark:text-white" /></label>
            {groupInviteSearching && <p className="text-xs text-slate-500">Inatafuta watumiaji...</p>}
            {groupInviteQuery.trim().length >= 2 && !groupInviteSearching && <div className="max-h-44 space-y-1 overflow-y-auto">{groupInviteResults.length ? groupInviteResults.map((person) => { const checked = groupInviteSelected.includes(person.user_id); const isSelf = person.user_id === myUserId; return <button key={person.user_id} type="button" disabled={isSelf} onClick={() => setGroupInviteSelected((current) => checked ? current.filter((id) => id !== person.user_id) : [...current, person.user_id].slice(0, 50))} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${checked ? 'bg-lime-50 ring-1 ring-lime-400 dark:bg-lime-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'} disabled:opacity-40`}><Avatar name={person.full_name} url={person.avatar_url} size="h-9 w-9" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{person.full_name}</span><span className="block truncate text-xs text-slate-500">@{person.username}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${checked ? 'border-lime-500 bg-lime-500 text-black' : 'border-slate-300 text-transparent dark:border-slate-600'}`}>✓</span></button> }) : <p className="py-3 text-xs text-slate-500">Hakuna watumiaji waliopatikana.</p>}</div>}
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Walioteuliwa: {groupInviteSelected.length}/50</span><button type="button" disabled={groupInviteAdding || groupInviteSelected.length === 0} onClick={() => void addGroupMembers()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-40">{groupInviteAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Ongeza waliochaguliwa</button></div>
          </section>}
          {activeConversation.conversation_type === 'group' && groupManagementOpen && <section className="max-h-[54vh] space-y-4 overflow-y-auto border-b border-emerald-900/20 bg-gradient-to-br from-[#f4fbf8] via-white to-[#effaf4] p-3 sm:p-4 dark:border-slate-800 dark:from-[#0b2020] dark:via-[#102727] dark:to-[#101b22]">
            {!groupManagement ? <div className="flex items-center gap-2 py-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Inapakia mipangilio ya group...</div> : <>
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">Group controls</p><h3 className="text-base font-extrabold text-slate-950 dark:text-white">Mipangilio na wanachama</h3><p className="mt-0.5 text-xs text-slate-500">{groupManagement.can_manage ? 'Una ruhusa za admin wa group.' : 'Unaweza kubadilisha sehemu zinazoruhusiwa na admin.'}</p></div><button type="button" onClick={() => void loadGroupManagement(selectedId!)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 text-emerald-800 dark:border-slate-700 dark:text-emerald-200" title="Refresh group controls"><RefreshCw className="h-4 w-4"/></button></div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-black/10">
                  <div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Jina la group</label><input value={groupManagement.settings.title} onChange={(e) => updateGroupSettingsDraft({ title: e.target.value.slice(0,100) })} disabled={!groupManagement.can_manage && groupManagement.settings.edit_group_info_policy !== 'everyone'} maxLength={100} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Maelezo</label><textarea value={groupManagement.settings.description} onChange={(e) => updateGroupSettingsDraft({ description: e.target.value.slice(0,1000) })} disabled={!groupManagement.can_manage && groupManagement.settings.edit_group_info_policy !== 'everyone'} rows={2} maxLength={1000} className="w-full resize-y rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"/></div>
                  <div className="flex flex-wrap items-center gap-3"><Avatar name={groupManagement.settings.title} url={groupManagement.settings.icon_url ?? null} size="h-12 w-12"/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Picha ya group</p><p className="text-[11px] text-slate-500">Picha ya JPG, PNG au WEBP, hadi 5 MB.</p></div><button type="button" disabled={groupActionBusy || (!groupManagement.can_manage && groupManagement.settings.edit_group_info_policy !== 'everyone')} onClick={() => groupIconInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-800 disabled:opacity-40 dark:border-slate-700 dark:text-emerald-200"><ImagePlus className="h-4 w-4"/>Badili picha</button><input ref={groupIconInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void uploadGroupIcon(e.currentTarget.files?.[0] ?? null)}/></div>
                  {groupManagement.can_manage && <><div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Aina ya group</label><select value={groupManagement.settings.visibility} onChange={(e) => updateGroupSettingsDraft({ visibility: e.target.value as 'public'|'private' })} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"><option value="public">Public · linaweza kugunduliwa</option><option value="private">Private · invite code inahitajika</option></select></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Nani anaweza kutuma ujumbe?</label><select value={groupManagement.settings.send_messages_policy} onChange={(e) => updateGroupSettingsDraft({ send_messages_policy: e.target.value as 'everyone'|'admins' })} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"><option value="everyone">Wanachama wote</option><option value="admins">Ma-admin tu · announcement group</option></select></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Nani anaweza kubadili jina/maelezo/picha?</label><select value={groupManagement.settings.edit_group_info_policy} onChange={(e) => updateGroupSettingsDraft({ edit_group_info_policy: e.target.value as 'everyone'|'admins' })} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"><option value="admins">Ma-admin tu</option><option value="everyone">Wanachama wote</option></select></div>
                  <label className="flex items-start gap-2 rounded-xl bg-emerald-50/70 p-2.5 text-xs text-slate-700 dark:bg-emerald-950/20 dark:text-slate-200"><input type="checkbox" checked={groupManagement.settings.approve_new_members} onChange={(e) => updateGroupSettingsDraft({ approve_new_members: e.target.checked })} className="mt-0.5 accent-emerald-600"/><span><b>Approve new members</b><span className="mt-0.5 block text-slate-500">Ombi la kujiunga kupitia link/code litangoja admin alikubali.</span></span></label>
                  <label className="flex items-start gap-2 rounded-xl bg-emerald-50/70 p-2.5 text-xs text-slate-700 dark:bg-emerald-950/20 dark:text-slate-200"><input type="checkbox" checked={groupManagement.settings.allow_member_adds} onChange={(e) => updateGroupSettingsDraft({ allow_member_adds: e.target.checked })} className="mt-0.5 accent-emerald-600"/><span><b>Wanachama wanaweza kuongeza watu</b><span className="mt-0.5 block text-slate-500">Ukizima, ni admin pekee anayeweza kuongeza wanachama.</span></span></label>
                  </>}
                  <div><label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Disappearing messages</label><select value={groupManagement.settings.disappearing_messages_seconds ?? 0} disabled={!groupManagement.can_manage && groupManagement.settings.lock_disappearing_messages} onChange={(e) => updateGroupSettingsDraft({ disappearing_messages_seconds: Number(e.target.value) ? Number(e.target.value) as 86400|604800|7776000 : null })} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-[#0a171a] dark:text-white"><option value={0}>Zimezimwa</option><option value={86400}>Baada ya saa 24</option><option value={604800}>Baada ya siku 7</option><option value={7776000}>Baada ya siku 90</option></select></div>
                  {groupManagement.can_manage && <label className="flex items-start gap-2 rounded-xl bg-emerald-50/70 p-2.5 text-xs text-slate-700 dark:bg-emerald-950/20 dark:text-slate-200"><input type="checkbox" checked={groupManagement.settings.lock_disappearing_messages} onChange={(e) => updateGroupSettingsDraft({ lock_disappearing_messages: e.target.checked })} className="mt-0.5 accent-emerald-600"/><span><b>Admin pekee abadili muda wa kujifuta</b><span className="mt-0.5 block text-slate-500">Ukizima, wanachama wanaweza kubadili muda.</span></span></label>}
                  <button type="button" disabled={groupActionBusy || groupManagement.settings.title.trim().length < 3} onClick={() => void saveGroupSettings()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-600 disabled:opacity-50">{groupActionBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}Hifadhi mipangilio</button>
                </div>
                <div className="space-y-3">
                  {groupManagement.can_manage && <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-black/10"><h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Invite link / code</h4><p className="mt-1 text-xs text-slate-500">Code ya sasa: <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">{groupManagement.settings.invite_code}</span></p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { if (!navigator.clipboard) { setNotice('Browser hii hairuhusu kunakili moja kwa moja.'); return } void navigator.clipboard.writeText(groupManagement.settings.invite_code).then(() => setNotice('Invite code imenakiliwa.')).catch(() => setNotice('Imeshindikana kunakili invite code.')) }} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-200"><Copy className="h-4 w-4"/>Nakili</button><button type="button" disabled={groupActionBusy} onClick={() => void resetGroupInvite()} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200"><RefreshCw className="h-4 w-4"/>Reset link</button></div></div>}
                  <div className="rounded-2xl border border-emerald-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-black/10"><div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Wanachama ({groupManagement.members.length})</h4><span className="text-[10px] text-slate-500">{groupManagement.members.filter((m) => m.participant_role === 'admin').length} admins</span></div><div className="max-h-56 space-y-1 overflow-y-auto">{groupManagement.members.map((member) => <div key={member.user_id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-emerald-50/70 dark:hover:bg-white/5"><Avatar name={member.full_name} url={member.avatar_url} size="h-8 w-8"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{member.full_name}{member.is_creator ? ' · Creator' : ''}</span><span className="block truncate text-[10px] text-slate-500">@{member.username} · {member.participant_role === 'admin' ? 'Admin' : 'Member'}</span></span>{groupManagement.can_manage && !member.is_creator && <div className="flex shrink-0 items-center gap-1"><button type="button" disabled={groupActionBusy} title={member.participant_role === 'admin' ? 'Dismiss as admin' : 'Make group admin'} onClick={() => void changeGroupAdmin(member, member.participant_role !== 'admin')} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-950">{member.participant_role === 'admin' ? <UserCog className="h-4 w-4"/> : <Crown className="h-4 w-4"/>}</button><button type="button" disabled={groupActionBusy} title="Ondoa mwanachama" onClick={() => void removeGroupMember(member)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950/30"><UserMinus className="h-4 w-4"/></button></div>}</div>)}</div></div>
                  {groupManagement.can_manage && <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/20"><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-extrabold text-amber-950 dark:text-amber-100">Join requests</h4><span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">{groupManagement.requests.length}</span></div>{groupManagement.requests.length ? <div className="space-y-2">{groupManagement.requests.map((request) => <div key={request.id} className="flex items-center gap-2 rounded-xl bg-white/80 p-2 dark:bg-black/20"><Avatar name={request.full_name} url={request.avatar_url} size="h-8 w-8"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{request.full_name}</span><span className="text-[10px] text-slate-500">@{request.username} · {new Date(request.requested_at).toLocaleDateString('sw-TZ')}</span></span><button type="button" disabled={groupActionBusy} title="Approve" onClick={() => void reviewGroupRequest(request.id,'approved')} className="rounded-lg bg-emerald-600 p-2 text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4"/></button><button type="button" disabled={groupActionBusy} title="Reject" onClick={() => void reviewGroupRequest(request.id,'rejected')} className="rounded-lg bg-red-600 p-2 text-white disabled:opacity-40"><X className="h-4 w-4"/></button></div>)}</div> : <p className="text-xs text-amber-800 dark:text-amber-200">Hakuna maombi yanayosubiri.</p>}</div>}
                  <div className="flex flex-wrap gap-2">{!groupManagement.is_creator && <button type="button" disabled={groupActionBusy} onClick={() => void removeGroupMember({ user_id: myUserId, full_name: 'Wewe', username: '', avatar_url: null, participant_role: groupManagement.members.find((m) => m.user_id === myUserId)?.participant_role ?? 'member', joined_at: '', is_creator: false })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><LogOut className="h-4 w-4"/>Toka kwenye group</button>}{groupManagement.can_manage && <button type="button" disabled={groupActionBusy} onClick={() => void deleteGroup()} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-500 disabled:opacity-40"><Trash2 className="h-4 w-4"/>Futa group kwa wote</button>}</div>
                </div>
              </div>
            </>}
          </section>}
          <div className="sn-chat-thread min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5">
            {loadingMessages && !messages.length && <div className="space-y-3"><div className="shimmer-element h-12 w-2/3 rounded-2xl" /><div className="shimmer-element ml-auto h-12 w-1/2 rounded-2xl" /></div>}
            {!loadingMessages && messages.length === 0 && <div className="flex h-full min-h-56 flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><MessageCircle className="h-7 w-7" /></span><h3 className="mt-3 font-extrabold text-slate-900 dark:text-white">Anza mazungumzo</h3><p className="mt-1 max-w-xs text-sm text-slate-500">Salimia {activeConversation.other_full_name} na endeleeni kuwasiliana kuhusu masomo.</p></div>}
            {messages.map((message) => {
              const mine = message.sender_id === myUserId
              const parentMessage = message.reply_to_message_id ? messages.find((candidate) => candidate.id === message.reply_to_message_id) : null
              const messageReactions = reactions.filter((item) => item.message_id === message.id)
              const reactionCounts = QUICK_REACTIONS.map((emoji) => ({ emoji, count: messageReactions.filter((item) => item.reaction === emoji).length, mine: messageReactions.some((item) => item.user_id === myUserId && item.reaction === emoji) })).filter((item) => item.count > 0)
              return <div key={message.id} className={`sn-chat-message-row flex items-center gap-3 ${mine ? 'sn-chat-message-row-mine justify-end' : 'sn-chat-message-row-other justify-start'}`}>
                {!mine && <Avatar name={message.sender_name} url={message.sender_avatar} size="h-10 w-10 mr-0 mt-1" />}
                <div className={`sn-chat-message-bubble max-w-[90%] sm:max-w-[80%] ${mine ? 'sn-chat-message-bubble-mine' : 'sn-chat-message-bubble-other'}`}>
                  <p className={`sn-chat-message-heading mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] ${mine ? 'sn-chat-message-heading-mine' : 'sn-chat-message-heading-other'}`}>
                    {mine ? 'You' : message.sender_name}{activeConversation.conversation_type === 'group' && !mine ? ` · @${message.sender_username}` : ''}
                    <span className="ml-2 font-semibold normal-case tracking-normal opacity-75">{clock(message.created_at)}</span>
                  </p>
                  {parentMessage && <div className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-xs ${mine ? 'border-emerald-100 bg-emerald-700/50 text-emerald-50' : 'border-emerald-500 bg-emerald-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}><p className="font-bold">Umejibu {parentMessage.sender_name}</p><p className="line-clamp-2">{parentMessage.body}</p></div>}
                  {message.attachment_path && attachmentUrls[message.attachment_path] && !message.deleted_at && (() => {
                    const fileUrl = attachmentUrls[message.attachment_path!]
                    const fileName = message.attachment_path!.split('/').pop() ?? 'Kiambatisho'
                    if (message.message_type === 'image') {
                      if (lowDataMode && !revealedChatMedia[message.id]) {
                        return <button type="button" onClick={() => setRevealedChatMedia((current) => ({ ...current, [message.id]: true }))} className="mb-2 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-3 text-center text-xs font-bold dark:border-emerald-800"><ImagePlus className="h-5 w-5 text-emerald-600"/>Picha imefichwa kuokoa data — gusa kuiona</button>
                      }
                      return <div className="mb-2"><a href={fileUrl} target="_blank" rel="noreferrer"><img src={fileUrl} alt={`Picha kutoka ${message.sender_name}`} loading="lazy" decoding="async" className="max-h-72 max-w-full rounded-xl object-contain" /></a><a href={fileUrl} download={fileName} className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${mine ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}><Download className="h-3.5 w-3.5" /> Pakua picha</a></div>
                    }
                    if (message.message_type === 'audio') {
                      if (lowDataMode && !revealedChatMedia[message.id]) {
                        return <button type="button" onClick={() => setRevealedChatMedia((current) => ({ ...current, [message.id]: true }))} className="mb-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold dark:border-emerald-800"><Play className="h-4 w-4 text-emerald-600"/>Gusa kucheza sauti</button>
                      }
                      return <div className="mb-2 min-w-[220px] max-w-full"><audio controls preload="none" src={fileUrl} className="w-full"/><a href={fileUrl} download={fileName} className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${mine ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}><Download className="h-3.5 w-3.5" /> Pakua sauti</a></div>
                    }
                    if (message.message_type === 'video') {
                      if (lowDataMode && !revealedChatMedia[message.id]) {
                        return <button type="button" onClick={() => setRevealedChatMedia((current) => ({ ...current, [message.id]: true }))} className="mb-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold dark:border-emerald-800"><Play className="h-4 w-4 text-emerald-600"/>Gusa kupakia video</button>
                      }
                      return <div className="mb-2 max-w-full"><video controls playsInline preload={lowDataMode ? 'none' : 'metadata'} src={fileUrl} className="max-h-72 max-w-full rounded-xl"/><a href={fileUrl} download={fileName} className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${mine ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}><Download className="h-3.5 w-3.5" /> Pakua video</a></div>
                    }
                    return <a href={fileUrl} download={fileName} target="_blank" rel="noreferrer" className={`mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${mine ? 'border-white/25 bg-emerald-700/40 text-white' : 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-200'}`}><FileAudio className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all">{fileName}</span><Download className="h-4 w-4 shrink-0" /></a>
                  })()}
                  {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>}
                  <div className={`sn-chat-message-meta mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>{message.edited_at && !message.deleted_at && <span>imehaririwa</span>}{mine && <Check className="h-3.5 w-3.5" />}</div>
                  {reactionCounts.length > 0 && <div className="mt-1 flex flex-wrap justify-end gap-1">{reactionCounts.map((item) => <button key={item.emoji} type="button" onClick={() => void toggleReaction(message,item.emoji)} className={`rounded-full px-1.5 py-0.5 text-xs ${item.mine ? 'bg-white/30' : 'bg-black/5 dark:bg-white/10'}`}>{item.emoji} {item.count}</button>)}</div>}
                  {!message.deleted_at && <div className={`sn-chat-message-actions mt-2 flex flex-wrap items-center gap-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                    <button type="button" title="Jibu ujumbe" onClick={() => { setReplyTo(message); setEditingMessageId(null); setDraft('') }} className="rounded-md p-1 hover:bg-black/10"><Reply className="h-3.5 w-3.5" /></button>
                    <div className="group relative"><button type="button" title="React" onClick={() => setReactionMenuMessageId((current) => current === message.id ? null : message.id)} className="rounded-md p-1 hover:bg-black/10"><Smile className="h-3.5 w-3.5" /></button><div className={`absolute bottom-full left-0 z-20 gap-1 rounded-xl border border-emerald-100 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${reactionMenuMessageId === message.id ? 'flex' : 'hidden group-hover:flex'}`}>{QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => { void toggleReaction(message,emoji); setReactionMenuMessageId(null) }} className="rounded-lg p-1.5 text-base hover:bg-emerald-50 dark:hover:bg-slate-800">{emoji}</button>)}</div></div>
                    {mine && <button type="button" title="Hariri ujumbe" onClick={() => { setEditingMessageId(message.id); setReplyTo(null); setDraft(message.body) }} className="rounded-md p-1 hover:bg-black/10"><Pencil className="h-3.5 w-3.5" /></button>}
                    {(mine || (activeConversation.conversation_type === 'group' && groupManagement?.can_manage)) && <button type="button" title={mine ? 'Futa ujumbe' : 'Admin: Delete for everyone'} onClick={() => void deleteMessage(message)} className="rounded-md p-1 hover:bg-black/10"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>}
                </div>
                {mine && <Avatar name={myProfile.full_name || message.sender_name} url={myProfile.avatar_url ?? message.sender_avatar} size="h-10 w-10 ml-0 mt-1" />}
              </div>
            })}
            <div ref={bottomRef} />
          </div>
          {notice && <p className="mx-3 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{notice}</p>}
          {activeConversation.conversation_type === 'group' && groupManagement?.settings.send_messages_policy === 'admins' && !groupManagement.can_manage && <div className="mx-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Ma-admin pekee ndio wanaoweza kutuma ujumbe kwenye group hili.</div>}
          {pendingAttachment && <div className="mx-3 mb-2 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"/><span className="min-w-0 flex-1 truncate font-semibold text-slate-700 dark:text-slate-200">{pendingAttachment.name} · {(pendingAttachment.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" onClick={() => { setPendingAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="rounded-lg p-1 text-slate-500 hover:bg-white dark:hover:bg-slate-800" aria-label="Ondoa kiambatisho"><X className="h-4 w-4"/></button></div>
            {pendingAttachment.type.startsWith('audio/') && pendingAudioPreview && <div className="mt-2 flex items-center gap-2"><FileAudio className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"/><audio controls preload="metadata" src={pendingAudioPreview} className="h-9 min-w-0 flex-1"/><span className="shrink-0 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">Sauti</span></div>}
          </div>}
          {(replyTo || editingMessageId) && <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"><div className="min-w-0 flex-1"><p className="font-extrabold text-emerald-800 dark:text-emerald-200">{editingMessageId ? 'Hariri ujumbe' : `Unamjibu ${replyTo?.sender_name}`}</p><p className="truncate text-slate-500">{editingMessageId ? 'Badili maandishi kisha tuma.' : replyTo?.body}</p></div><button type="button" onClick={() => { setReplyTo(null); setEditingMessageId(null); setDraft('') }} aria-label="Ghairi reply au edit"><X className="h-4 w-4" /></button></div>}
          <form onSubmit={(e) => { e.preventDefault(); void sendMessage() }} className="sn-chat-composer flex items-end gap-1.5 border-t p-2.5 backdrop-blur-md sm:gap-2 sm:p-3">
            <span className="sn-chat-composer-avatar"><Avatar name={myProfile.full_name} url={myProfile.avatar_url} size="h-10 w-10" /></span>
            <label title="Ambatanisha picha, sauti au faili" className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-emerald-100 text-emerald-700 transition hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-900 ${(!canSendInActiveConversation) || editingMessageId || isRecordingVoice ? 'pointer-events-none opacity-40' : ''}`}><Paperclip className="h-5 w-5"/><input ref={fileInputRef} type="file" className="sr-only" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" disabled={(!canSendInActiveConversation) || Boolean(editingMessageId) || isRecordingVoice} onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; if (file && file.size > 10 * 1024 * 1024) { setNotice('Kiambatisho kisiwe zaidi ya 10 MB.'); event.currentTarget.value = ''; return } setPendingAttachment(file); setNotice(''); event.currentTarget.value = '' }}/></label>
            <button type="button" onClick={() => isRecordingVoice ? stopVoiceRecording() : void startVoiceRecording()} disabled={(!canSendInActiveConversation) || Boolean(editingMessageId) || sending} aria-label={isRecordingVoice ? 'Simamisha kurekodi sauti' : 'Rekodi ujumbe wa sauti'} title={isRecordingVoice ? `Simamisha kurekodi (${recordSeconds}s)` : 'Rekodi ujumbe wa sauti'} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-40 ${isRecordingVoice ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-600/20' : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300'}`}>{isRecordingVoice ? <><Square className="h-4 w-4 fill-current"/><span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">{recordSeconds}s</span></> : <Mic className="h-5 w-5"/>}</button>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }} rows={1} placeholder={isRecordingVoice ? 'Inarekodi sauti…' : activeConversation.conversation_type === 'group' || activeConversation.can_message ? 'Andika ujumbe...' : 'DM imezuiwa na mipangilio ya faragha'} disabled={isRecordingVoice || (!canSendInActiveConversation)} className="sn-chat-composer-input max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-[22px] border px-4 py-3 text-sm outline-none placeholder:text-slate-400 disabled:opacity-60" />
            <button type="submit" disabled={(!draft.trim() && !pendingAttachment) || sending || isRecordingVoice || (!canSendInActiveConversation)} aria-label="Tuma ujumbe" className="sn-chat-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
          </form>
        </> : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CircleUserRound className="h-10 w-10" /></span><h3 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">Chat ya SmartNekam</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Chagua mazungumzo upande wa kushoto au tafuta rafiki kwa username ili muanze chat. Ujumbe mpya utaonekana papo hapo realtime inapowezeshwa.</p><span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" /> Faragha na block rules zinatumika</span></div>}
      </div>
    </div>

    {notice && !selectedId && <div className="border-t border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{notice}</div>}
  </section>
}
