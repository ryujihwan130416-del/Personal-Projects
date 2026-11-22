import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { rtdb } from '../firebase/app'
import type { Presence } from '../types'

export function usePresenceMap(uids: string[]) {
  const [map, setMap] = useState<Record<string, Presence>>({})
  const key = uids.slice().sort().join(',')
  useEffect(() => {
    if (!uids.length) return
    const uns: Array<() => void> = []
    for (const uid of uids) {
      uns.push(
        onValue(ref(rtdb, `dmly/presence/${uid}`), (snap) => {
          const val = snap.val() as Presence | null
          setMap((prev) => ({
            ...prev,
            [uid]: val ?? { state: 'offline', lastActive: 0 },
          }))
        }),
      )
    }
    return () => uns.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

export function useTyping(chatId: string | undefined, myUid: string | undefined) {
  const [typers, setTypers] = useState<string[]>([])
  useEffect(() => {
    if (!chatId) return
    return onValue(ref(rtdb, `dmly/typing/${chatId}`), (snap) => {
      const val = (snap.val() as Record<string, boolean> | null) ?? {}
      const next = Object.keys(val).filter((id) => val[id] && id !== myUid)
      setTypers((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next))
    })
  }, [chatId, myUid])
  return typers
}

export const THEME_COLORS = ['#5b4bdb', '#3797F0', '#ed4956', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#111111']
