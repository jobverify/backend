import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as ascent from '../../scraper/ascenthealth/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const read = async name => gunzipSync(await fs.readFile(new URL('../../scraper/ascenthealth/test-data/current-20261103/' + name + '.html.gz', import.meta.url))).toString('utf8')

test('Ascent retains official surface helpers without claiming a historic empty-state verification', async () => {
  assert.equal(ascent.SOURCE, 'ascenthealth')
  assert.equal(ascent.COMPANY, 'Ascent Health')
  assert.equal(ascent.OFFICIAL_BRAND_NAME, 'Ascent Health')
  assert.equal(ascent.VERIFIED_ON, null)
  assert.equal(ascent.HOMEPAGE_URL, 'https://www.ascenthealthcare.com/')
  assert.equal(ascent.CAREERS_PAGE_URL, 'https://www.ascenthealthcare.com/careers/')
  assert.equal(ascent.hasOfficialHomepageSignal(await read('homepage')), true)
  assert.equal(ascent.hasOfficialCareersSignal(await read('careers')), true)
  assert.deepEqual(ascent.extractPublicJobLinks(await read('careers')), [])
  assert.deepEqual(ascent.extractPublicJobLinks('<a href="https://www.ascenthealthcare.com/careers/native-role/">Analyst</a>'), ['https://www.ascenthealthcare.com/careers/native-role/'])
})

test('Ascent historical sitemap helpers stay diagnostic while current observations remain unqualified', () => {
  const index = '<sitemapindex><sitemap><loc>https://www.ascenthealthcare.com/page-sitemap.xml</loc></sitemap></sitemapindex>'
  const sitemap = '<urlset>' + ascent.SITEMAP_CAREER_ROUTE_URLS.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>'
  assert.equal(ascent.hasExpectedSitemapIndex(index), true)
  assert.equal(ascent.hasExpectedCareerRouteSet(sitemap), true)
  assert.equal(ascent.hasExpectedCareerRouteSet(sitemap.replace('</urlset>', '<url><loc>https://www.ascenthealthcare.com/careers/native-role/</loc></url></urlset>')), false)
})

test('Ascent opening and closing hiring entry reads carry fresh incomplete inventory evidence', async () => {
  const pages = new Map([[ascent.HOMEPAGE_URL, await read('homepage')], [ascent.CAREERS_PAGE_URL, await read('careers')]])
  const requested = []
  const jobs = await ascent.run({ fetchPage: async url => {
    requested.push(url); assert.ok(pages.has(url))
    return { status: 200, url, html: pages.get(url) }
  } })
  assert.deepEqual(requested, [ascent.HOMEPAGE_URL, ascent.CAREERS_PAGE_URL, ascent.HOMEPAGE_URL, ascent.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
