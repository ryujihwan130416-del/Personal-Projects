#!/usr/bin/env node
/**
 * Seeds DMly demo accounts and namespace data on lumen-fcf2f.
 * - Auth: create mina/jun/soyeon/haru @demo.local only if they do not exist.
 *   Never updates or deletes other users.
 * - Firestore: only writes under dmly/app/... on the turboracer database.
 * - RTDB: only writes under /dmly/...
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const cfg = JSON.parse(readFileSync(homedir() + '/.config/configstore/firebase-tools.json', 'utf8'))
if (!cfg.tokens?.refresh_token) {
  console.error('No Firebase CLI refresh token')
  process.exit(1)
}

const adcPath = join(tmpdir(), `dmly-adc-${process.pid}.json`)
writeFileSync(adcPath, JSON.stringify({
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: cfg.tokens.refresh_token,
}), { mode: 0o600 })
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath
process.on('exit', () => { try { unlinkSync(adcPath) } catch {} })

const PROJECT = 'lumen-fcf2f'
const app = initializeApp({
  projectId: PROJECT,
  credential: applicationDefault(),
})

const auth = getAuth(app)
const db = getFirestore(app, 'turboracer')
const ROOT = 'dmly/app'

const USERS = [
  { email: 'mina@demo.local', password: 'demo1234', username: 'mina', displayName: 'Mina', bio: 'Cafes on weekends, work on weekdays. Messages welcome.', link: 'https://example.com/mina', color: '#ec4899', initial: 'M' },
  { email: 'jun@demo.local', password: 'demo1234', username: 'jun', displayName: 'Jun', bio: 'I love taking photos.', link: '', color: '#14b8a6', initial: 'J' },
  { email: 'soyeon@demo.local', password: 'demo1234', username: 'soyeon', displayName: 'Soyeon', bio: 'Anyone up for a study session?', link: '', color: '#6d5efc', initial: 'S' },
  { email: 'haru@demo.local', password: 'demo1234', username: 'haru', displayName: 'Haru', bio: 'Just arrived. Nice to meet you!', link: '', color: '#f59e0b', initial: 'H' },
]

function svgDataUrl(color, initial) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="${color}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="120" fill="#ffffff" font-family="sans-serif" font-weight="700">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function scenicDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c6cff"/><stop offset="1" stop-color="#f9a8d4"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="620" cy="140" r="54" fill="#fff7ed" opacity="0.9"/><path d="M0 420 Q200 320 400 400 T800 360 V600 H0 Z" fill="#312e81"/><path d="M0 480 Q220 400 420 470 T800 430 V600 H0 Z" fill="#1e1b4b"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function ago(minutes) {
  return Timestamp.fromMillis(Date.now() - minutes * 60 * 1000)
}

async function getOrCreateUser(u) {
  try {
    const existing = await auth.getUserByEmail(u.email)
    console.log(`  auth exists ${u.email} ${existing.uid} (left unchanged)`)
    return existing
  } catch (err) {
    if (err?.code !== 'auth/user-not-found' && err?.errorInfo?.code !== 'auth/user-not-found') throw err
    const rec = await auth.createUser({
      email: u.email,
      password: u.password,
      displayName: u.displayName,
      emailVerified: true,
    })
    console.log(`  auth created ${u.email} ${rec.uid}`)
    return rec
  }
}

async function main() {
  console.log('Seeding DMly production namespace on lumen-fcf2f / turboracer...')
  const created = {}
  for (const u of USERS) {
    const rec = await getOrCreateUser(u)
    const photoURL = svgDataUrl(u.color, u.initial)
    await db.doc(`${ROOT}/users/${rec.uid}`).set({
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      link: u.link,
      photoURL,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    await db.doc(`${ROOT}/usernames/${u.username}`).set({ uid: rec.uid })
    created[u.username] = { ...u, uid: rec.uid, photoURL }
  }

  const mina = created.mina
  const jun = created.jun
  const soyeon = created.soyeon
  const haru = created.haru

  const info = (...people) =>
    Object.fromEntries(people.map((p) => [p.uid, { displayName: p.displayName, username: p.username, photoURL: p.photoURL }]))

  const dmId = [mina.uid, jun.uid].sort().join('_')
  const cafeUrl = scenicDataUrl()
  const msgs = [
    { from: jun, text: 'What time should we meet today?', min: 180, type: 'text' },
    { from: mina, text: 'How about 7? Near downtown.', min: 175, type: 'text' },
    { from: jun, text: 'Perfect. I found a new cafe!', min: 40, type: 'text' },
    { from: jun, text: '', min: 38, type: 'photo', photoURL: cafeUrl },
    { from: mina, text: 'Looks great. See you soon!', min: 5, type: 'text' },
  ]
  await db.doc(`${ROOT}/chats/${dmId}`).set({
    type: 'dm',
    memberIds: [mina.uid, jun.uid],
    memberInfo: info(mina, jun),
    createdBy: jun.uid,
    requestStatus: 'accepted',
    requestFrom: jun.uid,
    lastMessage: 'Looks great. See you soon!',
    lastMessageAt: ago(5),
    lastSenderId: mina.uid,
    unread: { [mina.uid]: 0, [jun.uid]: 1 },
  })
  const existingMsgs = await db.collection(`${ROOT}/chats/${dmId}/messages`).limit(1).get()
  if (existingMsgs.empty) {
    for (const m of msgs) {
      await db.collection(`${ROOT}/chats/${dmId}/messages`).add({
        senderId: m.from.uid,
        type: m.type,
        text: m.text,
        photoURL: m.photoURL ?? null,
        createdAt: ago(m.min),
      })
    }
  }

  const reqId = [mina.uid, soyeon.uid].sort().join('_')
  await db.doc(`${ROOT}/chats/${reqId}`).set({
    type: 'dm',
    memberIds: [mina.uid, soyeon.uid],
    memberInfo: info(mina, soyeon),
    createdBy: soyeon.uid,
    requestStatus: 'pending',
    requestFrom: soyeon.uid,
    lastMessage: 'Want to study together this weekend?',
    lastMessageAt: ago(50),
    lastSenderId: soyeon.uid,
    unread: { [mina.uid]: 1, [soyeon.uid]: 0 },
  })
  const reqMsgs = await db.collection(`${ROOT}/chats/${reqId}/messages`).limit(1).get()
  if (reqMsgs.empty) {
    await db.collection(`${ROOT}/chats/${reqId}/messages`).add({
      senderId: soyeon.uid,
      type: 'text',
      text: 'Want to study together this weekend?',
      createdAt: ago(50),
    })
  }

  const groupSnap = await db.collection(`${ROOT}/chats`).where('type', '==', 'group').limit(1).get()
  let groupRef
  if (groupSnap.empty) {
    groupRef = db.collection(`${ROOT}/chats`).doc()
    await groupRef.set({
      type: 'group',
      memberIds: [mina.uid, jun.uid, soyeon.uid],
      memberInfo: info(mina, jun, soyeon),
      createdBy: mina.uid,
      requestStatus: 'accepted',
      title: 'Weekend hangout',
      lastMessage: 'I can bring snacks.',
      lastMessageAt: ago(20),
      lastSenderId: soyeon.uid,
      unread: { [mina.uid]: 1, [jun.uid]: 1, [soyeon.uid]: 0 },
    })
    await groupRef.collection('messages').add({ senderId: mina.uid, type: 'text', text: 'Shall we meet this weekend?', createdAt: ago(80) })
    await groupRef.collection('messages').add({ senderId: jun.uid, type: 'text', text: "I'm free Saturday afternoon.", createdAt: ago(60) })
    await groupRef.collection('messages').add({ senderId: soyeon.uid, type: 'text', text: 'I can bring snacks.', createdAt: ago(20) })
  }

  await db.doc(`${ROOT}/users/${mina.uid}/following/${jun.uid}`).set({ createdAt: ago(100) }, { merge: true })
  await db.doc(`${ROOT}/users/${jun.uid}/followers/${mina.uid}`).set({ createdAt: ago(100) }, { merge: true })
  await db.doc(`${ROOT}/users/${mina.uid}/following/${soyeon.uid}`).set({ createdAt: ago(90) }, { merge: true })
  await db.doc(`${ROOT}/users/${soyeon.uid}/followers/${mina.uid}`).set({ createdAt: ago(90) }, { merge: true })
  await db.doc(`${ROOT}/users/${jun.uid}/following/${mina.uid}`).set({ createdAt: ago(80) }, { merge: true })
  await db.doc(`${ROOT}/users/${mina.uid}/followers/${jun.uid}`).set({ createdAt: ago(80) }, { merge: true })

  const posts = await db.collection(`${ROOT}/posts`).limit(1).get()
  if (posts.empty) {
    const p1 = db.collection(`${ROOT}/posts`).doc()
    await p1.set({
      authorId: mina.uid, authorName: mina.displayName, authorUsername: mina.username, authorPhoto: mina.photoURL,
      text: 'Great coffee this morning. Ready for the weekend!',
      photoURLs: [cafeUrl], createdAt: ago(30), likeCount: 2, commentCount: 1,
    })
    await p1.collection('likes').doc(jun.uid).set({ createdAt: ago(25) })
    await p1.collection('likes').doc(soyeon.uid).set({ createdAt: ago(22) })
    await p1.collection('comments').add({
      authorId: jun.uid, authorName: jun.displayName, authorUsername: jun.username, authorPhoto: jun.photoURL,
      text: 'Save a table for me too!', createdAt: ago(24),
    })
    const p2 = db.collection(`${ROOT}/posts`).doc()
    await p2.set({
      authorId: jun.uid, authorName: jun.displayName, authorUsername: jun.username, authorPhoto: jun.photoURL,
      text: 'Evening walk. The light was beautiful.',
      photoURLs: [], createdAt: ago(12), likeCount: 1, commentCount: 0,
    })
    await p2.collection('likes').doc(mina.uid).set({ createdAt: ago(10) })
    await db.collection(`${ROOT}/posts`).doc().set({
      authorId: soyeon.uid, authorName: soyeon.displayName, authorUsername: soyeon.username, authorPhoto: soyeon.photoURL,
      text: 'Anyone up for a study session later?',
      photoURLs: [], createdAt: ago(8), likeCount: 0, commentCount: 0,
    })
  }

  for (const u of [mina, jun, soyeon, haru]) {
    const w = u.username === 'mina' ? 4 : u.username === 'jun' ? 3 : u.username === 'soyeon' ? 2 : 1
    const l = 1
    const d = 1
    await db.doc(`${ROOT}/users/${u.uid}/gameStats/tictactoe`).set({ wins: w, losses: l, draws: d, plays: w + l + d })
    await db.doc(`${ROOT}/leaderboard/${u.uid}`).set({
      displayName: u.displayName, username: u.username, photoURL: u.photoURL, wins: w, losses: l, draws: d, plays: w + l + d,
    })
  }

  const evs = await db.collection(`${ROOT}/events`).limit(1).get()
  if (evs.empty) {
    const evShared = db.collection(`${ROOT}/events`).doc()
    await evShared.set({
      title: 'Weekend hangout',
      note: 'Cafe + a walk',
      startAt: Timestamp.fromMillis(Date.now() + 2 * 24 * 60 * 60 * 1000),
      ownerId: mina.uid,
      chatId: (groupRef && groupRef.id) || null,
      memberIds: [mina.uid, jun.uid, soyeon.uid],
      createdAt: ago(15),
      updatedAt: ago(15),
    })
    await evShared.collection('rsvp').doc(mina.uid).set({ status: 'going', updatedAt: ago(8) })
    await db.collection(`${ROOT}/events`).add({
      title: 'Read for an hour',
      note: '',
      startAt: Timestamp.fromMillis(Date.now() + 1 * 24 * 60 * 60 * 1000),
      ownerId: mina.uid,
      chatId: null,
      memberIds: [mina.uid],
      createdAt: ago(6),
      updatedAt: ago(6),
    })
  }

  console.log('DMly production seed complete.')
  console.log('  Demo password for all accounts: demo1234')
  console.log('  mina / jun / soyeon / haru  @  *@demo.local')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
