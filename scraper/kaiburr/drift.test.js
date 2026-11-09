import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Kaiburr Framer redesign retains first-party identity and verified missing careers', async () => {
  const home = fixture('kaiburr-home.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  assert.deepEqual(await scraper.run({ fetchPage: async url => ({ status: [scraper.HOMEPAGE_URL, scraper.SITEMAP_URL].includes(url) ? 200 : 404, url, html: url === scraper.HOMEPAGE_URL ? home : url === scraper.SITEMAP_URL ? fixture('kaiburr-sitemap.html') : fixture('kaiburr-careers.html') }) }), [])
})

test('Kaiburr rejects unrelated domain identity or a careers page appearing', async () => {
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('kaiburr-home.html').replaceAll('https://kaiburr.com/', 'https://example.org/')), false)
  await assert.rejects(scraper.run({ fetchPage: async url => ({ status: 200, url, html: url === scraper.HOMEPAGE_URL ? fixture('kaiburr-home.html') : url === scraper.SITEMAP_URL ? fixture('kaiburr-sitemap.html') : '<h1>Careers</h1>' }) }), /no-public-careers route changed/)
})


test('Kaiburr absent public careers routes do not certify company-wide empty inventory', async () => {
  const jobs = await scraper.run({fetchPage:async url => ({status:url === scraper.HOMEPAGE_URL || url === scraper.SITEMAP_URL ? 200 : 404,url,html:fixture(url === scraper.HOMEPAGE_URL ? 'kaiburr-home.html' : url === scraper.SITEMAP_URL ? 'kaiburr-sitemap.html' : 'kaiburr-careers.html')})})
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
