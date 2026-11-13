import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { runVerifiedEmployerLinkedIn } from '../../scraper-support/shared/verifiedEmployerLinkedIn.js'
import { createAirtelPaymentsBankScraper } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'

const fixtureRoot = new URL('./fixtures/native-20261113/', import.meta.url)
const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', fixtureRoot)))
const fixtures = new Map()
for (const receipt of manifest.receipts) fixtures.set(receipt.file, {
  ...receipt, html: gunzipSync(await fs.readFile(new URL(receipt.file, fixtureRoot))).toString(),
})
const config = {
  source: 'airtelpaymentsbank', companyName: 'Airtel Payments Bank', companyTenant: 'airtelpaymentsbank', companyId: '13361480',
  officialUrl: 'https://www.airtelpayments.bank.in/', companyJobsUrl: 'https://www.linkedin.com/company/airtelpaymentsbank',
  listingPath: '/jobs/airtel-payments-bank-jobs-worldwide',
  validateOfficialHandoff: ({ home }) => home.includes('https://www.linkedin.com/company/airtelpaymentsbank'),
}
const replay = (mutate = packet => packet) => {
  const requests = []
  return { requests, fetchImpl: async (url, options = {}) => {
    options.signal?.throwIfAborted()
    requests.push(String(url))
    const requested = new URL(url)
    const closingBoard = requested.pathname === config.listingPath
      && requests.filter(value => new URL(value).pathname === config.listingPath).length > 1
    const packet = closingBoard ? fixtures.get('closing-board.body.gz')
      : [...fixtures.values()].find(row => new URL(row.requestedUrl).pathname === requested.pathname)
    assert.ok(packet, 'Unexpected native route: ' + url)
    const result = mutate({ ...packet, requestedUrl: String(url) }, requests.length)
    const response = new Response(result.html, { status: result.status })
    Object.defineProperty(response, 'url', { value: result.finalUrl })
    options.signal?.throwIfAborted()
    return response
  } }
}

test('bank native simple onsite application marker retains exact employer and role binding', async () => {
  const transport = replay()
  const jobs = await runVerifiedEmployerLinkedIn(config, { ...transport, now: () => '2026-11-13T07:30:00.000Z' })
  assert.equal(jobs.length, 16)
  const engineering = jobs.find(job => job.jobId === '4489910835')
  assert.equal(engineering.company, 'Airtel Payments Bank')
  assert.equal(engineering.country, 'India')
  assert.match(engineering.jobDescription, /3-6 years of experience of working on Core Java/)
  assert.match(engineering.jobDescription, /BS\/MS in Computer Science\/Engineering/)
  assert.equal(engineering.applicationRequiresAccount, true)
})

test('bank application marker rejects unknown variants and wrong-role account redirects', async () => {
  for (const change of [
    html => html.replaceAll('public_jobs_apply-link-simple_onsite', 'public_jobs_apply-link-unreviewed'),
    html => html.replace(/(<a\b[^>]*data-tracking-control-name="public_jobs_nav-header-signin"[^>]*>)/g,
      tag => tag.replaceAll('4489910835', '1111111111')),
  ]) {
    const transport = replay(packet => packet.file === 'role-4489910835.body.gz' ? { ...packet, html: change(packet.html) } : packet)
    await assert.rejects(runVerifiedEmployerLinkedIn(config, { ...transport, now: () => '2026-11-13T07:30:00.000Z' }), /application|canonical.*identity/i)
  }
})

const sourceRun = (transport, options = {}) => createAirtelPaymentsBankScraper().run({
  ...transport, now: () => '2026-11-13T07:30:00.000Z',
  fetchText: async url => { throw Error('Obsolete shell route attempted: ' + url) }, ...options,
})

test('registered bank source enumerates the corporate-declared bank feed with all authored criteria', async () => {
  const transport = replay()
  const jobs = await sourceRun(transport)
  assert.equal(jobs.length, 16)
  assert.equal(transport.requests.filter(url => url.includes('/jobs/airtel-payments-bank-jobs-worldwide')).length, 2)
  assert.ok(transport.requests.every(url => !url.includes('careers.airtel.com') && !url.includes('/login') && !url.includes('/signup')))
  const job = jobs.find(row => row.jobId === '4489910835')
  assert.match(job.sourceDescription, /Spring &amp; Apache Kafka/)
  assert.match(job.sourceDescription, /Database Knowledge - Oracle, MySQL/)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'complete-inventory')
  assert.equal(inventory.listingComplete, true)
  assert.equal(inventory.reportedTotal, 16)
  assert.equal(inventory.lifecycleCleanupAllowed, false)
  const observed = readSourceObservationEvidence(jobs, 'airtelpaymentsbank')
  assert.equal(observed.observedVacancyCount, 16)
  assert.equal(observed.companyGlobalTotal, null)
  assert.equal(observed.companyIndiaTotal, null)
})

test('bank feed refuses parent employer substitution, hidden criteria, schema drift and incomplete pages', async () => {
  const changes = [
    packet => packet.file === 'corporate.body.gz' ? packet.html.replaceAll('https://www.linkedin.com/company/airtelpaymentsbank', 'https://www.linkedin.com/company/airtel') : packet.html,
    packet => packet.file === 'company.body.gz' ? packet.html.replaceAll('https%3A%2F%2Fwww%2Eairtelpayments%2Ebank%2Ein', 'https%3A%2F%2Fwww%2Eairtel%2Ein') : packet.html,
    packet => packet.file === 'role-4489910835.body.gz' ? packet.html.replace('show-more-less-html__markup show-more-less-html__markup--clamp-after-20', 'show-more-less-html__markup show-more-less-html__markup--clamp-after-20" hidden="hidden') : packet.html,
    packet => packet.file === 'role-4489910835.body.gz' ? packet.html.replace('3-6 years of experience of working on Core Java/J2EE', '9-12 years of experience of working on Core Java/J2EE') : packet.html,
    packet => packet.file === 'board.body.gz' ? packet.html.replace('urn:li:jobPosting:4489910835', 'urn:li:jobPosting:1111111111') : packet.html,
  ]
  for (const change of changes) await assert.rejects(sourceRun(replay(packet => ({ ...packet, html: change(packet) }))), /handoff|identity|reciprocal|description|criteria|inventory|card/i)
})

test('bank cannot publish hidden individual criteria from an otherwise visible native description', async () => {
  const transport = replay(packet => packet.file === 'role-4489910835.body.gz'
    ? { ...packet, html: packet.html.replace('<p>· Should have 3-6 years', '<p hidden>· Should have 3-6 years') } : packet)
  await assert.rejects(sourceRun(transport), /visible authored criteria.*hidden/i)
})

test('bank role identity and application availability require active native elements', async () => {
  for (const change of [
    html => html.replace('<h1 class="top-card-layout__title', '<h1 hidden class="top-card-layout__title'),
    html => html.replace('id="topbar-apply"', 'hidden id="topbar-apply"'),
  ]) {
    const transport = replay(packet => packet.file === 'role-4489910835.body.gz' ? { ...packet, html: change(packet.html) } : packet)
    await assert.rejects(sourceRun(transport), /active|visible|application|identity/i)
  }
})

test('bank application proof rejects disabled controls and inactive selected sign-in handoffs', async t => {
  const signIn = /<a\b[^>]*data-tracking-control-name="public_jobs_nav-header-signin"[^>]*>/
  const changes = [
    ['disabled button', html => html.replace('id="topbar-apply"', 'disabled id="topbar-apply"')],
    ['boolean disabled=false button', html => html.replace('id="topbar-apply"', 'disabled="false" id="topbar-apply"')],
    ['aria-disabled button', html => html.replace('id="topbar-apply"', 'aria-disabled="true" id="topbar-apply"')],
    ['aria-disabled button ancestor', html => html.replace(/(<button\b[^>]*id="topbar-apply"[^>]*>[\s\S]*?<\/button>)/, '<div aria-disabled="true">$1</div>')],
    ['disabled fieldset ancestor', html => html.replace(/(<button\b[^>]*id="topbar-apply"[^>]*>[\s\S]*?<\/button>)/, '<fieldset disabled>$1</fieldset>')],
    ['hidden selected sign-in', html => html.replace(signIn, tag => tag.replace('<a', '<a hidden'))],
    ['inert selected sign-in', html => html.replace(signIn, tag => tag.replace('<a', '<a inert'))],
    ['aria-disabled selected sign-in', html => html.replace(signIn, tag => tag.replace('<a', '<a aria-disabled="true"'))],
  ]
  for (const [label, change] of changes) await t.test(label, async () => {
    const transport = replay(packet => {
      if (packet.file !== 'role-4489910835.body.gz') return packet
      const html = change(packet.html)
      assert.notEqual(html, packet.html, 'Native counterexample must mutate the current response')
      return { ...packet, html }
    })
    await assert.rejects(sourceRun(transport), /enabled|disabled|active.*handoff|application/i)
  })
})

test('bank headings alone cannot certify complete authored criteria even with matching native schema', async () => {
  const transport = replay(packet => {
    if (packet.file !== 'role-4489910835.body.gz') return packet
    const headings = '<h2>Key Responsibilities</h2><h2>Skills Required</h2><h2>Qualifications</h2>'
    let html = packet.html.replace(/(<div class="show-more-less-html__markup[^\"]*"[^>]*>)[\s\S]*?(<\/div>)/, '$1' + headings + '$2')
    html = html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (original, open, value, close) => {
      const schema = JSON.parse(value)
      if (schema['@type'] !== 'JobPosting') return original
      return open + JSON.stringify({ ...schema, description: headings }) + close
    })
    return { ...packet, html }
  })
  await assert.rejects(sourceRun(transport), /visible authored criteria incomplete/i)
})

test('bank public acquisition retains its declared browser user agent at the HTTP boundary', async () => {
  const blocked = gunzipSync(await fs.readFile(new URL('corporate-node-403.body.gz', fixtureRoot))).toString()
  const transport = replay()
  const fetchImpl = async (url, options = {}) => {
    if (url === config.officialUrl && !new Headers(options.headers).get('user-agent')?.startsWith('Mozilla/5.0')) {
      const response = new Response(blocked, { status: 403 })
      Object.defineProperty(response, 'url', { value: url })
      return response
    }
    return transport.fetchImpl(url, options)
  }
  assert.equal((await sourceRun({ fetchImpl })).length, 16)
})

test('empty bank board retains unknown whole-company totals and forbids cleanup after decoration', async () => {
  const transport = replay(packet => packet.file === 'board.body.gz'
    ? { ...packet, html: packet.html.replace(/(class="results-context-header__job-count"[^>]*>\s*)16/, '$10') } : packet)
  const jobs = await sourceRun(transport)
  assert.equal(jobs.length, 0)
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'airtelpaymentsbank', companyName: 'Airtel Payments Bank' })
  assert.equal(readInventoryEvidence(decorated).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(decorated).reportedTotal, null)
  assert.equal(sourceLifecycleCleanupForbidden(decorated), true)
  assert.equal(readSourceObservationEvidence(decorated, 'airtelpaymentsbank').companyGlobalTotal, null)
})

test('bank closing changes, expired roles and aborts cannot certify complete inventory', async () => {
  const closing = replay(packet => packet.file === 'closing-board.body.gz'
    ? { ...packet, html: packet.html.replace('urn:li:jobPosting:4489910835', 'urn:li:jobPosting:1111111111') } : packet)
  await assert.rejects(sourceRun(closing), /closing|inventory|identity/i)
  const expired = replay(packet => packet.file === 'role-4489910835.body.gz'
    ? { ...packet, html: packet.html.replace('2026-12-11T09:12:04.000Z', '2026-10-11T09:12:04.000Z') } : packet)
  await assert.rejects(sourceRun(expired), /expired|date/i)
  const controller = new AbortController()
  const stopped = replay(packet => { controller.abort(new Error('cancel-bank')); return packet })
  await assert.rejects(sourceRun(stopped, { signal: controller.signal }), /cancel-bank/)
  assert.equal(stopped.requests.length, 1)
})

test('bank closing rejects untrusted complete role URLs before certifying stable inventory', async t => {
  const changes = [
    ['outside HTTP origin', url => url.replace('https://in.linkedin.com/', 'http://outside.example/')],
    ['outside HTTPS origin', url => url.replace('https://in.linkedin.com/', 'https://outside.example/')],
    ['HTTP LinkedIn origin', url => url.replace('https://', 'http://')],
    ['credential-bearing authority', url => url.replace('https://', 'https://native:fixture@')],
    ['nonstandard port', url => url.replace('in.linkedin.com/', 'in.linkedin.com:8443/')],
    ['explicit port', url => url.replace('in.linkedin.com/', 'in.linkedin.com:443/')],
    ['unknown role query', url => url + '&amp;unreviewed=1'],
    ['duplicate role query', url => url + '&amp;position=42'],
    ['role fragment', url => url + '#unreviewed'],
  ]
  for (const [label, change] of changes) await t.test(label, async () => {
    const transport = replay(packet => {
      if (packet.file !== 'closing-board.body.gz') return packet
      const html = packet.html.replace(/https:\/\/in\.linkedin\.com\/jobs\/view\/[^\"]+/g, change)
      assert.notEqual(html, packet.html, 'Closing counterexample must mutate current role links')
      return { ...packet, html }
    })
    await assert.rejects(sourceRun(transport), /URL.*identity|trusted|query|port/i)
  })
})

test('bank closing retains the advertised trusted www and in employer role URL variants', async () => {
  const transport = replay(packet => packet.file === 'closing-board.body.gz'
    ? { ...packet, html: packet.html.replaceAll('https://in.linkedin.com/jobs/view/', 'https://www.linkedin.com/jobs/view/') } : packet)
  const jobs = await sourceRun(transport)
  assert.equal(jobs.length, 16)
  assert.equal(jobs.nativeCollectionEvidence.closingStable, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('foreign-only bank board retains native observations and cleanup hold through catalog decoration', async () => {
  const transport = replay(packet => ({ ...packet, html: packet.html.replaceAll('India', 'Canada').replaceAll('"addressCountry":"IN"', '"addressCountry":"CA"') }))
  const jobs = await sourceRun(transport)
  assert.equal(jobs.length, 0)
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'airtelpaymentsbank', companyName: 'Airtel Payments Bank' })
  assert.equal(sourceLifecycleCleanupForbidden(decorated), true)
  assert.equal(readSourceObservationEvidence(decorated, 'airtelpaymentsbank').observedVacancyCount, 16)
  assert.equal(readInventoryEvidence(decorated).lifecycleCleanupAllowed, false)
})
