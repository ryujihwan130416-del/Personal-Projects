import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const toast = useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2400)
  }, [])
  const value = useMemo(() => toast, [toast])
  return (
    <Ctx.Provider value={value}>
      {children}
      {msg ? <div className="toast" role="status" data-testid="toast">{msg}</div> : null}
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
