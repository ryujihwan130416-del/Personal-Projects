import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { I18nProvider } from './i18n'
import { ToastProvider } from './components/Toast'
import { ConfirmHost } from './components/ConfirmDialog'
import { AppShell, PublicOnly } from './layout/AppShell'
import { LoginPage, SignupPage } from './pages/AuthPages'
import { ChatPage } from './pages/Chat'
import { UiEngine } from './lib/uiConfig'

const FeedPage = lazy(() => import('./pages/Feed').then((m) => ({ default: m.FeedPage })))
const ComposePage = lazy(() => import('./pages/Feed').then((m) => ({ default: m.ComposePage })))
const PostDetailPage = lazy(() => import('./pages/Feed').then((m) => ({ default: m.PostDetailPage })))
const NewGroupPage = lazy(() => import('./pages/NewGroup').then((m) => ({ default: m.NewGroupPage })))
const MyProfilePage = lazy(() => import('./pages/ProfilePages').then((m) => ({ default: m.MyProfilePage })))
const EditProfilePage = lazy(() => import('./pages/ProfilePages').then((m) => ({ default: m.EditProfilePage })))
const UserProfilePage = lazy(() => import('./pages/ProfilePages').then((m) => ({ default: m.UserProfilePage })))
const SearchPage = lazy(() => import('./pages/Search').then((m) => ({ default: m.SearchPage })))

const UiPreviewPage = lazy(() => import('./pages/UiPreview').then((m) => ({ default: m.UiPreviewPage })))

const GamesHubPage = lazy(() => import('./pages/GamesHub').then((m) => ({ default: m.GamesHubPage })))
const GameRoomPage = lazy(() => import('./pages/GamesHub').then((m) => ({ default: m.GameRoomPage })))

const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })))
const EventDetailPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.EventDetailPage })))

const AdminPage = lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminPage })))
const ProfileCustomizePage = lazy(() => import('./pages/ProfileCustomize').then((m) => ({ default: m.ProfileCustomizePage })))
const FriendsPage = lazy(() => import('./pages/Friends').then((m) => ({ default: m.FriendsPage })))
const AddFriendRedirect = lazy(() => import('./pages/Friends').then((m) => ({ default: m.AddFriendRedirect })))
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })))

export default function App() {
  return (
    <I18nProvider>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CallProvider>
            <UiEngine />
            <ConfirmHost />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
                <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
                <Route path="/ui-preview" element={<Suspense fallback={<div className="spinner" />}><UiPreviewPage /></Suspense>} />
                <Route element={<AppShell />}>
                  <Route index element={null} />
                  <Route path="requests" element={null} />
                  <Route path="archived" element={null} />
                  <Route path="chat/:chatId" element={<ChatPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="profile" element={<MyProfilePage />} />
                  <Route path="profile/edit" element={<EditProfilePage />} />
                  <Route path="profile/customize" element={<ProfileCustomizePage />} />
                  <Route path="friends" element={<FriendsPage />} />
                  <Route path="add/:username" element={<AddFriendRedirect />} />
                  <Route path="u/:username" element={<UserProfilePage />} />
                  <Route path="new-group" element={<NewGroupPage />} />
                  <Route path="feed" element={<FeedPage />} />
                  <Route path="compose" element={<ComposePage />} />
                  <Route path="post/:postId" element={<PostDetailPage />} />
                  <Route path="games" element={<GamesHubPage />} />
                  <Route path="games/:roomId" element={<GameRoomPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="event/:eventId" element={<EventDetailPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </CallProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
    </I18nProvider>
  )
}
