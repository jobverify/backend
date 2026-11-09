import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadVestasModule = async () => {
  try {
    return await import('../../scraper/vestas/script.js')
  } catch {
    assert.fail('Expected Vestas scraper module at ../../scraper/vestas/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'vestas',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Vestas scraper stays on official India SuccessFactors pages and excludes non-India rows', async () => {
  const {
    buildIndiaSearchUrl,
    createVestasScraper,
    extractJobDetail,
    extractSearchResults,
  } = await loadVestasModule()
  const listingHtml = readFixture('india-search.html')
  const detailHtml = readFixture('job-detail-1396320733.html')

  assert.equal(
    buildIndiaSearchUrl(),
    'https://careers.vestas.com/search/?q=&locationsearch=India',
  )

  const listings = extractSearchResults(listingHtml)
  assert.deepEqual(listings, [{
    title: 'Industrial Cybersecurity Expert',
    location: 'Chennai, TN, IN, 600 117',
    city: 'Chennai',
    jobId: '1396320733',
    requisitionId: '1396320733',
    sourceUrl: 'https://careers.vestas.com/job/Chennai-Industrial-Cybersecurity-Expert-TN-600-117/1396320733/',
    postingDate: '2026-06-01',
  }])

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Industrial Cybersecurity Expert',
    location: 'Chennai, TN, IN, 600 117',
    city: 'Chennai',
    jobId: '1396320733',
    requisitionId: '75913',
    employmentType: 'Full-Time',
    experienceRequired: 'Specialist',
    jobDescription: 'Help secure Vestas industrial systems. Qualifications - Cybersecurity experience - SCADA knowledge',
    requiredSkills: ['Cybersecurity experience', 'SCADA knowledge'],
    postingDate: '2026-06-01',
    applyUrl: 'https://careers.vestas.com/talentcommunity/apply/1396320733/?locale=en_US',
    sourceUrl: 'https://careers.vestas.com/job/Chennai-Industrial-Cybersecurity-Expert-TN-600-117/1396320733/',
  })

  const requestedUrls = []
  const jobs = await createVestasScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaSearchUrl()) return listingHtml
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected Vestas URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [buildIndiaSearchUrl(), listings[0].sourceUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Vestas')
  assert.equal(jobs[0].source, 'vestas')
  assert.equal(jobs[0].requisitionId, '75913')
  assert.equal(jobs[0].applyUrl, 'https://careers.vestas.com/talentcommunity/apply/1396320733/?locale=en_US')
})
