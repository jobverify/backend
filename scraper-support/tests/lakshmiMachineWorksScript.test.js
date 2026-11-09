import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lakshmimachineworks',
)

const HOMEPAGE_HTML = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const CAREERS_SHELL_HTML = readFileSync(path.join(fixturesDir, 'darwinbox-careers.html'), 'utf8')

const loadModule = async () => {
  try {
    return await import('../../scraper/lakshmimachineworks/script.js')
  } catch {
    assert.fail('Expected Lakshmi Machine Works scraper module at ../../scraper/lakshmimachineworks/script.js')
  }
}

const samplePayload = {
  data: [
    {
      id: 'a6a509b0e3af75',
      title: 'Team Member - Buyer',
      department_name: 'Advanced Technology Centre',
      locations: 'Ganapathy, Coimbatore, Tamil Nadu , India',
      country: 'India',
      emp_type_name: 'Staff',
      experience: null,
      posted_on: '10-Jul-2026',
      jd: '<p><b>Purpose of the Role:</b> Support strategic purchasing.</p>',
    },
    {
      id: 'a6a509b0e3af76',
      title: 'Regional Sales Manager',
      department_name: 'Sales',
      locations: 'Dallas, Texas, United States',
      country: 'United States',
      emp_type_name: 'Staff',
      experience: '8 - 10 Years',
      posted_on: '10-Jul-2026',
      jd: '<p><b>Purpose of the Role:</b> Lead regional sales.</p>',
    },
  ],
  job_counts: 2,
}

test('Lakshmi Machine Works scraper pins the verified official homepage and Darwinbox careers handoff', async () => {
  const lmw = await loadModule()

  assert.equal(lmw.SOURCE, 'lakshmimachineworks')
  assert.equal(lmw.COMPANY, 'Lakshmi Machine Works')
  assert.equal(lmw.COMPANY_DOMAIN, 'lmwglobal.com')
  assert.equal(lmw.HOMEPAGE_URL, 'https://www.lmwglobal.com/')
  assert.equal(lmw.DARWINBOX_ORIGIN, 'https://lmwanubhav.darwinbox.in')
  assert.equal(lmw.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(
    lmw.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://lmwanubhav.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    lmw.PUBLIC_PORTAL_URL,
    'https://lmwanubhav.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(lmw.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lmw.hasOfficialCareersShell(CAREERS_SHELL_HTML), true)
})

test('Lakshmi Machine Works scraper validates the verified public surface and returns India jobs from Darwinbox', async () => {
  const lmw = await loadModule()
  const requestedUrls = []
  const requestedPages = []

  const jobs = await lmw.createLakshmiMachineWorksScraper({
    maxJobs: 1,
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lmw.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === lmw.OFFICIAL_CAREERS_HANDOFF_URL) return CAREERS_SHELL_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchListingPage: async ({ page, pageSize, companyId }) => {
      requestedPages.push({ page, pageSize, companyId })
      return samplePayload
    },
  })

  assert.deepEqual(requestedUrls, [lmw.HOMEPAGE_URL, lmw.OFFICIAL_CAREERS_HANDOFF_URL])
  assert.deepEqual(requestedPages, [{
    page: 1,
    pageSize: 10,
    companyId: 'main',
  }])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Team Member - Buyer',
    company: 'Lakshmi Machine Works',
    department: 'Advanced Technology Centre',
    location: 'Ganapathy, Coimbatore, Tamil Nadu , India',
    city: 'Ganapathy',
    jobId: 'a6a509b0e3af75',
    requisitionId: null,
    sourceUrl: 'https://lmwanubhav.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a509b0e3af75',
    applyUrl: 'https://lmwanubhav.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a509b0e3af75',
    employmentType: 'Staff',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    publicExperienceChecked: true,
    postingDate: '10-Jul-2026',
    closingDate: null,
    jobDescription: '<p><b>Purpose of the Role:</b> Support strategic purchasing.</p>',
    source: 'lakshmimachineworks',
    link: 'https://lmwanubhav.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a509b0e3af75',
    scrapedAt: '2026-07-11T00:00:00.000Z',
    sourceListingComplete: false,
  })
})

test('Lakshmi Machine Works scraper fails closed when the verified homepage or public careers shell drifts', async () => {
  const lmw = await loadModule()

  await assert.rejects(
    lmw.createLakshmiMachineWorksScraper().run({
      fetchText: async (url) => {
        if (url === lmw.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No LMW markers</body></html>'
        }

        return CAREERS_SHELL_HTML
      },
      fetchListingPage: async () => samplePayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lmw.createLakshmiMachineWorksScraper().run({
      fetchText: async (url) => {
        if (url === lmw.HOMEPAGE_URL) return HOMEPAGE_HTML

        return CAREERS_SHELL_HTML.replace('/ms/bot/candidateweb/assets/bot.js', '/missing.js')
      },
      fetchListingPage: async () => samplePayload,
    }),
    /verified public darwinbox careers shell/i,
  )
})
