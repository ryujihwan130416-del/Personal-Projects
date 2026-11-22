import { APP_NAME } from './firebase/config'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installImeGuard } from './lib/ime'

installImeGuard()

document.title = APP_NAME

createRoot(document.getElementById('root')!).render(<App />)
