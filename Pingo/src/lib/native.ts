/**
 * Bridge to the Android app (Capacitor). On the web every call is a harmless no-op.
 * Native side: android/app/src/main/java/app/pingo/messenger/PingoNativePlugin.java
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface NativeStatus { notifications: boolean; batteryExempt: boolean; fullScreen: boolean; foreground: boolean; service: boolean; sdk: number }
interface PingoNativePlugin {
  startBackground(o: { title: string; text: string }): Promise<void>
  stopBackground(): Promise<void>
  status(): Promise<NativeStatus>
  requestNotifications(): Promise<{ granted: boolean }>
  requestBatteryExemption(): Promise<void>
  requestFullScreen(): Promise<void>
  notify(o: { id: number; title: string; body: string; url: string }): Promise<void>
  cancel(o: { id: number }): Promise<void>
  incomingCall(o: { title: string; body: string; url: string; video: boolean; key?: string }): Promise<void>
  cancelCall(): Promise<void>
  /** Credentials for the service's own Realtime Database stream (instant notifications while asleep). Empty uid = stop. */
  setPushAuth(o: { uid: string; refreshToken: string; apiKey: string; dbUrl: string; blocked: string[] }): Promise<void>
  addListener(ev: 'open', cb: (d: { url: string }) => void): Promise<PluginListenerHandle>
  addListener(ev: 'appState', cb: (d: { active: boolean }) => void): Promise<PluginListenerHandle>
}

export const isNative = Capacitor.isNativePlatform()
export const PingoNative = registerPlugin<PingoNativePlugin>('PingoNative')

/** Whether the user is looking at Pingo right now (tab visible / app in the foreground). */
let nativeActive = true
export function appActive() {
  if (isNative) return nativeActive
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}
if (isNative) void PingoNative.addListener('appState', (d) => { nativeActive = d.active }).catch(() => {})

/** Same, but asks the Android side directly (its foreground flag is the source of truth). */
export async function appActiveNow(): Promise<boolean> {
  if (!isNative) return appActive()
  try { const s = await PingoNative.status(); nativeActive = s.foreground; return s.foreground } catch { return nativeActive }
}

export const safe = async <T,>(p: () => Promise<T>): Promise<T | undefined> => { try { return await p() } catch { return undefined } }
