import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('October Drytis redesign verifies explicit empty careers and Caddy missing routes', async () => {
  const home = fixture('drytis-home.html')
  const about = fixture('drytis-about.html')
  const careers = fixture('drytis-careers.html')
  const missing = fixture('drytis-privacy.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  assert.equal(scraper.hasOfficialAboutSignal(about), true)
  const jobs = await scraper.run({ fetchPage: async url => ({ status: [scraper.HOMEPAGE_URL, scraper.ABOUT_URL, scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]].includes(url) ? 200 : 404, url, html: url === scraper.HOMEPAGE_URL ? home : url === scraper.ABOUT_URL ? about : url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0] ? careers : missing }) })
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence?.firstParty, true)
  assert.equal(evidence?.listingComplete, true)
  assert.equal(evidence?.reportedTotal, 0)
  assert.equal(evidence?.indiaFacetCount, 0)
  assert.ok(evidence?.pagesFetched >= 1 && Number.isFinite(Date.parse(evidence?.verifiedAt)))
})

test('Drytis rejects unrelated identity and vacancies added beside the empty-state copy', async () => {
  const home = fixture('drytis-home.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home.replaceAll('hello@drytis.com', 'hello@example.org')), false)
  const careers = fixture('drytis-careers.html') + '<section><h2>Current Openings</h2><a href="/careers/engineer">Apply Now</a></section>'
  await assert.rejects(scraper.run({ fetchPage: async url => ({ status: [scraper.HOMEPAGE_URL, scraper.ABOUT_URL, scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]].includes(url) ? 200 : 404, url, html: url === scraper.HOMEPAGE_URL ? home : url === scraper.ABOUT_URL ? fixture('drytis-about.html') : url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0] ? careers : fixture('drytis-privacy.html') }) }), /no-public-careers route changed/)
})
