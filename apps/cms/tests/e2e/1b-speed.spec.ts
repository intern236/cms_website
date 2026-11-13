import { expect, test, type Page } from '@playwright/test'
import { PASSWORD, signIn } from './helpers'

/**
 * SPEED BUDGETS, on the production build, after the journey has filled the
 * bakery workspace. Two kinds of check:
 *
 * - tabs and filters (settings sections, post statuses, inbox folders) switch in
 *   the browser: the click changes the screen at once and asks the server for
 *   nothing;
 * - sidebar pages (and the account page) are fetched before the click, so they
 *   open even with the server cut off; other clicks land quickly (the clicked
 *   link shows a spinner if it takes longer than a moment); and the server
 *   answers every workspace page quickly.
 *
 * The budgets are generous on purpose (a slow CI machine must not fail them);
 * they catch a change that brings back a server round trip per click.
 */
test.describe.configure({ mode: 'serial' })

const SWITCH_MS = 400
const FEEDBACK_MS = 1_000
const SERVER_MS = 1_500

let owner: Page

/** Counts requests that re-ask the server for the page being looked at. */
function watchSamePage(page: Page) {
  const hits: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.origin === 'http://localhost:3300' && url.pathname === new URL(page.url()).pathname && r.resourceType() !== 'image') hits.push(r.url())
  })
  return hits
}

async function timed(fn: () => Promise<unknown>) {
  const start = Date.now()
  await fn()
  return Date.now() - start
}

test.beforeAll(async ({ browser }) => {
  owner = await (await browser.newContext()).newPage()
  await signIn(owner, 'owner@bakery.test', PASSWORD)
  await owner.waitForURL('**/bakery')
})

test('settings sections switch in the browser', async () => {
  await owner.goto('/bakery/settings')
  await owner.waitForLoadState('networkidle')
  const hits = watchSamePage(owner)
  const nav = owner.getByRole('navigation', { name: 'Settings sections' })

  const people = await timed(async () => {
    await nav.getByRole('link', { name: 'People' }).click()
    await expect(owner.getByRole('button', { name: 'Send invite' })).toBeVisible()
  })
  const website = await timed(async () => {
    await nav.getByRole('link', { name: 'Website & keys' }).click()
    await expect(owner.getByText('Site keys', { exact: true })).toBeVisible()
  })
  const branding = await timed(async () => {
    await nav.getByRole('link', { name: 'Branding' }).click()
    await expect(owner.getByText('Identity', { exact: true })).toBeVisible()
  })
  expect(Math.max(people, website, branding)).toBeLessThan(SWITCH_MS)
  expect(hits, 'a tab switch asked the server for the page again').toEqual([])
  // The address keeps the section: a reload opens the same one.
  expect(new URL(owner.url()).searchParams.get('tab')).toBe('branding')
  await owner.reload()
  await expect(nav.getByRole('link', { name: 'Branding' })).toHaveAttribute('aria-current', 'page')
})

test('post status filters and search work in the browser', async () => {
  await owner.goto('/bakery/posts')
  await owner.waitForLoadState('networkidle')
  const hits = watchSamePage(owner)
  const tabs = owner.getByRole('tablist')

  for (const name of [/Drafts/, /Published/, /In review/, /All/]) {
    const ms = await timed(async () => {
      await tabs.getByRole('tab', { name }).click()
      await expect(tabs.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    })
    expect(ms, `${name}`).toBeLessThan(SWITCH_MS)
  }
  await owner.getByLabel('Search posts').fill('zzz-nothing-matches')
  await expect(owner.getByText('Nothing matches')).toBeVisible()
  await owner.getByLabel('Clear search').click()
  await expect(owner.getByText('Nothing matches')).toHaveCount(0)
  expect(hits, 'a filter asked the server for the page again').toEqual([])
})

test('inbox folders switch in the browser', async () => {
  await owner.goto('/bakery/inbox')
  await owner.waitForLoadState('networkidle')
  const hits = watchSamePage(owner)
  const folders = owner.getByRole('tablist', { name: 'Show' })
  const ms = await timed(async () => {
    await folders.getByRole('tab', { name: 'archived' }).click()
    await expect(owner.getByText('Nothing archived.')).toBeVisible()
  })
  expect(ms).toBeLessThan(SWITCH_MS)
  await folders.getByRole('tab', { name: 'inbox' }).click()
  await expect(owner.getByText('Nothing archived.')).toHaveCount(0)
  expect(hits).toEqual([])
  expect(new URL(owner.url()).searchParams.get('filter')).toBeNull()
})

test('every sidebar click lands quickly', async () => {
  await owner.goto('/bakery')
  await owner.waitForLoadState('networkidle')
  const sidebar = owner.getByRole('navigation', { name: 'Main' }).filter({ visible: true })
  for (const [name, heading] of [
    [/^Posts$/, 'Posts'],
    [/^Inbox/, 'Inbox'],
    [/^Settings$/, 'Settings'],
    [/^Dashboard$/, /^Good /],
  ] as const) {
    const ms = await timed(async () => {
      await sidebar.getByRole('link', { name }).click()
      await expect(owner.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: FEEDBACK_MS })
    })
    expect(ms, String(name)).toBeLessThan(FEEDBACK_MS)
    await owner.waitForLoadState('networkidle')
  }
})

test('sidebar pages and the account page are ready before the click', async () => {
  // Load the dashboard, let the sidebar fetch its pages, then cut the server off:
  // every sidebar page (and the account page, once its menu is open) must still open.
  for (const [link, heading] of [
    [/^Posts$/, 'Posts'],
    [/^Inbox/, 'Inbox'],
    [/^Settings$/, 'Settings'],
    [/^Authors$/, 'Authors'],
  ] as const) {
    await owner.goto('/bakery')
    await owner.waitForLoadState('networkidle')
    await owner.route(/_rsc=/, (route) => route.abort())
    await owner.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name: link }).click()
    await expect(owner.getByRole('heading', { level: 1, name: heading }), `${heading} came from the server, not the prefetch`).toBeVisible({ timeout: 2_000 })
    await owner.unroute(/_rsc=/)
  }
  await owner.goto('/bakery')
  await owner.waitForLoadState('networkidle')
  await owner.getByRole('button', { name: /owner@bakery\.test/ }).click()
  await owner.waitForLoadState('networkidle')
  await owner.route(/_rsc=/, (route) => route.abort())
  await owner.getByRole('menuitem', { name: 'Your account' }).click()
  await expect(owner.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible({ timeout: 2_000 })
  await owner.unroute(/_rsc=/)
})

test('the server answers every workspace page quickly', async () => {
  // Warm once (first hit compiles nothing in production, but opens connections).
  await owner.request.get('/bakery')
  for (const path of ['/bakery', '/bakery/posts', '/bakery/posts/new', '/bakery/inbox', '/bakery/settings', '/bakery/authors']) {
    const start = Date.now()
    const res = await owner.request.get(path)
    const ms = Date.now() - start
    expect(res.status(), path).toBeLessThan(500)
    expect(ms, path).toBeLessThan(SERVER_MS)
  }
})
