#!/usr/bin/env node
/**
 * Seeds the Firebase emulators with demo users and chats.
 * Requires Auth / Firestore / Storage / RTDB emulators to already be running.
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { randomUUID } from 'node:crypto'

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000'

const PROJECT = 'demo-dmapp'

const app = initializeApp({
  projectId: PROJECT,
  storageBucket: `${PROJECT}.appspot.com`,
  databaseURL: `http://127.0.0.1:9000?ns=${PROJECT}`,
})

const auth = getAuth(app)
const db = getFirestore(app, 'turboracer')
const bucket = getStorage(app).bucket()

const USERS = [
  { email: 'mina@demo.local', password: 'demo1234', username: 'mina', displayName: 'Mina', bio: 'Cafes on weekends, work on weekdays. Messages welcome.', link: 'https://example.com/mina', color: '#ec4899', initial: 'M' },
  { email: 'jun@demo.local', password: 'demo1234', username: 'jun', displayName: 'Jun', bio: 'I love taking photos.', link: '', color: '#14b8a6', initial: 'J' },
  { email: 'soyeon@demo.local', password: 'demo1234', username: 'soyeon', displayName: 'Soyeon', bio: 'Anyone up for a study session?', link: '', color: '#6d5efc', initial: 'S' },
  { email: 'haru@demo.local', password: 'demo1234', username: 'haru', displayName: 'Haru', bio: 'Just arrived. Nice to meet you!', link: '', color: '#f59e0b', initial: 'H' },
]

function svgAvatar(color, initial) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="128" fill="${color}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="120" fill="#ffffff" font-family="Pretendard, sans-serif" font-weight="700">${initial}</text>
</svg>`
}

function scenicSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7c6cff"/>
      <stop offset="1" stop-color="#f9a8d4"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#sky)"/>
  <circle cx="620" cy="140" r="54" fill="#fff7ed" opacity="0.9"/>
  <path d="M0 420 Q200 320 400 400 T800 360 V600 H0 Z" fill="#312e81"/>
  <path d="M0 480 Q220 400 420 470 T800 430 V600 H0 Z" fill="#1e1b4b"/>
</svg>`
}

async function resetEmulators() {
  const headers = { Authorization: 'Bearer owner' }
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE', headers })
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/turboracer/documents`, { method: 'DELETE', headers })
  // storage / rtdb leftover is fine; we'll overwrite
}

async function upload(path, body, contentType) {
  const token = randomUUID()
  const file = bucket.file(path)
  await file.save(body, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  })
  return `http://127.0.0.1:9199/v0/b/${PROJECT}.appspot.com/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

function ago(minutes) {
  return Timestamp.fromMillis(Date.now() - minutes * 60 * 1000)
}

async function main() {
  console.log('Seeding emulators…')
  await resetEmulators()

  const created = {}
  for (const u of USERS) {
    const rec = await auth.createUser({
      email: u.email,
      password: u.password,
      displayName: u.displayName,
      emailVerified: true,
    })
    const photoURL = await upload(`avatars/${rec.uid}/avatar.svg`, svgAvatar(u.color, u.initial), 'image/svg+xml')
    await db.doc(`dmly/app/users/${rec.uid}`).set({
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      link: u.link,
      photoURL,
      createdAt: FieldValue.serverTimestamp(),
    })
    await db.doc(`dmly/app/usernames/${u.username}`).set({ uid: rec.uid })
    created[u.username] = { ...u, uid: rec.uid, photoURL }
    console.log(`  user @${u.username} ${rec.uid}`)
  }

  const mina = created.mina
  const jun = created.jun
  const soyeon = created.soyeon

  const info = (...people) =>
    Object.fromEntries(people.map((p) => [p.uid, { displayName: p.displayName, username: p.username, photoURL: p.photoURL }]))

  // 1) accepted DM mina <-> jun
  const dmId = [mina.uid, jun.uid].sort().join('_')
  const cafeUrl = await upload(`chat-media/${dmId}/cafe.svg`, scenicSvg(), 'image/svg+xml')

  const msgs = [
    { from: jun, text: 'What time should we meet today?', min: 180, type: 'text' },
    { from: mina, text: 'How about 7? Near downtown.', min: 175, type: 'text' },
    { from: jun, text: 'Sounds good, see you then!', min: 170, type: 'text' },
    { from: mina, text: '', min: 80, type: 'photo', photoURL: cafeUrl },
    { from: jun, text: 'The vibe here is great :)', min: 70, type: 'text', heartFrom: mina },
    { from: mina, text: 'Text me when you get there', min: 20, type: 'text' },
  ]

  await db.doc(`dmly/app/chats/${dmId}`).set({
    type: 'dm',
    memberIds: [mina.uid, jun.uid],
    memberInfo: info(mina, jun),
    createdBy: jun.uid,
    createdAt: ago(200),
    lastMessage: { text: 'Text me when you get there', senderId: mina.uid, type: 'text', createdAt: ago(20) },
    lastMessageAt: ago(20),
    unread: { [mina.uid]: 0, [jun.uid]: 1 },
    requestStatus: 'accepted',
    themeColor: '#5b4bdb',
  })

  for (const m of msgs) {
    const createdAt = ago(m.min)
    const readBy = {
      [m.from.uid]: createdAt,
      [m.from.uid === mina.uid ? jun.uid : mina.uid]: ago(m.min - 2),
    }
    // last message from mina not yet read by jun (he's "away")
    if (m === msgs[msgs.length - 1]) delete readBy[jun.uid]
    const ref = db.collection(`dmly/app/chats/${dmId}/messages`).doc()
    await ref.set({
      senderId: m.from.uid,
      text: m.text,
      type: m.type,
      photoURL: m.photoURL ?? null,
      createdAt,
      unsent: false,
      reactions: m.heartFrom ? { [m.heartFrom.uid]: 'heart' } : {},
      readBy,
    })
  }

  // 2) pending request soyeon -> mina
  const reqId = [soyeon.uid, mina.uid].sort().join('_')
  const reqAt = ago(8)
  await db.doc(`dmly/app/chats/${reqId}`).set({
    type: 'dm',
    memberIds: [soyeon.uid, mina.uid],
    memberInfo: info(soyeon, mina),
    createdBy: soyeon.uid,
    createdAt: reqAt,
    lastMessage: { text: 'Hi! I found your profile. Is there still a spot in next week\'s study group?', senderId: soyeon.uid, type: 'text', createdAt: reqAt },
    lastMessageAt: reqAt,
    unread: { [soyeon.uid]: 0, [mina.uid]: 1 },
    requestStatus: 'pending',
    requestFrom: soyeon.uid,
  })
  await db.collection(`dmly/app/chats/${reqId}/messages`).add({
    senderId: soyeon.uid,
    text: 'Hi! I found your profile. Is there still a spot in next week\'s study group?',
    type: 'text',
    createdAt: reqAt,
    unsent: false,
    reactions: {},
    readBy: { [soyeon.uid]: reqAt },
  })

  // 3) group chat
  const groupRef = db.collection('dmly/app/chats').doc()
  const gMsgs = [
    { from: mina, text: 'Who\'s in for Saturday brunch?', min: 50 },
    { from: jun, text: "I'm in", min: 46 },
    { from: soyeon, text: 'What time works?', min: 40 },
  ]
  await groupRef.set({
    type: 'group',
    title: 'Weekend hangout',
    memberIds: [mina.uid, jun.uid, soyeon.uid],
    memberInfo: info(mina, jun, soyeon),
    createdBy: mina.uid,
    createdAt: ago(60),
    lastMessage: { text: 'What time works?', senderId: soyeon.uid, type: 'text', createdAt: ago(40) },
    lastMessageAt: ago(40),
    unread: { [mina.uid]: 1, [jun.uid]: 1, [soyeon.uid]: 0 },
    requestStatus: 'accepted',
    themeColor: '#ec4899',
  })
  for (const m of gMsgs) {
    const createdAt = ago(m.min)
    await groupRef.collection('messages').add({
      senderId: m.from.uid,
      text: m.text,
      type: 'text',
      createdAt,
      unsent: false,
      reactions: {},
      readBy: { [m.from.uid]: createdAt },
    })
  }


  // Follows
  await db.doc(`dmly/app/users/${mina.uid}/following/${jun.uid}`).set({ createdAt: ago(100) })
  await db.doc(`dmly/app/users/${jun.uid}/followers/${mina.uid}`).set({ createdAt: ago(100) })
  await db.doc(`dmly/app/users/${mina.uid}/following/${soyeon.uid}`).set({ createdAt: ago(90) })
  await db.doc(`dmly/app/users/${soyeon.uid}/followers/${mina.uid}`).set({ createdAt: ago(90) })
  await db.doc(`dmly/app/users/${jun.uid}/following/${mina.uid}`).set({ createdAt: ago(80) })
  await db.doc(`dmly/app/users/${mina.uid}/followers/${jun.uid}`).set({ createdAt: ago(80) })

  const cafeUrl2 = cafeUrl
  const p1 = db.collection('dmly/app/posts').doc()
  await p1.set({
    authorId: mina.uid,
    authorName: mina.displayName,
    authorUsername: mina.username,
    authorPhoto: mina.photoURL,
    text: 'The sunset looks gorgeous today. Warming up for weekend brunch 🌅',
    photoURLs: [cafeUrl2],
    createdAt: ago(30),
    likeCount: 2,
    commentCount: 1,
  })
  await p1.collection('likes').doc(jun.uid).set({ createdAt: ago(25) })
  await p1.collection('likes').doc(soyeon.uid).set({ createdAt: ago(22) })
  await p1.collection('comments').add({
    authorId: jun.uid,
    authorName: jun.displayName,
    authorPhoto: jun.photoURL,
    text: 'Amazing vibe — great shot!',
    createdAt: ago(24),
  })

  const p2 = db.collection('dmly/app/posts').doc()
  await p2.set({
    authorId: jun.uid,
    authorName: jun.displayName,
    authorUsername: jun.username,
    authorPhoto: jun.photoURL,
    text: 'Lost to Mina in reaction speed. Rematch, please.',
    photoURLs: [],
    createdAt: ago(12),
    likeCount: 1,
    commentCount: 0,
  })
  await p2.collection('likes').doc(mina.uid).set({ createdAt: ago(10) })

  const p3 = db.collection('dmly/app/posts').doc()
  await p3.set({
    authorId: soyeon.uid,
    authorName: soyeon.displayName,
    authorUsername: soyeon.username,
    authorPhoto: soyeon.photoURL,
    text: 'Looking for a study group! Message me if you\'re interested.',
    photoURLs: [],
    createdAt: ago(6),
    likeCount: 0,
    commentCount: 0,
  })

  const stats = [
    [mina, { ttt: [3, 1, 0], rps: [2, 2, 1], react: [4, 1, 0] }],
    [jun, { ttt: [1, 3, 0], rps: [2, 2, 1], react: [1, 4, 0] }],
    [soyeon, { ttt: [0, 0, 0], rps: [1, 0, 0], react: [2, 1, 1] }],
  ]
  for (const [u, games] of stats) {
    let wins = 0, losses = 0, draws = 0, plays = 0
    for (const [type, [w, l, d]] of Object.entries(games)) {
      await db.doc(`dmly/app/users/${u.uid}/gameStats/${type}`).set({ wins: w, losses: l, draws: d, plays: w + l + d })
      wins += w; losses += l; draws += d; plays += w + l + d
    }
    await db.doc(`dmly/app/leaderboard/${u.uid}`).set({
      displayName: u.displayName, username: u.username, photoURL: u.photoURL, wins, losses, draws, plays,
    })
  }


  // Calendar events (a day or two out so reminder toasts do not fire during e2e)
  const brunchAt = new Date()
  brunchAt.setDate(brunchAt.getDate() + 2)
  brunchAt.setHours(11, 0, 0, 0)
  const evShared = db.collection('dmly/app/events').doc()
  await evShared.set({
    title: 'Weekend brunch',
    note: 'The usual spot — save me a seat.',
    color: '#FF4D3A',
    allDay: false,
    startAt: Timestamp.fromDate(brunchAt),
    endAt: Timestamp.fromDate(new Date(brunchAt.getTime() + 2 * 3600 * 1000)),
    ownerId: mina.uid,
    chatId: groupRef.id,
    memberIds: [mina.uid, jun.uid, soyeon.uid],
    createdAt: ago(8),
    updatedAt: ago(8),
  })
  await evShared.collection('rsvp').doc(mina.uid).set({ status: 'going', updatedAt: ago(8) })

  const studioAt = new Date()
  studioAt.setDate(studioAt.getDate() + 1)
  studioAt.setHours(15, 0, 0, 0)
  await db.collection('dmly/app/events').add({
    title: 'Studio time',
    note: 'Deep work block. Headphones on.',
    color: '#7B5CFF',
    allDay: false,
    startAt: Timestamp.fromDate(studioAt),
    endAt: Timestamp.fromDate(new Date(studioAt.getTime() + 2 * 3600 * 1000)),
    ownerId: mina.uid,
    chatId: null,
    memberIds: [mina.uid],
    createdAt: ago(3),
    updatedAt: ago(3),
  })

  console.log('Seed complete.')
  console.log('  Demo password for all accounts: demo1234')
  console.log('  mina / jun / soyeon / haru  @  *@demo.local')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
