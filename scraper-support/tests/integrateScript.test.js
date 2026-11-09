import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'integrate',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const verifiedEmbedHtml = readFixture('embed.html')
const verifiedJobDetailHtml = readFixture('job-detail.html')

const loadIntegrateModule = async () => {
  try {
    return await import('../../scraper/integrate/script.js')
  } catch {
    assert.fail('Expected Integrate scraper module at ../../scraper/integrate/script.js')
  }
}

test('Integrate scraper helpers stay aligned with the verified official careers and Rippling embed surfaces', async () => {
  const integrate = await loadIntegrateModule()

  assert.equal(integrate.SOURCE, 'integrate')
  assert.equal(integrate.COMPANY, 'Integrate')
  assert.equal(integrate.HOMEPAGE_URL, 'https://www.integrate.com/')
  assert.equal(integrate.CAREERS_URL, 'https://www.integrate.com/company/careers/')
  assert.equal(integrate.JOB_BOARD_SLUG, 'integratecom-inc')
  assert.equal(integrate.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(integrate.hasVerifiedCareersPageSignal(verifiedCareersHtml), true)
  assert.deepEqual(integrate.extractEmbeddedJobBoard(verifiedCareersHtml), {
    slug: 'integratecom-inc',
    embedUrl: 'https://ats.rippling.com/embed/integratecom-inc/jobs?s=https%3A%2F%2Fwww.integrate.com%2Fcompany%2Fcareers',
  })
  assert.deepEqual(integrate.extractEmbedListings(verifiedEmbedHtml), [
    {
      title: 'NetSuite Financial Analyst',
      jobId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      requisitionId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      department: 'Finance & Accounting',
      location: 'Remote (India)',
      city: null,
      country: 'India',
      workplaceType: 'REMOTE',
      sourceUrl: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
    },
  ])
  assert.deepEqual(
    integrate.extractJobDetail(verifiedJobDetailHtml),
    {
      title: 'NetSuite Financial Analyst',
      jobId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      requisitionId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      department: 'Finance & Accounting',
      location: 'Remote (India)',
      city: null,
      country: 'India',
      employmentType: 'Salaried, full-time',
      experienceRequired: '2-5 years',
      jobDescription: 'Position Overview We are seeking a proactive, detail-oriented Financial Systems & Accounting Analyst to support our US-based Corporate Accounting team. Qualifications & Skills required: - Bachelor’s degree in Accounting, Finance, Information Systems, or related field. - 2-5 years of hands-on NetSuite experience. - Experience automating processes and building saved searches/workflows in NetSuite. Work Environment: India-based role supporting US Headquarters.',
      requiredSkills: [
        'Bachelor’s degree in Accounting, Finance, Information Systems, or related field.',
        '2-5 years of hands-on NetSuite experience.',
        'Experience automating processes and building saved searches/workflows in NetSuite.',
      ],
      postingDate: '2026-02-19',
      sourceUrl: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      applyUrl: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
    },
  )
})

test('Integrate scraper validates the official homepage and careers page before returning India jobs from the embedded board', async () => {
  const integrate = await loadIntegrateModule()
  const requestedUrls = []

  const jobs = await integrate.createIntegrateScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === integrate.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === integrate.CAREERS_URL) return verifiedCareersHtml
      if (url === 'https://ats.rippling.com/embed/integratecom-inc/jobs?s=https%3A%2F%2Fwww.integrate.com%2Fcompany%2Fcareers') {
        return verifiedEmbedHtml
      }
      if (url === 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e') {
        return verifiedJobDetailHtml
      }

      throw new Error(`Unexpected Integrate URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    integrate.HOMEPAGE_URL,
    integrate.CAREERS_URL,
    'https://ats.rippling.com/embed/integratecom-inc/jobs?s=https%3A%2F%2Fwww.integrate.com%2Fcompany%2Fcareers',
    'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'NetSuite Financial Analyst',
      company: 'Integrate',
      department: 'Finance & Accounting',
      location: 'Remote (India)',
      city: null,
      country: 'India',
      jobId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      requisitionId: 'ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      sourceUrl: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      applyUrl: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      link: 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e',
      employmentType: 'Salaried, full-time',
      experienceRequired: '2-5 years',
      requiredSkills: [
        'Bachelor’s degree in Accounting, Finance, Information Systems, or related field.',
        '2-5 years of hands-on NetSuite experience.',
        'Experience automating processes and building saved searches/workflows in NetSuite.',
      ],
      postingDate: '2026-02-19',
      jobDescription: 'Position Overview We are seeking a proactive, detail-oriented Financial Systems & Accounting Analyst to support our US-based Corporate Accounting team. Qualifications & Skills required: - Bachelor’s degree in Accounting, Finance, Information Systems, or related field. - 2-5 years of hands-on NetSuite experience. - Experience automating processes and building saved searches/workflows in NetSuite. Work Environment: India-based role supporting US Headquarters.',
      source: 'integrate',
      scrapedAt: jobs[0].scrapedAt,
    },
  ])
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Integrate scraper fails closed when the official homepage, careers page, embed board, or detail contract changes', async () => {
  const integrate = await loadIntegrateModule()

  await assert.rejects(
    integrate.createIntegrateScraper().run({
      fetchText: async (url) => {
        if (url === integrate.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    integrate.createIntegrateScraper().run({
      fetchText: async (url) => {
        if (url === integrate.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === integrate.CAREERS_URL) {
          return verifiedCareersHtml.replace('integratecom-inc', 'someone-else')
        }
        throw new Error(`Unexpected Integrate URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    integrate.createIntegrateScraper().run({
      fetchText: async (url) => {
        if (url === integrate.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === integrate.CAREERS_URL) return verifiedCareersHtml
        if (url === 'https://ats.rippling.com/embed/integratecom-inc/jobs?s=https%3A%2F%2Fwww.integrate.com%2Fcompany%2Fcareers') {
          return verifiedEmbedHtml.replace('Integrate.com, Inc.', 'Another Company')
        }
        throw new Error(`Unexpected Integrate URL: ${url}`)
      },
    }),
    /verified rippling embed/i,
  )

  await assert.rejects(
    integrate.createIntegrateScraper().run({
      fetchText: async (url) => {
        if (url === integrate.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === integrate.CAREERS_URL) return verifiedCareersHtml
        if (url === 'https://ats.rippling.com/embed/integratecom-inc/jobs?s=https%3A%2F%2Fwww.integrate.com%2Fcompany%2Fcareers') {
          return verifiedEmbedHtml
        }
        if (url === 'https://ats.rippling.com/integratecom-inc/jobs/ed62f8df-b1fa-4cb5-b4e2-5379e865c34e') {
          return verifiedJobDetailHtml.replace('"slug": "integratecom-inc"', '"slug": "other-board"')
        }
        throw new Error(`Unexpected Integrate URL: ${url}`)
      },
    }),
    /verified job detail/i,
  )
})
