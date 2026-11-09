import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('INDmoney current LinkedIn brand tagline retains exact employer and India filtering', async () => {
  const company = { status: 200, url: 'https://in.linkedin.com/company/indmoney', html: fixture('indmoney-linkedin-company.html') }
  assert.equal(scraper.hasVerifiedLinkedInCompanySignal(company), true)
  const jobs = await scraper.run({ fetchPage: async url => url === scraper.OFFICIAL_REDIRECT_SOURCE_URL ? { status:403, url:scraper.OFFICIAL_BRAND_HOMEPAGE_URL, html:fixture('indwealth-home.html') } : url === scraper.OFFICIAL_ABOUT_URL ? { status:403, url, html:fixture('indwealth-about.html') } : company, fetchText: async url => url === scraper.LINKEDIN_PUBLIC_JOBS_URL ? fixture('indmoney-linkedin-jobs.html') : '<html></html>' })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(j => j.company === 'INDmoney' && j.country === 'India'))
  assert.equal(scraper.hasVerifiedLinkedInCompanySignal({ ...company, url:'https://in.linkedin.com/company/unrelated' }), false)
})


test('INDmoney captured mixed-employer cards are bounded and discard incomplete rows', () => {
  const jobs = scraper.extractSearchResults(fixture('indmoney-linkedin-jobs.html'))
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.company === 'INDmoney' && job.country === 'India'))
  const invalid = '<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:1"><h3 class="base-search-card__title">Incomplete</h3>'
  assert.equal(scraper.extractSearchResults(invalid + fixture('indmoney-linkedin-jobs.html')).length, 4)
})


test('INDmoney keyword guest inventory marks verified rows incomplete for retirement protection', async () => {
  const company = {status:200,url:'https://in.linkedin.com/company/indmoney',html:fixture('indmoney-linkedin-company.html')}
  const jobs = await scraper.run({fetchPage: async url => url === scraper.OFFICIAL_REDIRECT_SOURCE_URL ? {status:403,url:scraper.OFFICIAL_BRAND_HOMEPAGE_URL,html:fixture('indwealth-home.html')} : url === scraper.OFFICIAL_ABOUT_URL ? {status:403,url,html:fixture('indwealth-about.html')} : company,fetchText:async url => url === scraper.LINKEDIN_PUBLIC_JOBS_URL ? fixture('indmoney-linkedin-jobs.html') : '<html></html>'})
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})
