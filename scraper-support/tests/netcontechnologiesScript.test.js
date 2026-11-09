import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scraper',
  'netcontechnologies',
  'fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const careersHtml = readFixture('careers.html')
const jobsHtml = readFixture('jobs.html')
const sitemapXml = readFixture('sitemap.xml')
const frontOfficeDetailHtml = readFixture('detail-front-office-executive.html')
const seniorAccountManagerDetailHtml = readFixture(
  'detail-senior-account-manager-gcc-digital-transformation.html',
)

const loadNetconModule = async () => {
  try {
    return await import('../../scraper/netcontechnologies/script.js')
  } catch {
    assert.fail('Expected Netcon Technologies scraper module at ../../scraper/netcontechnologies/script.js')
  }
}

test('Netcon Technologies constants stay pinned to the verified official Arche careers surfaces', async () => {
  const netcon = await loadNetconModule()

  assert.equal(netcon.SOURCE, 'netcontechnologies')
  assert.equal(netcon.COMPANY, 'Netcon Technologies')
  assert.equal(netcon.HOME_URL, 'https://arche.global/')
  assert.equal(netcon.CAREERS_URL, 'https://arche.global/careers')
  assert.equal(netcon.JOBS_URL, 'https://arche.global/jobs')
  assert.equal(netcon.SITEMAP_URL, 'https://arche.global/sitemap.xml')
  assert.equal(netcon.APPLY_URL, 'https://arche.global/fill-application')
  assert.equal(netcon.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(netcon.hasOfficialJobsSignal(jobsHtml), true)
})

test('Netcon Technologies sitemap parsing keeps only first-party Arche job detail URLs', async () => {
  const netcon = await loadNetconModule()

  assert.deepEqual(netcon.extractJobDetailUrlsFromSitemap(sitemapXml), [
    'https://arche.global/jobs/senior-account-manager-gcc-digital-transformation',
    'https://arche.global/jobs/front-office-executive',
  ])
})

test('Netcon Technologies detail parsing extracts normalized role metadata from verified Arche detail pages', async () => {
  const netcon = await loadNetconModule()

  assert.deepEqual(
    netcon.extractJobDetail(
      frontOfficeDetailHtml,
      'https://arche.global/jobs/front-office-executive',
    ),
    {
      title: 'Front Office Executive',
      company: 'Netcon Technologies',
      department: null,
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'front-office-executive',
      requisitionId: 'front-office-executive',
      sourceUrl: 'https://arche.global/jobs/front-office-executive',
      applyUrl: 'https://arche.global/fill-application',
      employmentType: null,
      experienceRequired: '1 - 4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Role Overview: We are seeking a highly organized and customer-focused Front Office Executive to join our team. Roles and Responsibilities: Greet and assist visitors, clients, and staff in a friendly and professional manner. Manage incoming calls, emails, and correspondence efficiently. Qualifications & Skillsets: Bachelor\'s degree in Business Administration or a related field. Minimum 1 to 4 years of relevant experience.',
      remoteStatus: 'On-site',
    },
  )

  const seniorAccountManager = netcon.extractJobDetail(
    seniorAccountManagerDetailHtml,
    'https://arche.global/jobs/senior-account-manager-gcc-digital-transformation',
  )

  assert.equal(
    seniorAccountManager.title,
    'Senior Account Manager GCC, Digital Transformation',
  )
  assert.equal(
    seniorAccountManager.location,
    'Bangalore / Coimbatore / Hyderabad',
  )
  assert.equal(seniorAccountManager.city, 'Bangalore')
  assert.equal(seniorAccountManager.experienceRequired, '15+ Years')
  assert.equal(seniorAccountManager.applyUrl, 'https://arche.global/fill-application')
  assert.match(seniorAccountManager.jobDescription, /global capability centers/i)
  assert.match(seniorAccountManager.jobDescription, /15\+ years of experience/i)
})

test('Netcon Technologies run validates the verified Arche surfaces, walks the sitemap, and decorates shared runner fields', async () => {
  const netcon = await loadNetconModule()
  const requestedUrls = []

  const jobs = await netcon.createNetconTechnologiesScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === netcon.CAREERS_URL) return careersHtml
      if (url === netcon.JOBS_URL) return jobsHtml
      if (url === netcon.SITEMAP_URL) return sitemapXml
      if (url === 'https://arche.global/jobs/senior-account-manager-gcc-digital-transformation') {
        return seniorAccountManagerDetailHtml
      }
      if (url === 'https://arche.global/jobs/front-office-executive') {
        return frontOfficeDetailHtml
      }

      throw new Error(`Unexpected Netcon Technologies fixture URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    netcon.CAREERS_URL,
    netcon.JOBS_URL,
    netcon.SITEMAP_URL,
    'https://arche.global/jobs/senior-account-manager-gcc-digital-transformation',
    'https://arche.global/jobs/front-office-executive',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Account Manager GCC, Digital Transformation',
        source: 'netcontechnologies',
        country: 'India',
        link: 'https://arche.global/jobs/senior-account-manager-gcc-digital-transformation',
        applyUrl: 'https://arche.global/fill-application',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Front Office Executive',
        source: 'netcontechnologies',
        country: 'India',
        link: 'https://arche.global/jobs/front-office-executive',
        applyUrl: 'https://arche.global/fill-application',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
})

test('Netcon Technologies fails closed when the verified Arche careers or jobs surface changes materially', async () => {
  const netcon = await loadNetconModule()

  await assert.rejects(
    netcon.createNetconTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === netcon.CAREERS_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }
        if (url === netcon.JOBS_URL) return jobsHtml
        if (url === netcon.SITEMAP_URL) return sitemapXml
        return seniorAccountManagerDetailHtml
      },
    }),
    /verified official Netcon Technologies careers page/i,
  )

  await assert.rejects(
    netcon.createNetconTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === netcon.CAREERS_URL) return careersHtml
        if (url === netcon.JOBS_URL) {
          return '<html><body><h1>Jobs</h1><p>Unexpected surface</p></body></html>'
        }
        if (url === netcon.SITEMAP_URL) return sitemapXml
        return seniorAccountManagerDetailHtml
      },
    }),
    /verified official Netcon Technologies jobs page/i,
  )
})
