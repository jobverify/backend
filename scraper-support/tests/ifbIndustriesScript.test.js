import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ifbindustries',
)

const careersHtml = readFileSync(path.join(fixturesDir, 'career-jobs.html'), 'utf8')
const careerListPayload = JSON.parse(
  readFileSync(path.join(fixturesDir, 'career-list.json'), 'utf8'),
)

const loadIfbModule = async () => {
  try {
    return await import('../../scraper/ifbindustries/script.js')
  } catch {
    assert.fail('Expected IFB Industries scraper module at ../../scraper/ifbindustries/script.js')
  }
}

test('IFB Industries helpers recognize the verified first-party careers page and normalize the official GraphQL payload', async () => {
  const ifb = await loadIfbModule()

  assert.equal(ifb.SOURCE, 'ifbindustries')
  assert.equal(ifb.COMPANY, 'IFB Industries')
  assert.equal(ifb.CAREERS_URL, 'https://www.ifbappliances.com/career-jobs')
  assert.equal(
    ifb.GRAPHQL_URL,
    'https://edge-graph.adobe.io/api/c966e57b-84c0-4ebb-898a-6e860cf1f906/graphql',
  )
  assert.equal(ifb.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    ifb.buildJobDetailUrl('ifbareasalesgt'),
    'https://www.ifbappliances.com/career-jobs/career-job-detail?job_id=ifbareasalesgt',
  )

  const jobs = ifb.extractJobsFromPayload(careerListPayload, {
    scrapedAt: '2026-07-10T17:00:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Area Sales Executives or Senior Area Sales Executives- General Trade',
    company: 'IFB Industries',
    location: 'Goa',
    city: 'Goa',
    jobId: 'ifbareasalesgt',
    requisitionId: '1',
    sourceUrl: 'https://www.ifbappliances.com/career-jobs/career-job-detail?job_id=ifbareasalesgt',
    applyUrl: 'https://www.ifbappliances.com/career-jobs/career-job-detail?job_id=ifbareasalesgt',
    department: 'Consumer Goods',
    employmentType: null,
    experienceRequired: '5+ year',
    minimumQualification: 'BE',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2023-08-16',
    closingDate: null,
    jobDescription: [
      'Role Summary: To execute and achieve counter and/or account level objectives - Sales, Planogram, Visibility and other counter objectives General Trade or Specific channel All category / Specific Category',
      'Key Tasks: Visiting existing dealers at desired frequency Develop Rapport with Owners/Managers etc. Sell In / Product Introduction etc. Planogram Execution Receivables Problem Resolution / Escalation - Sales, Service, Commercials etc. Store promoter - Training Top-up Distributor DSO Training Merchandising Check New Dealer Creation. Competition Feedback New Channel Development',
      'Job Requisites: 18 to 20 days of market work Basic arithmetic & communication skill Working knowledge of Microsoft Word, Excel, PPT & Email Willing to relocate',
    ].join('\n\n'),
    source: 'ifbindustries',
    link: 'https://www.ifbappliances.com/career-jobs/career-job-detail?job_id=ifbareasalesgt',
    scrapedAt: '2026-07-10T17:00:00.000Z',
  })
})

test('IFB Industries scraper validates the official careers page before returning live jobs', async () => {
  const ifb = await loadIfbModule()
  const requestedUrls = []

  const jobs = await ifb.createIfbIndustriesScraper({
    now: () => new Date('2026-07-10T17:00:00.000Z'),
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: careersHtml }
    },
    fetchJson: async (url, options) => {
      requestedUrls.push(`${url}::${options?.method ?? 'GET'}`)
      return careerListPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    ifb.CAREERS_URL,
    `${ifb.GRAPHQL_URL}::POST`,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[2].jobId, 'ifbareasalesro')
})

test('IFB Industries scraper fails closed when the official page or GraphQL payload changes materially', async () => {
  const ifb = await loadIfbModule()

  await assert.rejects(
    ifb.createIfbIndustriesScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: '<html><title>Unexpected</title></html>' }),
      fetchJson: async () => careerListPayload,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    ifb.createIfbIndustriesScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: careersHtml }),
      fetchJson: async () => ({ data: { careerList: { items: [] } } }),
    }),
    /official careers api returned no public jobs/i,
  )
})
