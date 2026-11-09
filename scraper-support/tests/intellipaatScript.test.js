import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'intellipaat')

const loadFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const listingHtml = loadFixture('listing-page.html')
const cloudAutomationDetailHtml = loadFixture('job-detail-cloud-automation-developer-india.html')
const aiDeveloperDetailHtml = loadFixture('job-detail-ai-developer-salesforce-admin-2.html')

const loadIntellipaatModule = async () => {
  try {
    return await import('../../scraper/intellipaat/script.js')
  } catch {
    assert.fail('Expected Intellipaat scraper module at ../../scraper/intellipaat/script.js')
  }
}

test('Intellipaat extracts verified first-party listing cards and JSON-LD detail fields', async () => {
  const intellipaat = await loadIntellipaatModule()

  assert.equal(intellipaat.SOURCE, 'intellipaat')
  assert.equal(intellipaat.COMPANY, 'Intellipaat')
  assert.equal(intellipaat.CAREERS_URL, 'https://intellipaat.com/careers/')
  assert.equal(intellipaat.JOBS_URL, 'https://jobs.intellipaat.com/')

  const listings = intellipaat.extractJobCards(listingHtml)
  assert.equal(listings.length, 4)
  assert.deepEqual(listings[0], {
    title: 'Cloud Automation Developer, India',
    company: 'AlgoSec',
    location: 'New Delhi, Delhi, India',
    sourceUrl: 'https://jobs.intellipaat.com/job/cloud-automation-developer-india/',
    applyUrl: 'https://jobs.intellipaat.com/job/cloud-automation-developer-india/',
  })

  const detail = intellipaat.extractJobDetail(cloudAutomationDetailHtml)
  assert.equal(detail?.title, 'Cloud Automation Developer, India')
  assert.equal(detail?.company, 'AlgoSec')
  assert.equal(detail?.location, 'New Delhi, Delhi, India')
  assert.equal(detail?.employmentType, 'Full-time')
  assert.equal(detail?.postingDate, '2026-07-08')
  assert.equal(detail?.closingDate, '2026-08-31')
  assert.equal(detail?.applyUrl, 'https://jobs.intellipaat.com/job/cloud-automation-developer-india/')
  assert.match(detail?.jobDescription ?? '', /At AlgoSec, what you do matters!/i)
})

test('Intellipaat run stays on the verified first-party jobs domain and decorates final jobs', async () => {
  const intellipaat = await loadIntellipaatModule()
  const requests = []

  const jobs = await intellipaat.createIntellipaatScraper().run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === intellipaat.JOBS_URL) return listingHtml
      if (url === 'https://jobs.intellipaat.com/job/cloud-automation-developer-india/') {
        return cloudAutomationDetailHtml
      }
      if (url === 'https://jobs.intellipaat.com/job/ai-developer-salesforce-admin-2/') {
        return aiDeveloperDetailHtml
      }
      if (url === 'https://jobs.intellipaat.com/job/salesforce-administrator-rca-cpq-8yrs-irc293975/') {
        return aiDeveloperDetailHtml.replace(/AI Developer Salesforce Admin/gi, 'Salesforce Administrator (RCA/CPQ ) 8+yrs IRC293975')
      }
      if (url === 'https://jobs.intellipaat.com/job/salesforce-marketing-cloud/') {
        return aiDeveloperDetailHtml.replace(/AI Developer Salesforce Admin/gi, 'Salesforce Marketing Cloud')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    intellipaat.JOBS_URL,
    'https://jobs.intellipaat.com/job/cloud-automation-developer-india/',
    'https://jobs.intellipaat.com/job/salesforce-administrator-rca-cpq-8yrs-irc293975/',
    'https://jobs.intellipaat.com/job/ai-developer-salesforce-admin-2/',
    'https://jobs.intellipaat.com/job/salesforce-marketing-cloud/',
  ])

  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'intellipaat')
  assert.equal(jobs[0].company, 'Intellipaat')
  assert.equal(jobs[0].jobId, 'cloud-automation-developer-india')
  assert.equal(jobs[0].requisitionId, 'cloud-automation-developer-india')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].city, 'New Delhi')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
