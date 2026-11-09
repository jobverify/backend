import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixture = name => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
test('Persevex current homepage has active company identity and a current careers handoff', () => {
  const home = Buffer.from(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.find(row => row.transport === 'chrome-alternate-public-document' && row.url === scraper.HOMEPAGE_URL).bodyBase64, 'base64').toString('utf8')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  assert.equal(scraper.hasOfficialHomepageSignal(home.replace('href="/careers"', 'href="/unrelated"')), false)
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('persevex-home.html')), false)
})
test('Persevex preserves the current generic Remote role as unresolved geography', () => {
  const jobs = scraper.extractPublicJobs(fixture('current-careers.html'), fixture('persevex-careers-client.js'))
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.jobId !== 'social-intern' && job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.unverifiedGeographyCount, 3)
  assert.deepEqual(evidence.unresolvedRoles, [
    { id: 'placement-exec', title: 'Placement Executive', location: 'Hybrid (Pune / Remote)' },
    { id: 'social-intern', title: 'Social Media & Marketing Intern', location: 'Remote' },
    { id: 'hr-exec', title: 'Human Resource Executive', location: 'Hybrid (Bangalore / Remote)' },
  ])
})
