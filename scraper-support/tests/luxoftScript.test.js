import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadLuxoftModule = async () => {
  try {
    return await import('../../scraper/luxoft/script.js')
  } catch {
    assert.fail('Expected Luxoft scraper module at ../../scraper/scraper/luxoft/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'luxoft',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl and extractPaginationSummary preserve Luxoft India pagination state', async () => {
  const { buildSearchUrl, extractPaginationSummary } = await loadLuxoftModule()
  const html = readHtmlFixture('india-jobs.html')

  assert.equal(buildSearchUrl(), 'https://career.luxoft.com/jobs?keyword=&country%5B%5D=India')
  assert.equal(
    buildSearchUrl({ page: 3 }),
    'https://career.luxoft.com/jobs?keyword=&country%5B%5D=India&page=3',
  )
  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    currentPage: 1,
    totalPages: 42,
  })
})

test('extractSearchResults maps Luxoft India listing cards into shared scraper fields', async () => {
  const { extractSearchResults } = await loadLuxoftModule()
  const html = readHtmlFixture('india-jobs.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 15)
  assert.deepEqual(jobs[0], {
    title: 'SQL DBA Engineer',
    company: 'Luxoft',
    department: 'IT Infrastructure Engineering',
    location: 'Remote India, India',
    city: 'Remote India',
    jobId: '25504',
    requisitionId: '25504',
    sourceUrl: 'https://career.luxoft.com/jobs/sql-dba-engineer-25504',
    applyUrl: 'https://career.luxoft.com/jobs/sql-dba-engineer-25504',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].title, 'QA Automation Engineer (UFT/SAP)')
  assert.equal(jobs[1].department, 'Automated Testing C#')
  assert.equal(jobs[1].jobId, '25503')
  assert.equal(jobs[1].city, 'Remote India')
})

test('extractJobDetail enriches a Luxoft listing with JSON-LD and page details', async () => {
  const { extractJobDetail, extractSearchResults } = await loadLuxoftModule()
  const listingHtml = readHtmlFixture('india-jobs.html')
  const detailHtml = readHtmlFixture('job-sql-dba-engineer-25504.html')
  const listing = extractSearchResults(listingHtml)[0]
  const job = extractJobDetail(detailHtml, listing)

  assert.deepEqual(job, {
    title: 'SQL DBA Engineer',
    company: 'Luxoft',
    department: 'IT Infrastructure Engineering',
    location: 'Remote India, India',
    city: 'Remote India',
    jobId: '25504',
    requisitionId: 'VR-123708',
    sourceUrl: 'https://career.luxoft.com/jobs/sql-dba-engineer-25504',
    applyUrl: 'https://career.luxoft.com/jobs/sql-dba-engineer-25504',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Security: Proven design/implementation of Azure RBAC, Zero Trust architectures, Azure Key Vault, Network Security Groups (NSGs), Azure Firewall, Defender for Cloud, and enterprise data encryption (at rest / in transit).',
      'Networking: Architectural experience designing hybrid topologies including Azure ExpressRoute, Site-to-Site VPNs, VNet Peering, Hub-and-Spoke models, DNS routing, and enterprise Load Balancing (App Gateway / Traffic Manager).',
      'Storage: Design of enterprise cloud storage solutions including Azure Storage Accounts (Blob, File, Queue), Managed Disks, IOPS optimization, redundancy tiering (LRS/GRS/ZRS), and legacy SAN/NAS-to-cloud migration concepts.',
      'AWS Technologies (Mid-Level)',
      'SQL Server DB Technology (Mid-Level)',
      'ETL Tools (Mid-Level)',
      'Database Engines: Oracle, MS-SQL, or others (Senior)',
    ],
    postingDate: '2026-06-26 00:00:00',
    closingDate: null,
    jobDescription: job.jobDescription,
  })
  assert.match(job.jobDescription, /Project description/i)
  assert.match(job.jobDescription, /GNLA\/RESQ Azure cloud estate/i)
  assert.match(job.jobDescription, /Nice to have/i)
})

test('run fetches Luxoft listing and detail pages, then decorates shared runner fields', async () => {
  const { buildSearchUrl, createLuxoftScraper } = await loadLuxoftModule()
  const listingHtml = readHtmlFixture('india-jobs.html')
  const detailHtml = readHtmlFixture('job-sql-dba-engineer-25504.html')
  const requests = []
  const scraper = createLuxoftScraper({ maxJobs: 2, maxPages: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildSearchUrl({ page: 1 })) return listingHtml
      if (url === 'https://career.luxoft.com/jobs/sql-dba-engineer-25504') return detailHtml
      if (url === 'https://career.luxoft.com/jobs/qa-automation-engineer-uftsap-25503') {
        return detailHtml.replaceAll('sql-dba-engineer-25504', 'qa-automation-engineer-uftsap-25503')
          .replaceAll('SQL DBA Engineer', 'QA Automation Engineer (UFT/SAP)')
      }

      throw new Error(`Unexpected Luxoft URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchUrl({ page: 1 }),
    'https://career.luxoft.com/jobs/sql-dba-engineer-25504',
    'https://career.luxoft.com/jobs/qa-automation-engineer-uftsap-25503',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'luxoft')
  assert.equal(jobs[0].company, 'Luxoft')
  assert.equal(jobs[0].requisitionId, 'VR-123708')
  assert.equal(jobs[0].link, 'https://career.luxoft.com/jobs/sql-dba-engineer-25504')
  assert.equal(jobs[1].title, 'QA Automation Engineer (UFT/SAP)')
})
