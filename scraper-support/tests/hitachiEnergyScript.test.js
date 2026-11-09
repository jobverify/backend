import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadHitachiEnergyModule = async () => {
  try {
    return await import('../../scraper/hitachienergy/script.js')
  } catch {
    assert.fail('Expected Hitachi Energy scraper module at ../../scraper/hitachienergy/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hitachienergy',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))
const detailPageHtml = `
<script>
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    "path": "/careers/open-jobs/details/JID3-204484",
    "pageID": "3-204484",
    "title": "Electrical Design Engineer - Auxiliary.-3-204484",
    "pageTitle": "Open Jobs",
    "description": "The opportunity Hitachi Energy seeks an Electrical Design Engineer. Your background 5\\x26#43; years of experience in design engineering and 3\\x26#43; years of experience with auxiliary systems.",
    "siteSection": "careers",
    "pageTemplate": "job-detail-page",
    "language": "en",
    "country": "India",
    "productName": "",
    "groupOwner": "not_set"
  });
</script>
`

test('buildListingApiUrl keeps Hitachi Energy requests on the official public jobs feed', async () => {
  const {
    LISTING_API_URL,
    buildListingApiUrl,
  } = await loadHitachiEnergyModule()

  assert.equal(
    LISTING_API_URL,
    'https://www.hitachienergy.com/careers/open-jobs/_jcr_content/root/container/content_1/content/grid_0/joblist.listsearchresults.json',
  )
  assert.equal(buildListingApiUrl(), LISTING_API_URL)
  assert.equal(buildListingApiUrl(20), `${LISTING_API_URL}?offset=20`)
})

test('extractSearchSummary reads Hitachi Energy pagination from the official public jobs feed', async () => {
  const { extractSearchSummary } = await loadHitachiEnergyModule()

  assert.deepEqual(extractSearchSummary(readJsonFixture('search-results-page-0.json')), {
    totalJobCount: 2238,
    pageSize: 20,
    hasMore: true,
  })
})

test('extractSearchResults maps official Hitachi Energy India listings and keeps direct Workday apply URLs', async () => {
  const { extractSearchResults } = await loadHitachiEnergyModule()
  const jobs = extractSearchResults(readJsonFixture('search-results-page-0.json'))
  const electricalDesignEngineer = jobs.find((job) => job.jobId === 'JID3-204484')

  assert.ok(electricalDesignEngineer)
  assert.deepEqual(electricalDesignEngineer, {
    title: 'Electrical Design Engineer – Auxiliary.',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: 'JID3-204484',
    requisitionId: 'R0131013',
    sourceUrl: 'https://www.hitachienergy.com/careers/open-jobs/details/JID3-204484',
    applyUrl: 'https://hitachi.wd1.myworkdayjobs.com/hitachi/job/Chennai-Tamil-Nadu-India/Electrical-Design-Engineer---Auxiliary_R0131013/apply',
    department: 'Engineering & Science',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
  })
})

test('extractJobDetail reads the public Hitachi detail data-layer payload and marks pages as checked', async () => {
  const { extractJobDetail } = await loadHitachiEnergyModule()

  const detail = extractJobDetail(detailPageHtml, {
    title: 'Electrical Design Engineer â€“ Auxiliary.',
    sourceUrl: 'https://www.hitachienergy.com/careers/open-jobs/details/JID3-204484',
  })

  assert.match(detail.jobDescription, /5\+ years of experience in design engineering/i)
  assert.equal(detail.publicExperienceChecked, true)
})

test('run keeps Hitachi Energy on the official feed and enriches India jobs from the public detail pages', async () => {
  const {
    LISTING_API_URL,
    createHitachiEnergyScraper,
  } = await loadHitachiEnergyModule()

  const requestedUrls = []
  const jobs = await createHitachiEnergyScraper().run({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === LISTING_API_URL) {
        return readJsonFixture('search-results-page-0.json')
      }
      throw new Error(`Unexpected Hitachi Energy URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, 'https://www.hitachienergy.com/careers/open-jobs/details/JID3-204484')
      return detailPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [
    LISTING_API_URL,
    'https://www.hitachienergy.com/careers/open-jobs/details/JID3-204484',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Hitachi Energy')
  assert.equal(jobs[0].source, 'hitachienergy')
  assert.equal(jobs[0].jobId, 'JID3-204484')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription, /5\+ years of experience in design engineering/i)
  assert.equal(
    jobs[0].applyUrl,
    'https://hitachi.wd1.myworkdayjobs.com/hitachi/job/Chennai-Tamil-Nadu-India/Electrical-Design-Engineer---Auxiliary_R0131013/apply',
  )
})
