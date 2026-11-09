import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'joshtechnologygroup',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('careers.html')
const INSIDE_SALES_DETAIL_HTML = readFixture('job-detail-inside-sales-strategist-podxjtg.html')
const PHP_MAGENTO_DETAIL_HTML = readFixture('job-detail-software-developer-php-magento.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/joshtechnologygroup/script.js')
  } catch {
    assert.fail('Expected Josh Technology Group scraper module at ../../scraper/joshtechnologygroup/script.js')
  }
}

test('Josh Technology Group validates the verified homepage and careers surface', async () => {
  const jtg = await loadModule()

  assert.equal(jtg.SOURCE, 'joshtechnologygroup')
  assert.equal(jtg.COMPANY, 'Josh Technology Group')
  assert.equal(jtg.HOMEPAGE_URL, 'https://www.joshtechnologygroup.com/')
  assert.equal(jtg.CAREERS_URL, 'https://www.joshtechnologygroup.com/careers/')
  assert.equal(jtg.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(jtg.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('Josh Technology Group extracts the verified first-party careers listings with departments', async () => {
  const jtg = await loadModule()

  const jobs = jtg.extractListings(CAREERS_HTML)

  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs[0], {
    title: 'Inside Sales Strategist @PODxJTG',
    company: 'Josh Technology Group',
    department: 'JTGxPOD Hirings',
    location: null,
    city: null,
    country: null,
    jobId: 'joshtechnologygroup-inside-sales-strategist-podxjtg',
    requisitionId: null,
    sourceUrl: 'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/',
    applyUrl: 'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[2], {
    title: 'Software Developer (PHP & Magento)',
    company: 'Josh Technology Group',
    department: 'Technical Delivery',
    location: null,
    city: null,
    country: null,
    jobId: 'joshtechnologygroup-software-developer-php-magento',
    requisitionId: null,
    sourceUrl: 'https://www.joshtechnologygroup.com/careers/software-developer-php-magento/',
    applyUrl: 'https://www.joshtechnologygroup.com/careers/software-developer-php-magento/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('Josh Technology Group enriches verified detail pages into normalized job records', async () => {
  const jtg = await loadModule()

  const insideSales = jtg.extractJobDetail(INSIDE_SALES_DETAIL_HTML, {
    title: 'Inside Sales Strategist @PODxJTG',
    company: 'Josh Technology Group',
    department: 'JTGxPOD Hirings',
    location: null,
    city: null,
    country: null,
    jobId: 'joshtechnologygroup-inside-sales-strategist-podxjtg',
    requisitionId: null,
    sourceUrl: 'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/',
    applyUrl: 'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  // Keep the native workplace label; it supplies neither a typed city nor country.
  assert.equal(insideSales.location, 'Gurgaon/Gurugram – Work from office')
  assert.equal(insideSales.city, null)
  assert.equal(insideSales.country, null)
  assert.equal(insideSales.experienceRequired, '0-5 Years of B2B/Inside Sales Experience')
  assert.equal(insideSales.minimumQualification, "Bachelor's/Master's degree in any relevant field")
  assert.match(insideSales.jobDescription, /Conducting in-depth market research to identify new sales opportunities/i)
  assert.match(insideSales.jobDescription, /Leveraging multi-channel outreach/i)
  assert.deepEqual(insideSales.requiredSkills, [
    'Self & Goal Driven, Quick Thinker, Action-Oriented, and Diligent',
    'Good Communication skills and excellent command of the English language.',
    'High Interpersonal skills and pleasing personality.',
    'Eye for detail and good cognitive skills.',
    'An extrovert with high conscientiousness.',
    'Understanding of the Sales Cycle and deriving required analytics based on sales experience.',
    'Should be willing to travel as per requirement, within or outside the territory.',
    'Integrity and professionalism in work.',
  ])

  const phpMagento = jtg.extractJobDetail(PHP_MAGENTO_DETAIL_HTML, {
    title: 'Software Developer (PHP & Magento)',
    company: 'Josh Technology Group',
    department: 'Technical Delivery',
    location: null,
    city: null,
    country: null,
    jobId: 'joshtechnologygroup-software-developer-php-magento',
    requisitionId: null,
    sourceUrl: 'https://www.joshtechnologygroup.com/careers/software-developer-php-magento/',
    applyUrl: 'https://www.joshtechnologygroup.com/careers/software-developer-php-magento/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(phpMagento.location, 'Gurgaon (WFO)')
  assert.equal(phpMagento.city, null)
  assert.equal(phpMagento.country, null)
  assert.equal(phpMagento.experienceRequired, '1- 3 years of software development experience.')
  assert.equal(phpMagento.minimumQualification, 'B.E/B.Tech in CS/IT/ECE from a reputed college.')
  assert.match(phpMagento.jobDescription, /low-latency applications/i)
  assert.ok(phpMagento.requiredSkills.includes('Must have technical knowledge of PHP. and Magento 2.'))
  assert.ok(phpMagento.requiredSkills.includes('Extremely passionate about code reviews, engineering best practices, and mentoring/coaching the developers to make them successful.'))
  assert.ok(phpMagento.requiredSkills.includes('Experience with Agile development lifecycle.'))
})

test('Josh Technology Group run validates the verified first-party flow and returns enriched jobs', async () => {
  const jtg = await loadModule()
  const requestedUrls = []

  const jobs = await jtg.createJoshTechnologyGroupScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jtg.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === jtg.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/') {
        return INSIDE_SALES_DETAIL_HTML
      }
      if (url === 'https://www.joshtechnologygroup.com/careers/program-associate-podxjtg/') {
        return INSIDE_SALES_DETAIL_HTML.replaceAll(
          'Inside Sales Strategist @PODxJTG',
          'Program Associate @PODxJTG',
        ).replaceAll('inside-sales-strategist-podxjtg', 'program-associate-podxjtg')
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
    now: () => '2026-07-10T18:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.joshtechnologygroup.com/',
    'https://www.joshtechnologygroup.com/careers/',
    'https://www.joshtechnologygroup.com/careers/inside-sales-strategist-podxjtg/',
    'https://www.joshtechnologygroup.com/careers/program-associate-podxjtg/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'joshtechnologygroup')
  assert.equal(jobs[0].companyCareerPage, 'https://www.joshtechnologygroup.com/careers/')
  assert.equal(jobs[0].companyDomain, 'joshtechnologygroup.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T18:00:00.000Z')
})

test('Josh Technology Group fails closed when the verified homepage, careers page, or detail contract drifts', async () => {
  const jtg = await loadModule()

  await assert.rejects(
    jtg.createJoshTechnologyGroupScraper().run({
      fetchText: async (url) => {
        if (url === jtg.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        return CAREERS_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jtg.createJoshTechnologyGroupScraper().run({
      fetchText: async (url) => {
        if (url === jtg.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === jtg.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'

        return INSIDE_SALES_DETAIL_HTML
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    jtg.createJoshTechnologyGroupScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === jtg.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === jtg.CAREERS_URL) return CAREERS_HTML

        return '<html><body><h1>Broken</h1></body></html>'
      },
    }),
    /Josh Technology Group.*(?:identity|detail)/i,
  )
})
