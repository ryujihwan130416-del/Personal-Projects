import { pingMembers } from '../lib/pushPing'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, fsCol } from '../firebase/app'
import { iceServers } from '../firebase/config'
import type { CallDoc, CallType } from '../types'
import { useAuth } from './AuthContext'
import { t } from '../i18n'

type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active'

type CallCtx = {
  phase: CallPhase
  call: CallDoc | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  muted: boolean
  cameraOff: boolean
  startCall: (opts: { chatId: string; peerId: string; type: CallType }) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => Promise<void>
  hangUp: () => Promise<void>
  toggleMute: () => void
  toggleCamera: () => void
}

const Ctx = createContext<CallCtx | null>(null)

function asCall(id: string, data: Record<string, unknown>): CallDoc {
  return {
    id,
    chatId: String(data.chatId ?? ''),
    callerId: String(data.callerId ?? ''),
    calleeId: String(data.calleeId ?? ''),
    participantIds: (data.participantIds as string[]) ?? [],
    type: (data.type as CallType) ?? 'audio',
    status: (data.status as CallDoc['status']) ?? 'ended',
    offer: data.offer as CallDoc['offer'],
    answer: data.answer as CallDoc['answer'],
    createdAt: (data.createdAt as CallDoc['createdAt']) ?? null,
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [call, setCall] = useState<CallDoc | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const unsubCall = useRef<(() => void) | null>(null)
  const unsubIce = useRef<(() => void) | null>(null)
  const ending = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const cleanupMedia = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    pcRef.current?.close()
    pcRef.current = null
    pendingIce.current = []
    unsubCall.current?.()
    unsubIce.current?.()
    unsubCall.current = null
    unsubIce.current = null
    setMuted(false)
    setCameraOff(false)
  }, [])

  const hangUpInternal = useCallback(async (callId?: string) => {
    if (ending.current) return
    ending.current = true
    const id = callId ?? call?.id
    cleanupMedia()
    setPhase('idle')
    setCall(null)
    if (id) {
      const peer = call ? (call.callerId === user?.uid ? call.calleeId : call.callerId) : null
      if (peer && user) pingMembers(user.uid, [peer], `${id}-end`, { kind: 'call-end', chatId: call?.chatId ?? '', title: 'end' })
      try {
        await updateDoc(doc(db, ...fsCol('calls', id)), { status: 'ended' })
      } catch {
        /* already ended */
      }
    }
    ending.current = false
  }, [call, cleanupMedia, user])

  const attachIce = useCallback((pc: RTCPeerConnection, callId: string, uid: string) => {
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      void addDoc(collection(db, ...fsCol('calls', callId, 'candidates')), {
        from: uid,
        candidate: ev.candidate.toJSON(),
      }).catch((err) => console.error('[ice write]', err))
    }
    pc.ontrack = (ev) => {
      setRemoteStream(ev.streams[0] ?? new MediaStream(ev.track ? [ev.track] : []))
    }
    const maybeActive = () => {
      if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setPhase('active')
      }
    }
    pc.onconnectionstatechange = () => {
      maybeActive()
      if (pc.connectionState === 'failed') void hangUpInternal(callId)
    }
    pc.oniceconnectionstatechange = () => maybeActive()

    unsubIce.current?.()
    unsubIce.current = onSnapshot(collection(db, ...fsCol('calls', callId, 'candidates')), (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== 'added') return
        const data = ch.doc.data()
        if (data.from === uid || !data.candidate) return
        const cand = data.candidate as RTCIceCandidateInit
        if (pc.remoteDescription) {
          void pc.addIceCandidate(new RTCIceCandidate(cand))
        } else {
          pendingIce.current.push(cand)
        }
      })
    })
  }, [hangUpInternal])

  const flushIce = async (pc: RTCPeerConnection) => {
    const queued = pendingIce.current.splice(0)
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      } catch {
        /* ignore */
      }
    }
  }

  const openMedia = async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    })
    localRef.current = stream
    setLocalStream(stream)
    setCameraOff(type !== 'video')
    return stream
  }

  const makePc = (stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4, bundlePolicy: 'max-bundle' })
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    pcRef.current = pc
    if (import.meta.env.DEV) (window as unknown as { __dmlyPc?: RTCPeerConnection }).__dmlyPc = pc
    return pc
  }

  const watchCallDoc = (callId: string, role: 'caller' | 'callee') => {
    unsubCall.current?.()
    unsubCall.current = onSnapshot(doc(db, ...fsCol('calls', callId)), async (snap) => {
      const data = snap.data()
      if (!data) return
      const next = asCall(snap.id, data)
      setCall(next)
      if (next.status === 'ended') {
        await hangUpInternal()
        return
      }
      const pc = pcRef.current
      if (role === 'caller' && next.answer && pc && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(next.answer as RTCSessionDescriptionInit))
        await flushIce(pc)
      }
    })
  }

  const startCall = async ({ chatId, peerId, type }: { chatId: string; peerId: string; type: CallType }) => {
    if (!user) return
    ending.current = false
    const callRef = doc(collection(db, ...fsCol('calls')))
    const base = {
      chatId,
      callerId: user.uid,
      calleeId: peerId,
      participantIds: [user.uid, peerId],
      type,
      status: 'ringing' as const,
      createdAt: serverTimestamp(),
    }
    await setDoc(callRef, base)
    pingMembers(user.uid, [peerId], callRef.id, { kind: 'call', chatId, title: profile?.displayName || user.displayName || 'Pingo', video: type === 'video' })
    setCall(asCall(callRef.id, base))
    setPhase('outgoing')
    watchCallDoc(callRef.id, 'caller')
    const stream = await openMedia(type)
    const pc = makePc(stream)
    attachIce(pc, callRef.id, user.uid)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } })
  }

  const acceptCall = async () => {
    if (!user || !call) return
    ending.current = false
    const stream = await openMedia(call.type)
    const pc = makePc(stream)
    attachIce(pc, call.id, user.uid)
    if (!call.offer) throw new Error(t('call.missingOffer'))
    await pc.setRemoteDescription(new RTCSessionDescription(call.offer as RTCSessionDescriptionInit))
    await flushIce(pc)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await updateDoc(doc(db, ...fsCol('calls', call.id)), {
      answer: { type: answer.type, sdp: answer.sdp },
      status: 'active',
    })
    setPhase('connecting')
    watchCallDoc(call.id, 'callee')
  }

  const declineCall = async () => {
    await hangUpInternal(call?.id)
  }

  const hangUp = async () => {
    await hangUpInternal(call?.id)
  }

  const toggleMute = () => {
    const next = !muted
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
    setMuted(next)
  }

  const toggleCamera = () => {
    const next = !cameraOff
    localRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next
    })
    setCameraOff(next)
  }

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, ...fsCol('calls')),
      where('participantIds', 'array-contains', user.uid),
    )
    const unsub = onSnapshot(q, (snap) => {
      if (phaseRef.current !== 'idle') return
      const incoming = snap.docs
        .map((d) => asCall(d.id, d.data()))
        .filter((c) => c.status === 'ringing' || c.status === 'active')
        .find((c) => c.status === 'ringing' && c.callerId !== user.uid && c.offer)
      if (incoming) {
        setCall(incoming)
        setPhase('incoming')
        unsubCall.current?.()
        unsubCall.current = onSnapshot(doc(db, ...fsCol('calls', incoming.id)), (cs) => {
          const data = cs.data()
          if (!data || data.status === 'ended') {
            void hangUpInternal(incoming.id)
          }
        })
      }
    })
    return unsub
    // only re-subscribe when the user changes; phase is read from closure on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  useEffect(() => () => cleanupMedia(), [cleanupMedia])

  const value = {
    phase,
    call,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCall() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCall')
  return ctx
}
