import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { fixture, greenhousePayload, transport } from '../../scraper-support/tests/corporateFeedFixture20261118.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const entries = ({ india = false, corporate = fixture('lob', 'lob') } = {}) => new Map([
  [CAREERS_URL, corporate], ['https://lob.com/', corporate],
  ['https://boards-api.greenhouse.io/v1/boards/lob/jobs?content=true', greenhousePayload('lob', 'lob-jobs', { india })],
  ['https://boards-api.greenhouse.io/v1/boards/lob1/jobs?content=true', greenhousePayload('lob', 'lob1-jobs')],
])

test('Lob inline board initializers recover located India roles and retain both native feeds', async () => {
  const jobs = await run({ fetchImpl: transport(entries({ india: true })) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].sourceDescription, /\w{5}/)
  assert.equal(jobs[0].company, 'Lob')
  assert.deepEqual(jobs.nativeCollectionEvidence.nativeBoards.map(b => b.nativeRecords.length), [4, 0])
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Lob foreign-only configured feeds reconcile opening and closing snapshots while retaining the company scope hold', async () => {
  const jobs = await run({ fetchImpl: transport(entries()) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords.length, 4)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const change of ['title', 'removed', 'new']) test('Lob closing ' + change + ' role drift prevents configured native completeness', async () => {
  const pages = entries(), read = transport(pages)
  let observed = 0
  const jobs = await run({ fetchImpl: async url => {
    if (String(url).includes('/boards/lob/jobs') && ++observed === 2) {
      const changed = JSON.parse(pages.get(String(url)).body)
      if (change === 'title') changed.jobs[0].title = 'A role changed during the read'
      if (change === 'removed') changed.jobs.pop()
      if (change === 'new') changed.jobs.push({ ...changed.jobs[0], id: 9999999,
        absolute_url: 'http://www.lob.com/careers/apply?gh_jid=9999999' })
      changed.meta.total = changed.jobs.length
      return transport(new Map([[String(url), { body: JSON.stringify(changed), json: true }]]))(url)
    }
    return read(url)
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(observed, 2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Lob changed closing corporate feed declarations retain the company scope hold', async () => {
  const pages = entries(), read = transport(pages)
  let observed = 0
  const jobs = await run({ fetchImpl: async url => {
    if (String(url) === CAREERS_URL && ++observed === 2) return transport(new Map([[CAREERS_URL,
      fixture('lob', 'lob').replace('/boards/lob1/jobs', '/boards/another/jobs')]]))(url)
    return read(url)
  } })
  assert.equal(observed, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Lob cannot adopt a feed row from an unrelated employer or corporate role host', async () => {
  for (const mutation of ['employer', 'url']) {
    const pages = entries({ india: true }), endpoint = 'https://boards-api.greenhouse.io/v1/boards/lob/jobs?content=true'
    const data = JSON.parse(pages.get(endpoint).body)
    if (mutation === 'employer') data.jobs[0].company_name = 'Globex'
    else data.jobs[0].absolute_url = 'https://unrelated.example/careers/apply?gh_jid=' + data.jobs[0].id
    pages.set(endpoint, { body: JSON.stringify(data), json: true })
    await assert.rejects(run({ fetchImpl: transport(pages) }))
  }
})

test('Lob cannot adopt inline feed URLs hidden in inert templates', async () => {
  await assert.rejects(run({ fetchImpl: transport(entries({ corporate:
    '<title>Careers at Lob</title><template>' + fixture('lob', 'lob') + '</template>' })) }))
})
