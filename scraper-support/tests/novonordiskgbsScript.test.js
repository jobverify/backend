import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadNovoNordiskGbsModule = async () => {
  try {
    return await import('../../scraper/novonordiskgbs/script.js')
  } catch {
    assert.fail('Expected Novo Nordisk GBS scraper module at ../../scraper/novonordiskgbs/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'novonordiskgbs',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Novo Nordisk GBS scraper keeps requests on the official public board and filters for Bengaluru GBS roles', async () => {
  const {
    buildIndiaSearchUrl,
    createNovoNordiskGBSScraper,
    extractJobDetail,
    extractResultsSummary,
    extractSearchResults,
    isBengaluruLocation,
    isNovoNordiskGbsOrganization,
  } = await loadNovoNordiskGbsModule()

  const listingHtml = readFixture('india-search.html')
  const gbsDetailHtml = readFixture('job-detail-1401136833.html')
  const nonGbsDetailHtml = readFixture('job-detail-1401136834.html')

  assert.equal(
    buildIndiaSearchUrl(),
    'https://careers.novonordisk.com/search/?q=&locationsearch=India',
  )
  assert.equal(
    buildIndiaSearchUrl(100),
    'https://careers.novonordisk.com/search/?q=&locationsearch=India&startrow=100',
  )

  assert.deepEqual(extractResultsSummary(listingHtml), {
    totalResults: 388,
    currentPage: 1,
    totalPages: 4,
    pageSize: 100,
  })

  const listings = extractSearchResults(listingHtml)
  assert.deepEqual(listings, [{
    title: 'Global Customer Insights Associate Lead',
    location: 'Bangalore, Karnataka, IN',
    city: 'Bangalore',
    department: 'Data & AI',
    jobId: '1401136833',
    requisitionId: null,
    sourceUrl: 'https://careers.novonordisk.com/job/Bangalore-Global-Customer-Insights-Associate-Lead-Karn/1401136833/',
    postingDate: '2026-07-04',
  }, {
    title: 'Senior Counsel',
    location: 'Bangalore, Karnataka, IN',
    city: 'Bangalore',
    department: 'Legal, Compliance & Audit',
    jobId: '1401136834',
    requisitionId: null,
    sourceUrl: 'https://careers.novonordisk.com/job/Bangalore-Senior-Counsel-Karn/1401136834/',
    postingDate: '2026-07-03',
  }])

  const detail = extractJobDetail(gbsDetailHtml, listings[0])
  assert.equal(detail.title, 'Global Customer Insights Associate Lead')
  assert.equal(detail.location, 'Bangalore, Karnataka, IN')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.department, 'Data & AI')
  assert.equal(detail.jobId, '1401136833')
  assert.equal(detail.requisitionId, '341290')
  assert.equal(detail.employmentType, 'Full-Time')
  assert.equal(detail.experienceRequired, 'Experienced Professionals')
  assert.equal(detail.organization, 'Novo Nordisk Global Business Services')
  assert.equal(detail.postingDate, '2026-07-04')
  assert.equal(
    detail.applyUrl,
    'https://careers.novonordisk.com/talentcommunity/apply/1401136833/?locale=en_GB',
  )
  assert.match(detail.jobDescription, /lead gbs insight delivery/i)
  assert.ok(detail.requiredSkills.includes('Build GBS insight roadmaps'))
  assert.ok(isBengaluruLocation(detail.location))
  assert.ok(isNovoNordiskGbsOrganization(detail.organization))
  assert.equal(isNovoNordiskGbsOrganization('Novo Nordisk'), false)

  let requests = 0
  await assert.rejects(createNovoNordiskGBSScraper().run({
    fetchText: async () => { requests++; return listingHtml },
  }), /HTTP response metadata/)
  assert.equal(requests, 0)
})
