import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { run, CAREERS_URL, GREENHOUSE_BOARD_URL, buildGreenhouseJobsApiUrl, hasOfficialCareersPageSignal } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-native-packets.json', import.meta.url), 'utf8'))
const exercise = ({ id = '8464846002', corporate, board, packet, signal, changeClosing = false, changeClosingRole = false, changeClosingCorporate = false } = {}) => {
  const calls = [], counts = new Map()
  const careers = corporate ?? fixture.careers.replaceAll('8464846002', id)
  return run({ signal,
    now: () => '2026-10-31T06:00:00.000Z',
    fetchText: async url => {
      calls.push(url)
      counts.set(url, (counts.get(url) || 0) + 1)
      if (url === CAREERS_URL) return changeClosingCorporate && counts.get(url) > 1 ? careers.replaceAll(id, '9464846003') : careers
      assert.equal(url, GREENHOUSE_BOARD_URL)
      return board ?? (changeClosing && counts.get(url) > 1 ? fixture.nativeBoard.replace('8 jobs', '9 jobs') : fixture.nativeBoard)
    },
    fetchJson: async url => {
      calls.push(url)
      assert.equal(url, buildGreenhouseJobsApiUrl())
      return structuredClone(fixture.feed)
    },
    fetchPage: async url => {
      calls.push(url)
      counts.set(url, (counts.get(url) || 0) + 1)
      if (url === GREENHOUSE_BOARD_URL + '/jobs/' + id) return packet?.(url, counts) ?? (changeClosingRole && counts.get(url) > 1
        ? { status: 200, url, body: '<form>Apply</form>' } : { status: 302, url, location: '/calendly?error=true', body: '' })
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs/' + id)
      return packet?.(url, counts) ?? { status: 404, url, body: fixture.unavailableApi.body }
    },
  }).then(jobs => ({ jobs, calls }))
}

test('Calendly reconciles the native published inventory while retaining an explicitly unavailable corporate card', async () => {
  const { jobs, calls } = await exercise()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 8)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.match(readInventoryEvidence(jobs).reason, /8464846002/)
  assert.match(readInventoryEvidence(jobs).reason, /unavailable|not.*published/i)
  assert.equal(calls.filter(url => url === GREENHOUSE_BOARD_URL).length, 2)
  assert.equal(calls.filter(url => url === GREENHOUSE_BOARD_URL + '/jobs/8464846002').length, 2)
})

test('Calendly resolves another unavailable native role with the same public state contract', async () => {
  const { jobs } = await exercise({ id: '9464846002' })
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 8)
  assert.match(readInventoryEvidence(jobs).reason, /9464846002/)
})

for (const status of [401, 403, 429]) test('Calendly never treats an inaccessible missing-role proof as an inactive card after HTTP ' + status, async () => {
  await assert.rejects(exercise({ packet: url => ({ status, url, body: 'Access denied' }) }), /unavailable|HTTP|denied/i)
})

test('Calendly rejects a missing corporate role that still has an active native application page', async () => {
  await assert.rejects(exercise({ packet: url => ({ status: 200, url, body: '<h1>Senior Full Stack Engineer, AI Scheduling</h1><form>Apply</form>' }) }), /unavailable|published|inventory|redirect/i)
})

test('Calendly rejects an off-tenant missing-role redirect', async () => {
  await assert.rejects(exercise({ packet: url => ({ status: 302, url, location: 'https://job-boards.greenhouse.io/unrelated?error=true', body: '' }) }), /identity|redirect|scope|unavailable/i)
})

test('Calendly rejects conflicting or duplicated native active-board inventories', async () => {
  await assert.rejects(exercise({ board: fixture.nativeBoard.replaceAll('/calendly/jobs/8895903002', '/unrelated/jobs/8895903002') }), /inventory|identity|board/i)
  const anchor = fixture.nativeBoard.match(/<a\b[^>]*href="https:\/\/job-boards\.greenhouse\.io\/calendly\/jobs\/8895903002"[^>]*>[\s\S]*?<\/a>/i)[0]
  await assert.rejects(exercise({ board: fixture.nativeBoard.replace(anchor, anchor + anchor) }), /duplicate|inventory|count/i)
})

test('Calendly does not derive the official employer handoff from hidden or inert links', () => {
  const noLinks = fixture.careers.replace(/<a\b[^>]*href=["']https:\/\/boards\.greenhouse\.io\/calendly\/jobs\/\d+["'][^>]*>[\s\S]*?<\/a>/gi, '')
  const link = '<a href="https://job-boards.greenhouse.io/calendly">Open roles</a>'
  assert.equal(hasOfficialCareersPageSignal(noLinks + '<template>' + link + '</template>'), false)
  assert.equal(hasOfficialCareersPageSignal(noLinks + '<div style="display:none">' + link + '</div>'), false)
})

test('Calendly rejects native active-board drift during closing reconciliation', async () => {
  await assert.rejects(exercise({ changeClosing: true }), /changed|inventory|count/i)
})

test('Calendly cancellation stops before any authority request', async () => {
  const reason = new Error('cancel current Calendly check')
  await assert.rejects(exercise({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

test('Calendly cannot classify an ambiguous API error as an unavailable published card', async () => {
  await assert.rejects(exercise({ packet: url => url.includes('boards-api.greenhouse.io')
    ? { status: 404, url, body: '{"status":404,"error":"Access denied"}' }
    : { status: 302, url, location: '/calendly?error=true', body: '' } }), /API.*unavailable|proof/i)
})

test('Calendly still rejects a live API role missing from the official careers cards', async () => {
  const corporate = fixture.careers.replace(/<a\b[^>]*href=["']https:\/\/boards\.greenhouse\.io\/calendly\/jobs\/8895903002["'][^>]*>[\s\S]*?<\/a>/gi, '')
  assert.notEqual(corporate, fixture.careers)
  await assert.rejects(exercise({ corporate }), /live role missing|careers.*inventory/i)
})

test('Calendly rejects unavailable-role or corporate-card drift during closing validation', async () => {
  await assert.rejects(exercise({ changeClosingRole: true }), /unavailable|inventory/i)
  await assert.rejects(exercise({ changeClosingCorporate: true }), /changed|inventory/i)
})

test('Calendly rejects a missing-role response that followed a different final authority', async () => {
  await assert.rejects(exercise({ packet: () => ({ status: 302, url: 'https://other.example/', location: '/calendly?error=true', body: '' }) }), /identity/)
})
