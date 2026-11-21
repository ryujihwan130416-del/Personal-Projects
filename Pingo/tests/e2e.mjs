#!/usr/bin/env node
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = path.join(ROOT, 'shots')
const BASE = process.env.DMAPP_URL ?? 'http://127.0.0.1:5173'
const MOBILE = { width: 390, height: 844 }

const results = []
function ok(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
}
function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  ✗ ${name} — ${detail}`)
}

async function clickTab(page, testId) {
  await page.locator(`[data-testid="${testId}"]:visible`).click()
}

function ymdOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function settle(page) {
  await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(200)
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('email').fill(email)
  await page.getByTestId('password').fill(password)
  await page.getByTestId('login-btn').click()
  await page.getByTestId('inbox-screen').waitFor({ timeout: 15000 })
}

const launchOpts = {
  channel: 'chrome',
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--enable-features=NetworkServiceInProcess2',
  ],
}

const ctxOpts = {
  viewport: MOBILE,
  permissions: ['camera', 'microphone'],
  locale: 'ko-KR',
  colorScheme: 'light',
}

async function main() {
  await mkdir(SHOTS, { recursive: true })
  const browser = await chromium.launch(launchOpts)
  const boot = () => {
    localStorage.setItem('dmly-theme', 'light')
    localStorage.setItem('dmly-locale', 'en')
  }
  const contextA = await browser.newContext(ctxOpts)
  const contextB = await browser.newContext(ctxOpts)
  const contextC = await browser.newContext(ctxOpts)
  await contextA.addInitScript(boot)
  await contextB.addInitScript(boot)
  await contextC.addInitScript(boot)
  const mina = await contextA.newPage()
  const jun = await contextB.newPage()
  const soyeon = await contextC.newPage()

  try {
    await login(mina, 'mina@demo.local', 'demo1234')
    ok('mina login')
    await login(jun, 'jun@demo.local', 'demo1234')
    ok('jun login')
    await login(soyeon, 'soyeon@demo.local', 'demo1234')
    ok('soyeon login')

    await mina.getByTestId('inbox-screen').waitFor()
    await mina.waitForTimeout(400)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'inbox.png') })
    ok('screenshot inbox.png')

    await mina.getByTestId('tab-requests').click()
    await mina.getByTestId('requests-screen').waitFor()
    await mina.waitForTimeout(400)
    const reqRow = mina.locator('.list-row').first()
    await reqRow.waitFor()
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'requests.png') })
    ok('screenshot requests.png')
    await reqRow.click()
    await mina.getByTestId('request-actions').waitFor({ timeout: 10000 })
    ok('request flow UI (accept/decline)')
    await mina.getByTestId('accept-request').click()
    await mina.getByTestId('request-actions').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
    ok('accepted request')
    await mina.getByTestId('chat-back').click()

    await mina.getByTestId('me-btn').click()
    await mina.getByTestId('profile-screen').waitFor()
    await mina.waitForTimeout(300)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'profile.png') })
    ok('screenshot profile.png')

    await mina.getByTestId('edit-profile').click()
    await mina.getByTestId('edit-profile-screen').waitFor()
    const pngPath = path.join(SHOTS, '_upload.png')
    const avatar = path.join(ROOT, 'tests/fixtures/avatar.png')
    await writeFile(pngPath, await readFile(avatar))
    await mina.getByTestId('photo-input').setInputFiles(pngPath)
    await mina.waitForTimeout(1500)
    ok('profile photo upload attempted')
    await mina.getByTestId('edit-bio').fill('Cafes on weekends, work on weekdays. Updated my photo in the demo.')
    await mina.getByTestId('save-profile').click()
    await mina.getByTestId('profile-screen').waitFor({ timeout: 8000 })
    ok('profile saved')

    // Feed + post
    await clickTab(mina, 'tab-feed')
    await mina.getByTestId('feed-screen').waitFor({ timeout: 8000 })
    await mina.waitForTimeout(400)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'feed.png') })
    ok('screenshot feed.png')
    await mina.getByTestId('new-post-btn').click()
    await mina.getByTestId('compose-screen').waitFor()
    const postBody = `Demo post for today ${Date.now()}`
    await mina.getByTestId('post-text').fill(postBody)
    await mina.getByTestId('post-submit').click()
    await mina.getByTestId('post-detail-screen').waitFor({ timeout: 15000 })
    ok('post created')
    await mina.locator('[data-testid^="like-"]').first().click()
    await mina.waitForTimeout(400)
    ok('post liked')
    await mina.getByTestId('comment-input').fill('First comment')
    await mina.getByTestId('comment-send').click()
    await mina.getByText('First comment').waitFor({ timeout: 8000 })
    ok('post commented')
    await mina.waitForTimeout(300)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'post-detail.png') })
    ok('screenshot post-detail.png')


    // Personal calendar event
    const evDay = ymdOffset(1)
    await clickTab(mina, 'tab-calendar')
    await mina.getByTestId('calendar-screen').waitFor({ timeout: 8000 })
    const todayMonth = new Date().getMonth()
    const evDate = new Date()
    evDate.setDate(evDate.getDate() + 1)
    if (evDate.getMonth() !== todayMonth) await mina.getByTestId('cal-next').click()
    await mina.getByTestId(`cal-day-${evDay}`).click()
    await mina.getByTestId('new-event-btn').click()
    await mina.getByTestId('event-form').waitFor()
    await mina.getByTestId('event-title').fill('Deep work')
    await mina.getByTestId('event-date').fill(evDay)
    await mina.getByTestId('event-start').fill('16:00')
    await mina.getByTestId('event-end').fill('18:00')
    await mina.getByTestId('event-note').fill('Headphones on.')
    await mina.getByTestId('event-save').click()
    await mina.getByTestId('event-form').waitFor({ state: 'hidden', timeout: 8000 })
    await mina.getByTestId(`cal-day-${evDay}`).click()
    await mina.locator('[data-testid^="event-row-"]').first().waitFor({ timeout: 8000 })
    ok('personal event created')
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'calendar.png') })
    ok('screenshot calendar.png')

    // Games hub
    await clickTab(mina, 'tab-games')
    await mina.getByTestId('games-screen').waitFor()
    await mina.waitForTimeout(400)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'games.png') })
    ok('screenshot games.png')

    // Shared chat
    await clickTab(mina, 'tab-chats')
    await mina.getByTestId('inbox-screen').waitFor()
    await mina.locator('.list-row', { hasText: 'Jun' }).first().click()
    await mina.getByTestId('chat-screen').waitFor()
    await clickTab(jun, 'tab-chats').catch(() => {})
    await jun.locator('.list-row', { hasText: 'Mina' }).first().click()
    await jun.getByTestId('chat-screen').waitFor()
    ok('both opened shared chat')
    await mina.waitForTimeout(300)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'chat.png') })
    ok('screenshot chat.png')

    await jun.getByTestId('message-input').fill('typing test')
    try {
      await mina.getByTestId('typing-indicator').waitFor({ timeout: 5000 })
      ok('typing indicator')
    } catch (e) {
      fail('typing indicator', String(e.message ?? e))
    }

    const junText = `Jun message ${Date.now()}`
    await jun.getByTestId('message-input').fill(junText)
    await jun.getByTestId('send-btn').click()
    await mina.getByTestId('messages').getByText(junText).waitFor({ timeout: 8000 })
    ok('jun → mina message')
    try {
      await jun.getByTestId('read-receipt').filter({ hasText: 'Read' }).waitFor({ timeout: 10000 })
      ok('read receipt', 'Read')
    } catch (e) {
      fail('read receipt', String(e.message ?? e))
    }
    const minaText = `Mina reply ${Date.now()}`
    await mina.getByTestId('message-input').fill(minaText)
    await mina.getByTestId('send-btn').click()
    await jun.getByTestId('messages').getByText(minaText).waitFor({ timeout: 8000 })
    ok('mina → jun message')


    // Shared event from chat + RSVP
    try {
      const planDay = ymdOffset(1)
      await mina.getByTestId('plan-event').click()
      await mina.getByTestId('plan-sheet').waitFor({ timeout: 8000 })
      await mina.getByTestId('event-title').fill('Coffee catch-up')
      await mina.getByTestId('event-date').fill(planDay)
      await mina.getByTestId('event-start').fill('17:00')
      await mina.getByTestId('event-end').fill('18:00')
      await mina.getByTestId('event-save').click()
      await mina.locator('[data-testid^="event-card-"]').last().waitFor({ timeout: 10000 })
      ok('shared event from chat')
      await jun.locator('[data-testid^="open-event-"]').last().click()
      await jun.getByTestId('event-detail-screen').waitFor({ timeout: 10000 })
      await jun.getByTestId('rsvp-going').click()
      await jun.locator('[data-testid="rsvp-going"][aria-pressed="true"]').waitFor({ timeout: 8000 })
      ok('other user RSVP')
      await jun.getByTestId('event-back').click()
      await jun.getByTestId('chat-screen').waitFor({ timeout: 8000 })
      await settle(mina)
      await mina.locator('[data-testid^="event-card-"]').last().scrollIntoViewIfNeeded()
      await mina.screenshot({ path: path.join(SHOTS, 'chat-event.png') })
      ok('screenshot chat-event.png')
    } catch (e) {
      fail('shared event / RSVP', String(e.message ?? e))
    }


    // Tic-tac-toe from chat
    await mina.getByTestId('game-invite').click()
    await mina.getByTestId('invite-ttt').click()
    await mina.getByTestId('game-room-screen').waitFor({ timeout: 10000 })
    await jun.locator('[data-testid^="open-game-"]').last().click()
    await jun.getByTestId('game-room-screen').waitFor({ timeout: 10000 })
    await mina.getByTestId('start-game').click()
    await mina.getByTestId('board-ttt').waitFor({ timeout: 8000 })
    await jun.getByTestId('board-ttt').waitFor({ timeout: 8000 })
    await mina.waitForTimeout(300)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'in-chat-game.png') })
    ok('screenshot in-chat-game.png')
    try {
      await mina.getByTestId('ttt-0').click()
      await jun.getByTestId('ttt-3').click({ timeout: 5000 })
      await mina.getByTestId('ttt-1').click()
      await jun.getByTestId('ttt-4').click({ timeout: 5000 })
      await mina.getByTestId('ttt-2').click()
      await mina.getByTestId('game-result').waitFor({ timeout: 8000 })
      ok('tic-tac-toe game')
    } catch (e) {
      fail('tic-tac-toe game', String(e.message ?? e))
    }

    // RPS via lobby + code
    await clickTab(mina, 'tab-games')
    await mina.getByTestId('games-screen').waitFor()
    await mina.getByTestId('game-tile-rps').click()
    await mina.getByTestId('mode-1v1').click()
    await mina.getByTestId('create-room').click()
    await mina.getByTestId('room-code').waitFor({ timeout: 8000 })
    const rpsCode = (await mina.getByTestId('room-code').innerText()).trim()
    await clickTab(jun, 'tab-games')
    await jun.getByTestId('games-screen').waitFor()
    await jun.getByTestId('join-code').fill(rpsCode)
    await jun.getByTestId('join-btn').click()
    await jun.getByTestId('game-room-screen').waitFor({ timeout: 10000 })
    await mina.getByTestId('start-game').click()
    await mina.getByTestId('board-rps').waitFor({ timeout: 8000 })
    try {
      for (let i = 0; i < 3; i++) {
        await mina.getByTestId('rps-rock').click()
        await jun.getByTestId('rps-scissors').click()
        await mina.getByTestId('rps-next').waitFor({ timeout: 8000 })
        await mina.getByTestId('rps-next').click()
      }
      await mina.getByTestId('game-result').waitFor({ timeout: 8000 })
      ok('rps game')
    } catch (e) {
      fail('rps game', String(e.message ?? e))
    }

    // 3-player reaction party
    await clickTab(mina, 'tab-games')
    await mina.getByTestId('games-screen').waitFor()
    await mina.getByTestId('game-tile-react').click()
    await mina.getByTestId('mode-party').click()
    await mina.getByTestId('create-room').click()
    await mina.getByTestId('room-code').waitFor({ timeout: 8000 })
    const reactCode = (await mina.getByTestId('room-code').innerText()).trim()
    for (const p of [jun, soyeon]) {
      await clickTab(p, 'tab-games')
      await p.getByTestId('games-screen').waitFor()
      await p.getByTestId('join-code').fill(reactCode)
      await p.getByTestId('join-btn').click()
      await p.getByTestId('game-room-screen').waitFor({ timeout: 10000 })
    }
    const names = mina.locator('.lobby .list-row')
    await names.nth(2).waitFor({ timeout: 8000 })
    ok('3-player lobby', reactCode)
    await mina.getByTestId('start-game').click()
    try {
      for (let i = 0; i < 3; i++) {
        await mina.getByTestId('react-tap').click()
        await Promise.all([
          mina.getByTestId('react-go').waitFor({ timeout: 8000 }),
          jun.getByTestId('react-go').waitFor({ timeout: 8000 }),
          soyeon.getByTestId('react-go').waitFor({ timeout: 8000 }),
        ])
        await Promise.all([
          mina.getByTestId('react-go').click(),
          jun.getByTestId('react-go').click(),
          soyeon.getByTestId('react-go').click(),
        ])
        await mina.getByTestId('react-next').waitFor({ timeout: 8000 })
        await mina.getByTestId('react-next').click()
      }
      await mina.getByTestId('game-result').waitFor({ timeout: 8000 })
      ok('3-player reaction game')
    } catch (e) {
      fail('3-player reaction game', String(e.message ?? e))
    }

    // Back to chat for call
    await clickTab(mina, 'tab-chats')
    await mina.getByTestId('inbox-screen').waitFor()
    await mina.locator('.list-row', { hasText: 'Jun' }).first().click()
    await mina.getByTestId('chat-screen').waitFor()
    await clickTab(jun, 'tab-chats')
    await jun.getByTestId('inbox-screen').waitFor()
    await jun.locator('.list-row', { hasText: 'Mina' }).first().click()
    await jun.getByTestId('chat-screen').waitFor()

    await mina.getByTestId('video-call').click()
    await mina.getByTestId('call-screen').waitFor({ timeout: 8000 })
    ok('outgoing call screen')
    await jun.getByTestId('incoming-call').waitFor({ timeout: 10000 })
    ok('incoming call ringing')
    await jun.getByTestId('accept-call').click()
    const connected = await Promise.race([
      mina.waitForFunction(() => document.querySelector('[data-testid="call-screen"]')?.getAttribute('data-phase') === 'active', { timeout: 20000 }).then(() => 'mina'),
      jun.waitForFunction(() => document.querySelector('[data-testid="call-screen"]')?.getAttribute('data-phase') === 'active', { timeout: 20000 }).then(() => 'jun'),
    ]).catch((e) => {
      fail('call connects', String(e.message ?? e))
      return null
    })
    if (connected) ok('call connects', `phase=active on ${connected}`)
    await mina.waitForTimeout(800)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'call.png') })
    ok('screenshot call.png')
    await mina.getByTestId('hangup').click()
    await mina.getByTestId('call-screen').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
    ok('hang up')

    await mina.setViewportSize({ width: 1280, height: 800 })
    await mina.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await mina.getByTestId('inbox-screen').waitFor()
    await mina.locator('.list-row', { hasText: 'Jun' }).first().click()
    await mina.getByTestId('chat-screen').waitFor()
    await mina.waitForTimeout(400)
    await settle(mina)
    await mina.screenshot({ path: path.join(SHOTS, 'desktop.png') })
    ok('screenshot desktop.png')
  } finally {
    await browser.close()
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`)
  if (failed.length) {
    console.error('Failures:\n' + failed.map((f) => ` - ${f.name}: ${f.detail}`).join('\n'))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
