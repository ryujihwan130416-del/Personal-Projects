import { useEffect, useRef } from 'react'
import { useCall } from '../contexts/CallContext'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './Avatar'
import { IconCamOff, IconCamera, IconHangup, IconMic, IconMicOff, IconPhone, IconVideo } from './Icons'
import type { ChatMemberInfo } from '../types'
import { useT } from '../i18n'

export function IncomingCall({ peer }: { peer?: ChatMemberInfo }) {
  const { phase, call, acceptCall, declineCall } = useCall()
  const t = useT()
  if (phase !== 'incoming' || !call) return null
  const name = peer?.displayName ?? t('call.peer')
  return (
    <div className="incoming" data-testid="incoming-call">
      <div className="call-fg">
        <Avatar name={name} photoURL={peer?.photoURL} size={112} />
        <h2>{name}</h2>
        <p>{call.type === 'video' ? t('call.video') : t('call.audio')}</p>
      </div>
      <div className="call-actions">
        <button type="button" className="call-btn hang" onClick={() => void declineCall()} aria-label={t('call.decline')} data-testid="decline-call">
          <IconHangup />
        </button>
        <button type="button" className="call-btn accept" onClick={() => void acceptCall()} aria-label={t('call.accept')} data-testid="accept-call">
          {call.type === 'video' ? <IconVideo /> : <IconPhone />}
        </button>
      </div>
    </div>
  )
}

export function CallScreen({ peer }: { peer?: ChatMemberInfo }) {
  const t = useT()
  const { phase, call, localStream, remoteStream, muted, cameraOff, hangUp, toggleMute, toggleCamera } = useCall()
  const remoteRef = useRef<HTMLVideoElement>(null)
  const localRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream
    }
  }, [remoteStream])
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream
    }
  }, [localStream])

  if (phase === 'idle' || phase === 'incoming' || !call) return null
  const name = peer?.displayName ?? t('call.peer')
  const isVideo = call.type === 'video'
  const label = phase === 'outgoing' ? t('call.outgoing') : phase === 'connecting' ? t('call.connecting') : t('call.inCall')
  return (
    <div className="call-screen" data-testid="call-screen" data-phase={phase}>
      {isVideo && remoteStream ? (
        <video className="remote" ref={remoteRef} autoPlay playsInline />
      ) : null}
      {isVideo && localStream ? (
        <video className="local" ref={localRef} autoPlay playsInline muted />
      ) : null}
      <div className="call-fg">
        {!(isVideo && remoteStream) ? <Avatar name={name} photoURL={peer?.photoURL} size={112} /> : null}
        <h2>{name}</h2>
        <p data-testid="call-status">{label}</p>
      </div>
      <div className="call-actions">
        <button type="button" className={`call-btn ${muted ? 'on' : ''}`} onClick={toggleMute} aria-label={t('call.mute')} data-testid="toggle-mute">
          {muted ? <IconMicOff /> : <IconMic />}
        </button>
        {isVideo ? (
          <button type="button" className={`call-btn ${cameraOff ? 'on' : ''}`} onClick={toggleCamera} aria-label={t('call.camera')} data-testid="toggle-camera">
            {cameraOff ? <IconCamOff /> : <IconCamera />}
          </button>
        ) : null}
        <button type="button" className="call-btn hang" onClick={() => void hangUp()} aria-label={t('call.hangup')} data-testid="hangup">
          <IconHangup />
        </button>
      </div>
    </div>
  )
}

export function usePeerInfo(callPeerId?: string, memberInfo?: Record<string, ChatMemberInfo>) {
  const { user } = useAuth()
  const id = callPeerId
  if (!id || id === user?.uid) return undefined
  return memberInfo?.[id]
}
