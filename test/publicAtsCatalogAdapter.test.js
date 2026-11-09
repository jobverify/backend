import assert from 'node:assert/strict'
import test from 'node:test'
import { createPublicAtsCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = { source: 'acme', companyName: 'Acme', adapter: 'publicAts', atsPlatform: 'greenhouse', boardToken: 'acme',
  companyCareerPage: 'https://acme.test/careers', bindingEvidence: { verified: true, officialURL: 'https://acme.test/careers', matchedLinks: ['https://boards.greenhouse.io/acme'] } }
test('catalog adapter uses the verified shared ATS extractor and retains inventory evidence', async () => {
  const scraper = createPublicAtsCatalogScraper(provider)
  const jobs = await scraper.run({ fetchJson: async () => ({ meta: { total: 1 }, jobs: [{ id: 1, title: 'Engineer', location: { name: 'Bangalore, India' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/1', content: 'Build reliable software.' }] }) })
  assert.equal(scraper.name, 'acme')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'acme')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
test('a Greenhouse binding cannot authorize an Ashby board with the same company token', async () => {
  const scraper = createPublicAtsCatalogScraper({ ...provider, atsPlatform: 'ashby' })
  await assert.rejects(scraper.run({ fetchJson: async () => { throw new Error('must reject before fetching') } }), /binding/i)
})
