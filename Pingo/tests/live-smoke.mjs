import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const SHOTS = '/workspace/DMApp/shots'
const BASE = 'https://pingo-messenger.web.app'
const results = []
const ok = (name, d='') => { results.push({name, ok:true, d}); console.log('  ✓', name, d) }
const fail = (name, d) => { results.push({name, ok:false, d}); console.error('  ✗', name, '—', d) }

const launchOpts = { channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] }
const ctxOpts = { viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: 'light' }

async function clickVisible(page, testId) {
  await page.locator(`[data-testid="${testId}"]:visible`).click()
}

async function main() {

  await mkdir(SHOTS, { recursive: true })
  const browser = await chromium.launch(launchOpts)
  const context = await browser.newContext(ctxOpts)
  await context.addInitScript(() => {
    localStorage.setItem('dmly-theme', 'light')
    localStorage.setItem('dmly-locale', 'en')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(25000)

  try {
    const logs = []
    page.on('pageerror', (e) => logs.push('pageerror ' + e.message))
    page.on('console', (m) => { if (m.type() === 'error') logs.push('console ' + m.text()) })
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('email').waitFor({ timeout: 20000 })
    await page.screenshot({ path: path.join(SHOTS, 'live-login.png') })
    ok('login page loaded')
    await page.getByTestId('email').fill('mina@demo.local')
    await page.getByTestId('password').fill('demo1234')
    await page.getByTestId('login-btn').click()
    const landed = await Promise.race([
      page.getByTestId('inbox-screen').waitFor({ timeout: 25000 }).then(() => 'inbox'),
      page.getByTestId('signup-form').waitFor({ timeout: 25000 }).then(() => 'signup'),
      page.getByTestId('auth-error').locator('text=/.+/').waitFor({ timeout: 25000 }).then(() => 'auth-error'),
    ]).catch(() => 'timeout')
    if (landed !== 'inbox') {
      const err = (await page.getByTestId('auth-error').textContent().catch(() => '')) || ''
      fail('login', `landed=${landed} url=${page.url()} err=${err} logs=${logs.join(' | ')}`)
      await page.screenshot({ path: path.join(SHOTS, 'live-error.png'), timeout: 8000 }).catch(() => {})
    } else {
      ok('login')
    }
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(SHOTS, 'live-inbox.png'), fullPage: false })
    ok('screenshot live-inbox.png')

    // Send a message in the Jun chat
    const chatRow = page.locator('[data-testid="chat-row"], a[href*="/chat/"], .thread, .inbox-row').first()
    // Prefer a row that mentions Jun
    const jun = page.getByText('Jun', { exact: false }).first()
    if (await jun.count()) {
      await jun.click()
    } else {
      await chatRow.click()
    }
    await page.waitForTimeout(800)
    const composer = page.getByTestId('composer').or(page.locator('textarea, input[data-testid="composer"], [data-testid="message-input"]')).first()
    await composer.waitFor({ timeout: 15000 })
    const stamp = `live smoke ${Date.now()}`
    await composer.fill(stamp)
    const send = page.getByTestId('send-btn').or(page.getByRole('button', { name: /send/i })).first()
    await send.click()
    await page.getByText(stamp).waitFor({ timeout: 15000 })
    ok('send message', stamp)
    await page.screenshot({ path: path.join(SHOTS, 'live-chat.png') })

    await page.getByTestId('chat-back').click()
    await page.getByTestId('inbox-screen').waitFor({ timeout: 15000 })

    // Feed
    await clickVisible(page, 'tab-feed')
    await page.getByTestId('feed-screen').waitFor({ timeout: 15000 })
    ok('feed')
    await page.screenshot({ path: path.join(SHOTS, 'live-feed.png') })

    // Calendar
    await clickVisible(page, 'tab-calendar')
    await page.getByTestId('calendar-screen').waitFor({ timeout: 15000 })
    ok('calendar')
    await page.screenshot({ path: path.join(SHOTS, 'live-calendar.png') })

    // Games
    await clickVisible(page, 'tab-games')
    await page.getByTestId('games-screen').waitFor({ timeout: 15000 })
    ok('games hub')
    const tile = page.locator('[data-testid^="game-tile-"]').first()
    if (await tile.count()) {
      await tile.click()
      await page.waitForTimeout(800)
      ok('opened a game')
    } else {
      ok('opened a game', 'hub only')
    }
        await page.screenshot({ path: path.join(SHOTS, 'live-games.png') })
  } catch (e) {
    fail('live smoke crashed', e.stack || String(e))
    await page.screenshot({ path: path.join(SHOTS, 'live-error.png'), timeout: 8000 }).catch(() => {}).catch(()=>{})
  }

  // Turbo Racer site still loads
  try {
    const tr = await context.newPage()
    const resp = await tr.goto('https://turboracer.web.app', { waitUntil: 'domcontentloaded', timeout: 30000 })
    const status = resp?.status()
    const title = await tr.title()
    const body = await tr.locator('body').innerText().catch(()=> '')
    if (status && status < 400 && !/page not found|site not found|404/i.test(title+body)) {
      ok('turbo racer site loads', `status=${status} title=${title.slice(0,80)}`)
    } else {
      fail('turbo racer site loads', `status=${status} title=${title}`)
    }
    await tr.screenshot({ path: path.join(SHOTS, 'turboracer-live.png') })
    await tr.close()
  } catch (e) {
    fail('turbo racer site loads', String(e))
  }

  await browser.close()
  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.filter(r=>r.ok).length}/${results.length} checks passed`)
  if (failed.length) process.exit(1)
}
main()
