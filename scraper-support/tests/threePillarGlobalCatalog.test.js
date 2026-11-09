import assert from 'node:assert/strict'
import test from 'node:test'
import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { THREE_PILLAR_GLOBAL_CATALOG } from '../../scraper/3pillarglobal/catalog.js'
import { CAREERS_URL, createThreePillarGlobalScraper } from '../../scraper/3pillarglobal/script.js'

const BOARD = 'https://3pillar.darwinbox.com/ms/candidatev2/main/careers/allJobs'
const API = 'https://3pillar.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main'
const CAREERS = '<title>3Pillar Career Opportunities</title><h1>Career opportunities</h1><a href="' + BOARD + '">View Opportunities</a>'
const record = (id, location = 'Noida, Uttar Pradesh, India') => ({
  id, title: 'Senior Software Engineer', locations: location, country: 'India',
  department_name: 'Engineering', emp_type_name: 'Employee', experience: '5 - 8 Years',
  posted_on: '1790793000', jd: '<p>Build reliable services.</p>',
})

test('3Pillar executes the linked Darwinbox listing with public session seeding and pagination', async () => {
  const posts = []
  const fetchImpl = async (url, init) => {
    if (url === BOARD) return new Response('<title>3Pillar Group</title>', { headers: { 'set-cookie': 'public=example; Path=/; Secure' } })
    assert.equal(url, API)
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.cookie, 'public=example')
    const body = JSON.parse(init.body)
    posts.push(body)
    return Response.json({ status: 'success', job_counts: 2, data: [record('role-' + body.page)] })
  }
  const jobs = await createThreePillarGlobalScraper({ pageSize: 1, fetchImpl, now: () => '2026-10-03T00:00:00.000Z' }).run({
    fetchText: async (url) => { assert.equal(url, CAREERS_URL); return CAREERS },
  })
  assert.deepEqual(posts, [
    { companyId: 'main', sort_option: 'new', limit: 1, page: 1 },
    { companyId: 'main', sort_option: 'new', limit: 1, page: 2 },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, '3Pillar Global')
  assert.equal(jobs[0].source, '3pillarglobal')
  assert.equal(jobs[0].sourceUrl, 'https://3pillar.darwinbox.com/ms/candidatev2/main/careers/jobDetails/role-1')
  assert.equal(jobs[0].atsPlatform, 'darwinbox')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('3Pillar rejects an official page with no current Darwinbox handoff before enumeration', async () => {
  await assert.rejects(createThreePillarGlobalScraper().run({
    fetchText: async () => '<title>3Pillar Career Opportunities</title><a href="https://jobs.lever.co/3pillarglobal">Old board</a>',
    fetchListingPage: async () => assert.fail('Unverified handoff must not enumerate'),
  }), /Darwinbox handoff/)
})

test('3Pillar never turns malformed or denied listings into empty jobs', async () => {
  for (const payload of [{ status: 'success' }, { status: 'success', job_counts: 1, data: [] }]) {
    await assert.rejects(createThreePillarGlobalScraper().run({
      fetchText: async () => CAREERS, fetchListingPage: async () => payload,
    }), /malformed or incomplete/)
  }
  const error = Object.assign(new Error('HTTP 403'), { status: 403 })
  await assert.rejects(createThreePillarGlobalScraper().run({
    fetchText: async () => CAREERS, fetchListingPage: async () => { throw error },
  }), (err) => err.failureKind === 'blocked_or_access_denied')
})

test('3Pillar decorates confirmed empty listings and propagates cancellation', async () => {
  assert.deepEqual(await createThreePillarGlobalScraper().run({
    fetchText: async () => CAREERS, fetchListingPage: async () => ({ status: 'success', job_counts: 0, data: [] }),
  }), [])
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(createThreePillarGlobalScraper().run({
    signal: controller.signal, fetchText: async () => assert.fail('Cancelled source must not fetch'),
  }), /cancelled/)
})

test('3Pillar catalog and exact backlog match expose the verified replacement board', () => {
  const provider = hydrateProviderCatalogEntry(THREE_PILLAR_GLOBAL_CATALOG)
  assert.equal(provider.darwinboxBoardUrl, BOARD)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  const report = generateCompanyCoverageReport({ csvText: '3Pillar Global\n', catalog: [provider] })
  assert.equal(report.matchedCount, 1)
})
