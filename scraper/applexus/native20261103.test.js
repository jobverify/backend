import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createApplexusScraper, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const manifest = JSON.parse(fs.readFileSync(new URL('./test-data/manifest-20261103.json', import.meta.url)))
const dummyAuthorization = 'Basic ' + Buffer.from('fixture-only:public-client-test').toString('base64')
const pages = new Map(manifest.files.map(row => [row.url, gunzipSync(fs.readFileSync(new URL('./test-data/' + row.file, import.meta.url)))
  .toString('utf8').replaceAll('Basic PUBLIC_CLIENT_CREDENTIAL_REDACTED', dummyAuthorization)]))
const listings = new Map(manifest.listingFiles.map(row => [row.offset,
  JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/' + row.file, import.meta.url))).toString('utf8'))]))

async function observe(change = (_url, payload) => payload, options = {}) {
  const requests = [], records = [], audits = []
  const jobs = await createApplexusScraper().run({
    // The previous implementation used only HTML; this retained fixture makes
    // its false empty result fail without contacting a live site.
    fetchText: async url => pages.get(url),
    fetchImpl: async (value, init = {}) => {
      const url = new URL(value)
      requests.push({ url: url.href, method: init.method || 'GET', authorizationSent: new Headers(init.headers).has('authorization') })
      assert.equal(init.method || 'GET', 'GET')
      let payload, contentType = 'text/html'
      if (url.hostname === 'admin.applexus.com') {
        assert.equal(url.pathname, '/api/careers_list')
        assert.equal(url.searchParams.get('location'), '0')
        assert.equal(url.searchParams.get('limit'), '9')
        assert.equal(new Headers(init.headers).get('authorization'), dummyAuthorization)
        assert.ok(listings.has(Number(url.searchParams.get('offset'))))
        payload = structuredClone(listings.get(Number(url.searchParams.get('offset'))))
        contentType = 'application/json'
      } else {
        assert.equal(url.origin, 'https://www.applexus.com')
        assert.equal(new Headers(init.headers).has('authorization'), false)
        assert.ok(pages.has(url.href), 'unretained public URL')
        payload = pages.get(url.href)
      }
      const changed = change(url, payload)
      const response = changed instanceof Response ? changed : new Response(typeof changed === 'string' ? changed : JSON.stringify(changed), { headers: { 'Content-Type': contentType } })
      Object.defineProperty(response, 'url', { value: url.href })
      return response
    },
    onRecords: rows => records.push(rows), onAudit: value => audits.push(value),
    now: () => '2026-11-03T02:00:00.000Z', ...options
  })
  return { jobs, records, audits, requests }
}

test('current native pagination and full public details recover sixteen unambiguous India roles', async () => {
  const { jobs, records, requests } = await observe()
  assert.equal(jobs.length, 16)
  assert.equal(records[0].length, 26)
  assert.equal(readSourceObservationEvidence(jobs, 'applexus').observedVacancyCount, 26)
  assert.ok(jobs.every(row => row.country === 'India' && row.requisitionId === null && row.postingDate === null))
  assert.ok(jobs.every(row => row.sourceDetailComplete && !row.lifecycleCleanupAllowed))
  assert.ok(requests.some(row => row.url.includes('offset=18')))
  assert.equal(requests.filter(row => row.authorizationSent).length, 9)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('all original description sections survive without including the application CTA or site footer', async () => {
  const { jobs } = await observe()
  const row = jobs.find(value => value.sourceUrl.endsWith('/partnership-executive'))
  const description = extractActiveDescription(row.jobDescription)
  assert.ok(description.includes('Education: MBA'))
  assert.ok(description.includes('Good-to-Have Skills'))
  assert.ok(description.includes('international stakeholders'))
  assert.ok(!description.includes('Join the Team'))
  assert.ok(!description.includes('33507 9th Avenue'))
})

test('India category records with an explicit UK onsite worksite are retained as conflicts and held', async () => {
  const { jobs, records, audits } = await observe()
  assert.ok(!jobs.some(row => row.sourceUrl.includes('uk-onsite')))
  const conflicts = records[0].filter(row => row.sourceUrl.includes('uk-onsite'))
  assert.equal(conflicts.length, 2)
  assert.ok(conflicts.every(row => row.country === null && row.sourceCountryScopeUnresolved === true && row.sourceDetailComplete))
  assert.equal(audits[0].countryConflicts.length, 2)
})

test('output limits are applied only after full opening and closing enumeration', async () => {
  const { jobs, records, requests } = await observe(undefined, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(records[0].length, 26)
  assert.ok(requests.filter(row => row.url.includes('offset=18')).length >= 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a malformed native total is a source error rather than a verified empty board', async () => {
  await assert.rejects(observe((url, payload) => {
    if (url.hostname === 'admin.applexus.com') payload.career_list.pagination.total = null
    return payload
  }), /pagination|total|native inventory/i)
})

test('a closing criteria change holds only the changed India role', async () => {
  let reads = 0
  const { jobs } = await observe((url, payload) => {
    if (url.pathname === '/careers/partnership-executive' && ++reads === 2) return payload.replace('Education: MBA', 'Education: PhD')
    return payload
  })
  assert.equal(jobs.length, 15)
  assert.ok(!jobs.some(row => row.sourceUrl.endsWith('/partnership-executive')))
})

test('an API denial cannot leak the published client configuration in a source error', async () => {
  await assert.rejects(observe((url, payload) => url.hostname === 'admin.applexus.com'
    ? new Response('Access denied', { status: 403 }) : payload), error => {
    assert.ok(!error.message.includes(dummyAuthorization))
    assert.match(error.message, /403|unavailable|denied/i)
    return true
  })
})

test('caller cancellation reaches the initial reader before source I/O', async () => {
  const controller = new AbortController(), reason = Error('stop Applexus')
  controller.abort(reason)
  let reads = 0
  await assert.rejects(observe((_url, value) => { reads++; return value }, { signal: controller.signal }), error => error === reason)
  assert.equal(reads, 0)
})

for (const variant of ['failure-envelope', 'extra-collection-cursor', 'extra-pagination-hasMore']) {
  test('unreviewed zero-state flags cannot authorize a verified empty board: ' + variant, async () => {
    await assert.rejects(observe((url, payload) => {
      if (url.hostname !== 'admin.applexus.com') return payload
      const empty = { career_list: { id: '0', tabData: [], pagination: { page: '0', limit: '9', total: 0 } } }
      if (variant === 'failure-envelope') empty.success = false
      if (variant === 'extra-collection-cursor') empty.career_list.cursor = 'more-public-roles'
      if (variant === 'extra-pagination-hasMore') empty.career_list.pagination.hasMore = true
      return empty
    }), /envelope|pagination|native inventory/i)
  })
}

test('an injected reader cannot smuggle request configuration through a source-looking error prefix', async () => {
  await assert.rejects(observe((url, payload) => {
    if (url.hostname === 'admin.applexus.com') throw Error('Applexus native inventory: ' + dummyAuthorization)
    return payload
  }), error => {
    assert.ok(!error.message.includes(dummyAuthorization))
    assert.ok(!error.message.includes(Buffer.from('fixture-only:public-client-test').toString('base64')))
    return true
  })
})

test('a nomodule fallback script does not establish the active public listing client', async () => {
  await assert.rejects(observe((url, payload) => url.href === CAREER_PAGE_URL
    ? payload.replace(/(<script\b[^>]*src="\/_next\/static\/chunks\/3836-[^"]+\.js")/, '$1 nomodule') : payload), /client script|active|native inventory/i)
})

test('a commented title cannot replace the current parsed document employer title', async () => {
  await assert.rejects(observe((url, payload) => url.href === CAREER_PAGE_URL
    ? payload.replace(/<title[^>]*>[\s\S]*?<\/title>/, '<title>Unrelated vendor</title><!-- <title>Applexus Careers</title> -->') : payload), /employer|title|native inventory/i)
})

test('a role removed during the closing detail reads is held by a final native listing traversal', async () => {
  let roleReads = 0
  const allRows = [...listings.values()].flatMap(value => value.career_list.tabData)
  const { jobs, audits } = await observe((url, payload) => {
    if (url.origin === 'https://www.applexus.com' && /^\/careers\//.test(url.pathname)) roleReads++
    if (url.hostname === 'admin.applexus.com' && roleReads >= 52) {
      const current = allRows.filter(row => row.link !== '/careers/partnership-executive')
      const offset = Number(url.searchParams.get('offset'))
      return { career_list: { id: '0', tabData: current.slice(offset, offset + 9), pagination: { page: String(offset), limit: '9', total: 25 } } }
    }
    return payload
  })
  assert.equal(jobs.length, 15)
  assert.ok(!jobs.some(row => row.sourceUrl.endsWith('/partnership-executive')))
  assert.equal(audits[0].listingStable, false)
})
