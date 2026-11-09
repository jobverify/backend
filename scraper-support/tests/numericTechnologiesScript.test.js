import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'numerictechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const sitemapXml = readFixture('page-sitemap.xml')
const careersHtml = readFixture('careers-united-states.html')

const loadNumericTechnologiesModule = async () => {
  try {
    return await import('../../scraper/numerictechnologies/script.js')
  } catch {
    assert.fail('Expected Numeric Technologies scraper module at ../../scraper/numerictechnologies/script.js')
  }
}

test('Numeric Technologies sentinels recognize the verified homepage, sitemap route, and public US careers page', async () => {
  const numericTechnologies = await loadNumericTechnologiesModule()

  assert.equal(numericTechnologies.SOURCE, 'numerictechnologies')
  assert.equal(numericTechnologies.COMPANY, 'Numeric Technologies')
  assert.equal(numericTechnologies.COMPANY_DOMAIN, 'numerictech.com')
  assert.equal(numericTechnologies.HOMEPAGE_URL, 'https://numerictech.com/')
  assert.equal(numericTechnologies.PAGE_SITEMAP_URL, 'https://numerictech.com/page-sitemap.xml')
  assert.equal(
    numericTechnologies.CAREERS_URL,
    'https://numerictech.com/careers/united-states/',
  )
  assert.equal(numericTechnologies.APPLY_EMAIL, 'jobs@numerictech.com')
  assert.equal(numericTechnologies.APPLY_URL, 'mailto:jobs@numerictech.com')
  assert.equal(numericTechnologies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(numericTechnologies.sitemapIncludesCareersUrl(sitemapXml), true)
  assert.equal(numericTechnologies.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(numericTechnologies.extractPostingDateIso(careersHtml), '2026-02-15')
})

test('Numeric Technologies extracts the current first-party public openings from the US careers page', async () => {
  const numericTechnologies = await loadNumericTechnologiesModule()

  const jobs = numericTechnologies.extractPublicOpenings(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['SAP Analyst', 'Senior SAP S/4 HANA Consultant'],
  )
  assert.deepEqual(jobs[0], {
    title: 'SAP Analyst',
    department: null,
    location: 'Warrenville, IL, USA',
    city: 'Warrenville',
    state: 'IL',
    country: 'United States',
    sourceUrl: 'https://numerictech.com/careers/united-states/',
    applyUrl: 'mailto:jobs@numerictech.com',
    jobId: 'numerictechnologies-sap-analyst',
    requisitionId: 'numerictechnologies-sap-analyst',
    employmentType: null,
    experienceRequired: '2 years',
    minimumQualification: "Bachelor's degree in Computer Science, Engineering any, Technology, Management or related",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-15',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
    remoteStatus: null,
  })
  assert.match(jobs[0].jobDescription, /analyze and apply SAP OSS Notes/i)
  assert.match(jobs[0].jobDescription, /Work location is Warrenville,IL/i)
  assert.deepEqual(
    (({
      title,
      location,
      city,
      state,
      country,
      applyUrl,
      jobId,
      requisitionId,
      experienceRequired,
      minimumQualification,
      postingDate,
      requiredSkills,
    }) => ({
      title,
      location,
      city,
      state,
      country,
      applyUrl,
      jobId,
      requisitionId,
      experienceRequired,
      minimumQualification,
      postingDate,
      requiredSkills,
    }))(jobs[1]),
    {
      title: 'Senior SAP S/4 HANA Consultant',
      location: null,
      city: null,
      state: null,
      country: 'United States',
      applyUrl: 'mailto:jobs@numerictech.com',
      jobId: 'numerictechnologies-senior-sap-s-4-hana-consultant',
      requisitionId: 'numerictechnologies-senior-sap-s-4-hana-consultant',
      experienceRequired: null,
      minimumQualification:
        "Bachelor's degree in Computer science, Computer information systems, information technology or in a related field",
      postingDate: '2026-02-15',
      requiredSkills: [],
    },
  )
  assert.match(jobs[1].jobDescription, /ECC to S4 HANA conversion/i)
  assert.match(jobs[1].jobDescription, /Please submit resumes to jobs@numerictech.com/i)
})

test('Numeric Technologies run verifies the trusted surfaces and decorates the scraped openings', async () => {
  const numericTechnologies = await loadNumericTechnologiesModule()
  const requestedUrls = []

  const jobs = await numericTechnologies.createNumericTechnologiesScraper({
    now: () => '2026-07-11T09:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === numericTechnologies.HOMEPAGE_URL) return homepageHtml
      if (url === numericTechnologies.PAGE_SITEMAP_URL) return sitemapXml
      if (url === numericTechnologies.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected Numeric Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    numericTechnologies.HOMEPAGE_URL,
    numericTechnologies.PAGE_SITEMAP_URL,
    numericTechnologies.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'SAP Analyst',
    department: null,
    company: 'Numeric Technologies',
    location: 'Warrenville, IL, USA',
    city: 'Warrenville',
    state: 'IL',
    country: 'United States',
    source: 'numerictechnologies',
    companyCareerPage: 'https://numerictech.com/careers/united-states/',
    companyDomain: 'numerictech.com',
    atsPlatform: 'official-company-careers',
    sourceUrl: 'https://numerictech.com/careers/united-states/',
    applyUrl: 'mailto:jobs@numerictech.com',
    link: 'mailto:jobs@numerictech.com',
    jobId: 'numerictechnologies-sap-analyst',
    requisitionId: 'numerictechnologies-sap-analyst',
    employmentType: null,
    experienceRequired: '2 years',
    minimumQualification: "Bachelor's degree in Computer Science, Engineering any, Technology, Management or related",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-15',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
    remoteStatus: null,
    scrapedAt: '2026-07-11T09:30:00.000Z',
  })
  assert.equal(jobs[1].company, 'Numeric Technologies')
  assert.equal(jobs[1].source, 'numerictechnologies')
  assert.equal(jobs[1].link, 'mailto:jobs@numerictech.com')
  assert.equal(jobs[1].postingDate, '2026-02-15')
})

test('Numeric Technologies fails closed when the verified homepage, sitemap, or careers page contract changes', async () => {
  const numericTechnologies = await loadNumericTechnologiesModule()

  await assert.rejects(
    numericTechnologies.createNumericTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === numericTechnologies.HOMEPAGE_URL) {
          return homepageHtml.replace('href="https://numerictech.com/careers/"', 'href="https://numerictech.com/contact/"')
        }

        if (url === numericTechnologies.PAGE_SITEMAP_URL) return sitemapXml
        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    numericTechnologies.createNumericTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === numericTechnologies.HOMEPAGE_URL) return homepageHtml
        if (url === numericTechnologies.PAGE_SITEMAP_URL) {
          return sitemapXml.replace(
            '<loc>https://numerictech.com/careers/united-states/</loc>',
            '<loc>https://numerictech.com/careers/canada/</loc>',
          )
        }

        return careersHtml
      },
    }),
    /verified sitemap no longer points to the trusted numeric technologies careers route/i,
  )

  await assert.rejects(
    numericTechnologies.createNumericTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === numericTechnologies.HOMEPAGE_URL) return homepageHtml
        if (url === numericTechnologies.PAGE_SITEMAP_URL) return sitemapXml
        if (url === numericTechnologies.CAREERS_URL) {
          return careersHtml.replace('mailto:jobs@numerictech.com', 'mailto:careers@example.com')
        }

        throw new Error(`Unexpected Numeric Technologies URL: ${url}`)
      },
    }),
    /verified united states careers page/i,
  )
})
