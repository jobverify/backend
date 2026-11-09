import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createAindraSystemsScraper, HOMEPAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const read = file => gunzipSync(fs.readFileSync(new URL(`./test-data/${file}`, import.meta.url))).toString('utf8')
const homepage = read('homepage-20261102.html.gz')
const client = read('client-20261102.js.gz')
const entryUrl = new URL('/assets/index-BGIjLXqg.js', HOMEPAGE_URL).href
function fixture({ html = homepage, js = client, onFetch } = {}) {
  const calls = []
  return { calls, async fetchText(url, options = {}) {
    calls.push(url)
    onFetch?.(url, options)
    if (url === HOMEPAGE_URL) return html
    if (url === entryUrl) return js
    throw new Error('Unexpected source URL')
  } }
}

test('Aindra current public app retains four native briefs without inventing job criteria or countries', async () => {
  const f = fixture()
  let audit
  const jobs = await createAindraSystemsScraper().run({ fetchText: f.fetchText, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0, 'unqualified briefs must stay outside persistence candidates')
  const briefs = audit.nativeBriefs
  assert.deepEqual(briefs.map(job => job.title), ['Developer', 'Electronics Engineer', 'Mechatronics Engineer', 'Mechanical Engineer'])
  assert.deepEqual(f.calls, [HOMEPAGE_URL, entryUrl])
  assert.ok(briefs.every(job => job.location === 'Bangalore, Karnataka' && job.country === null))
  assert.ok(briefs.every(job => job.jobDescription === null && !hasSourceDescription(job)))
  assert.ok(briefs.every(job => job.sourceDetailComplete === false && job.sourceListingComplete === false))
  assert.deepEqual(briefs.map(job => job.nativeSourceRecord.id), [1, 2, 3, 4])
  assert.ok(briefs.every(job => job.requisitionId === null && job.postingDate === null && job.closingDate === null))
  assert.equal(readSourceObservationEvidence(jobs, 'aindrasystems')?.observedVacancyCount, 4)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.indiaFacetCount, null)
  assert.match(evidence?.reason || '', /description.*country|country.*description/i)
})

test('Aindra caller cancellation reaches the current app asset request and cannot be converted into zero jobs', async () => {
  const controller = new AbortController(), reason = new Error('stop Aindra')
  const f = fixture({ onFetch(url, options) {
    assert.equal(options.signal, controller.signal)
    if (url === entryUrl) controller.abort(reason)
  } })
  await assert.rejects(createAindraSystemsScraper().run({ signal: controller.signal, fetchText: f.fetchText }), error => error === reason)
  assert.deepEqual(f.calls, [HOMEPAGE_URL, entryUrl])
})

test('Aindra an inactive app entry inside a template cannot supply native vacancies', async () => {
  const html = homepage.replace(/(<script type="module" crossorigin src="\/assets\/index-[^"]+"[^>]*><\/script>)/,
    '<template>$1</template>')
  assert.notEqual(html, homepage)
  const f = fixture({ html })
  await assert.rejects(createAindraSystemsScraper().run({ fetchText: f.fetchText }))
  assert.deepEqual(f.calls, [HOMEPAGE_URL])
})

test('Aindra foreign app entry cannot be fetched or supply native vacancies', async () => {
  const html = homepage.replace('src="/assets/index-BGIjLXqg.js"', 'src="https://example.org/assets/index-BGIjLXqg.js"')
  assert.notEqual(html, homepage)
  const f = fixture({ html })
  await assert.rejects(createAindraSystemsScraper().run({ fetchText: f.fetchText }))
  assert.deepEqual(f.calls, [HOMEPAGE_URL])
})

test('Aindra an unused retained array is not the current openings inventory', async () => {
  const js = client.replace('children:t2.map(', 'children:[].map(')
  assert.notEqual(js, client)
  await assert.rejects(createAindraSystemsScraper().run({ fetchText: fixture({ js }).fetchText }))
})

test('Aindra role cards from an unrelated route cannot be counted as current careers', async () => {
  const js = client.replace('case"/careers":return l.jsx(n2,{})', 'case"/unrelated":return l.jsx(n2,{})')
  assert.notEqual(js, client)
  await assert.rejects(createAindraSystemsScraper().run({ fetchText: fixture({ js }).fetchText }))
})

test('Aindra app mutations cannot turn a stale literal initializer into qualified role data', async () => {
  const js = `${client}\nt2.push({id:5,title:"Injected role",location:"India"});`
  await assert.rejects(createAindraSystemsScraper().run({ fetchText: fixture({ js }).fetchText }))
})

test('Aindra local audit callback failures cannot be converted into upstream host unavailability', async () => {
  const reason = new Error('certificate audit sink unavailable')
  let auditCalls = 0, requests = 0
  await assert.rejects(createAindraSystemsScraper().run({
    fetchText: async url => { requests++; return new URL(url).pathname === '/' ? homepage : client },
    onAudit: async () => { auditCalls++; throw reason },
  }), error => error === reason)
  assert.equal(auditCalls, 1)
  assert.equal(requests, 2)
})

test('Aindra source cancellation aborts the actual default fallback request signal', async () => {
  const original = globalThis.fetch
  const controller = new AbortController(), reason = new Error('cancel default fallback')
  let requestSignal
  globalThis.fetch = async (url, options) => {
    requestSignal = options.signal
    controller.abort(reason)
    throw new Error('test fallback ended after inspecting its signal')
  }
  try {
    await assert.rejects(createAindraSystemsScraper().run({ signal: controller.signal,
      fetchText: async () => { throw new Error('HTTP 403') },
    }), error => error === reason)
    assert.equal(requestSignal?.aborted, true)
  } finally { globalThis.fetch = original }
})
