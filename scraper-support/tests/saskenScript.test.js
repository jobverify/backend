import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadSaskenModule = async () => {
  try {
    return await import('../../scraper/sasken/script.js')
  } catch {
    assert.fail('Expected Sasken scraper module at ../../scraper/scraper/sasken/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sasken',
)

const readJsonFixture = (name) => JSON.parse(
  readFileSync(path.join(fixturesDir, name), 'utf8'),
)

test('Sasken URL builders stay on the public HireWand listing API', async () => {
  const {
    API_URL,
    CAREER_PAGE_URL,
    LISTING_PAGE_URL,
    buildListingFilter,
    buildListingUrl,
  } = await loadSaskenModule()

  assert.equal(API_URL, 'https://www.hirewand.com/public/listingdata')
  assert.equal(CAREER_PAGE_URL, 'https://careers.sasken.com/tb/saskenjobs/')
  assert.equal(
    LISTING_PAGE_URL,
    'https://www.hirewand.com/apply/job/listing?id=2022&country=ind&embed=true',
  )
  assert.equal(
    buildListingUrl(),
    'https://www.hirewand.com/public/listingdata?accountid=2022&limit=50&offset=0',
  )
  assert.equal(
    buildListingUrl({ limit: 2, offset: 100 }),
    'https://www.hirewand.com/public/listingdata?accountid=2022&limit=2&offset=100',
  )
  assert.equal(buildListingFilter(), '{"country":"ind"}')
})

test('extractSearchResults keeps only public Sasken India jobs from HireWand listings', async () => {
  const { extractSearchResults } = await loadSaskenModule()
  const payload = readJsonFixture('listing-india.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'LEAD ENGINEER - PS MODEM',
    company: 'Sasken',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '20222001',
    requisitionId: '17763',
    sourceUrl: 'https://www.hirewand.com/apply/job/detail?jid=20222001&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=151227&cpid=2022',
    applyUrl: 'https://www.hirewand.com/apply/job/detail?jid=20222001&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=151227&cpid=2022',
    employmentType: null,
    experienceRequired: '3-8 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'VSAT Systems',
      'iDirect Modems',
      'Link Budget',
      'OSPF',
      'BGP',
      'Ground Segment',
      'VSAT Troubleshooting',
      'MPLS VPN',
      'Network Monitoring',
      'IPv6',
      'TCP/IP',
      'QoS',
      'RIP',
      'GEO Networks',
      'IPv4',
    ],
    postingDate: '2026-06-23',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /Satellite Communication Engineer/i)
  assert.match(jobs[0].jobDescription, /Location:\s*Bangalore/i)

  assert.deepEqual(jobs[1], {
    title: 'ASSISTANT MANAGER- HR (RECRUITMENT)',
    company: 'Sasken',
    department: null,
    location: 'India',
    city: null,
    jobId: '20222017',
    requisitionId: '20222017',
    sourceUrl: 'https://www.hirewand.com/apply/job/detail?jid=20222017&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=147415&cpid=2022',
    applyUrl: 'https://www.hirewand.com/apply/job/detail?jid=20222017&sid=5c7d312c5e5efc0654130f23&src=jobpost&uid=147415&cpid=2022',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'ATS',
      'Boolean Search',
      'Candidate Screening',
      'Interview Scheduling',
      'Hiring Coordination',
      'Onboarding',
      'Offer Management',
      'Employer Branding',
      'HRIS',
      'Data Analytics',
      'Excel',
      'Recruitment Marketing',
      'Candidate Experience',
      'Compliance',
      'Vendor Management',
    ],
    postingDate: '2026-06-25',
    closingDate: null,
    jobDescription: 'Looking for a Recruiter to manage end-to-end recruitment across departments, from sourcing and screening to offers and onboarding.',
  })
})

test('run posts the Sasken India filter to HireWand and decorates shared runner fields', async () => {
  const {
    LISTING_PAGE_URL,
    buildListingUrl,
    createSaskenScraper,
  } = await loadSaskenModule()
  const payload = readJsonFixture('listing-india.json')
  const requests = []
  const scraper = createSaskenScraper({ pageSize: 2, maxJobs: 1 })

  const jobs = await scraper.run({
    fetchJson: async (url, options) => {
      requests.push({ url, options })
      return payload
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, buildListingUrl({ limit: 2, offset: 0 }))
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.Referer, LISTING_PAGE_URL)
  assert.equal(requests[0].options.body.get('filterjson'), '{"country":"ind"}')

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sasken')
  assert.equal(jobs[0].company, 'Sasken')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(typeof jobs[0].scrapedAt === 'string' && jobs[0].scrapedAt.length > 0)
})
