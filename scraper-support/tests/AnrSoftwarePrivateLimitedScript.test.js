import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import {nativeFixture} from '../../scraper/alkemlaboratories/nativeFixture.js'
const current=nativeFixture(new URL('../../scraper/anrsoftwareprivatelimited/native20261103.test.js',import.meta.url))
globalThis.fetch=async()=>{throw Error('OFFLINE registered ANR source tripwire')}

// Legacy synthetic wording below does not constitute native vacancy evidence.
const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - ANR Software Pvt Ltd.</title>
  </head>
  <body>
    <h1>Current Job Openings</h1>
    <h2>Java Intern</h2>
    <p>40 openings</p>
    <p>No vacancy for this position now. Visit again!</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/anrsoftwareprivatelimited/script.js')
  } catch {
    assert.fail('Expected ANR Software Private Limited scraper module at ../../scraper/anrsoftwareprivatelimited/script.js')
  }
}

test('registered ANR retains actual card criteria while country and vacancy identity remain unresolved', async () => {
  const anr = await loadModule()

  assert.equal(anr.SOURCE, 'anrsoftwareprivatelimited')
  assert.equal(anr.COMPANY, 'ANR Software Private Limited')
  assert.equal(anr.CAREERS_URL, 'https://www.anrsoftware.com/career/')
  const archive = JSON.parse(gunzipSync(readFileSync(
    new URL('../../scraper/anrsoftwareprivatelimited/fixtures/retained-http-20261029.json.gz', import.meta.url),
  )))
  const bytes = Buffer.from(archive.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), archive.receipt.sha256)
  const html = bytes.toString('utf8'), calls = [], audits = []
  const provider = getScraperCatalog().find(row => row.source === anr.SOURCE)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verificationIsHistorical, true)
  const controller = new AbortController()
  const jobs = await createCatalogScraper(provider).run({
    signal: controller.signal,
    fetchText: async (url, { signal }) => {
      assert.equal(signal.aborted,false)
      calls.push(url)
      return url===anr.CAREERS_URL?html:current.get(url)
    },
    onAudit: audit => audits.push(audit),
  })

  assert.equal(calls.filter(url=>url===anr.CAREERS_URL).length,2)
  assert.ok(calls.includes('https://www.anrsoftware.com/wp-content/themes/anr-software/js/functions.js?ver=20150330'))
  assert.equal(jobs.length, 0)
  assert.equal(audits.length, 1)
  const audit = audits[0]
  assert.equal(audit.originalCareersHTML, html)
  assert.equal(audit.observations.length, 47)
  assert.equal(audit.applicationForms.length, 2)
  assert.ok(audit.observations.every(row => row.country === null && row.jobId === null && !row.sourceDetailComplete))
  const writer = audit.observations[0]
  assert.equal(writer.title, 'Content Writer')
  assert.equal(writer.openingCountText, '02 openings')
  assert.ok(writer.descriptionBranches.some(branch => branch.text.includes('Eligibility:') && branch.text.includes('Job Description:')))
  assert.ok(audit.nativeIdCollisions.some(row => row.id === 'apply_3' && row.occurrences > 2))
  assert.equal(audit.lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('ANR no-vacancy wording cannot establish empty inventory or replace publisher identity', async () => {
  const anr = await loadModule()

  for (const html of [careersHtml, careersHtml.replace('No vacancy for this position now. Visit again!', 'Apply now')]) {
    const jobs = await anr.run({ fetchText: async url => url===anr.CAREERS_URL?html:current.get(url) })
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  }
  await assert.rejects(
    anr.createAnrsoftwareprivatelimitedScraper().run({
      fetchText: async url => url===anr.CAREERS_URL?careersHtml.replace('Career - ANR Software Pvt Ltd.', 'Another publisher'):current.get(url),
    }),
    /native careers employer identity changed/i,
  )
})
