import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'prophazetechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const jobsListPayload = readJsonFixture('jobs-list.json')
const preSalesPayload = readJsonFixture('detail-14832.json')
const supportPayload = readJsonFixture('detail-12849.json')
const seoPayload = readJsonFixture('detail-11558.json')

const loadProphazeModule = async () => {
  try {
    return await import('../../scraper/prophazetechnologies/script.js')
  } catch {
    assert.fail('Expected Prophaze Technologies scraper module at ../../scraper/prophazetechnologies/script.js')
  }
}

test('Prophaze Technologies validates the verified official homepage, careers shell, and first-party jobs index', async () => {
  const prophaze = await loadProphazeModule()

  assert.equal(prophaze.SOURCE, 'prophazetechnologies')
  assert.equal(prophaze.COMPANY, 'Prophaze Technologies')
  assert.equal(prophaze.HOMEPAGE_URL, 'https://www.prophaze.com/')
  assert.equal(prophaze.CAREERS_URL, 'https://www.prophaze.com/company/careers/')
  assert.equal(prophaze.JOBS_API_URL, 'https://www.prophaze.com/wp-json/wp/v2/awsm_job_openings?per_page=100&_fields=id,date,modified,status,link,title,slug')
  assert.equal(prophaze.JOB_DETAIL_API_BASE_URL, 'https://www.prophaze.com/wp-json/wp/v2/awsm_job_openings')

  assert.equal(prophaze.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(prophaze.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(prophaze.extractFirstPartyJobUrls(careersHtml), [
    'https://www.prophaze.com/jobs/pre-sales-engineer/',
    'https://www.prophaze.com/jobs/12849/',
    'https://www.prophaze.com/jobs/seo-specialist/',
  ])

  assert.deepEqual(prophaze.extractPublishedJobSummaries(jobsListPayload), [
    {
      id: 14832,
      title: 'Pre Sales Engineer',
      link: 'https://www.prophaze.com/jobs/pre-sales-engineer/',
      postingDate: '2026-02-17T05:45:09',
      modifiedDate: '2026-02-17T05:46:17',
      slug: 'pre-sales-engineer',
    },
    {
      id: 12849,
      title: 'Technical Support Engineer',
      link: 'https://www.prophaze.com/jobs/12849/',
      postingDate: '2026-02-04T10:36:07',
      modifiedDate: '2026-02-04T11:24:51',
      slug: '12849',
    },
    {
      id: 11558,
      title: 'SEO Specialist',
      link: 'https://www.prophaze.com/jobs/seo-specialist/',
      postingDate: '2026-01-20T05:58:27',
      modifiedDate: '2026-01-20T06:29:07',
      slug: 'seo-specialist',
    },
  ])
})

test('Prophaze recognizes its current AI security homepage wording', async () => {
  const prophaze = await loadProphazeModule()
  const currentHomepage = `
    <html><head><title>AI-Based WAAP Solution for Enterprises | Prophaze</title></head>
    <body><h1>AI & LLM Security</h1><p>AI-driven WAF, API protection</p>
      <p>Meet Prophaze</p>
      <a href="https://www.prophaze.com/company/careers/">Careers</a>
    </body></html>
  `
  assert.equal(prophaze.hasOfficialHomepageSignal(currentHomepage), true)
  assert.equal(prophaze.hasOfficialHomepageSignal(currentHomepage.replace('Meet Prophaze', 'Other company')), false)
})

test('Prophaze Technologies maps first-party detail payloads into shared job records', async () => {
  const prophaze = await loadProphazeModule()

  assert.equal(prophaze.buildJobDetailApiUrl(14832), 'https://www.prophaze.com/wp-json/wp/v2/awsm_job_openings/14832?_fields=id,date,modified,status,link,title,content,class_list,slug')

  assert.deepEqual(prophaze.extractJobFromDetailPayload(preSalesPayload), {
    title: 'Pre Sales Engineer',
    company: 'Prophaze Technologies',
    department: null,
    location: 'Mumbai, Pune, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '14832',
    requisitionId: '14832',
    sourceUrl: 'https://www.prophaze.com/jobs/pre-sales-engineer/',
    applyUrl: 'https://www.prophaze.com/jobs/pre-sales-engineer/',
    employmentType: 'Full-time',
    experienceRequired: '5 Years',
    minimumQualification: 'Bachelor’s degree in Computer Science, Engineering, or a related field',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-17T05:45:09',
    closingDate: null,
    jobDescription: "We are looking for a motivated and enthusiastic Presales Engineer with minimum 5 years of experience, preferably in cybersecurity, to join our team. Required Qualifications/Skills: Bachelor’s degree in Computer Science, Engineering, or a related field.",
    remoteStatus: 'On-site',
  })

  assert.equal(prophaze.extractJobFromDetailPayload(supportPayload).city, 'Trivandrum')
  assert.equal(prophaze.extractJobFromDetailPayload(supportPayload).experienceRequired, '0-3 Years')
  assert.equal(prophaze.extractJobFromDetailPayload(seoPayload).city, 'Bengaluru')
  assert.equal(prophaze.extractJobFromDetailPayload(seoPayload).experienceRequired, '4+ Years')
})

test('Prophaze Technologies run verifies the homepage and careers page, then fetches only the first-party jobs API and detail payloads', async () => {
  const prophaze = await loadProphazeModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await prophaze.createProphazeTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === prophaze.HOMEPAGE_URL) return homepageHtml
      if (url === prophaze.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === prophaze.JOBS_API_URL) return jobsListPayload
      if (url === prophaze.buildJobDetailApiUrl(14832)) return preSalesPayload
      if (url === prophaze.buildJobDetailApiUrl(12849)) return supportPayload
      if (url === prophaze.buildJobDetailApiUrl(11558)) return seoPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    'https://www.prophaze.com/',
    'https://www.prophaze.com/company/careers/',
  ])
  assert.deepEqual(requestedJsonUrls, [
    prophaze.JOBS_API_URL,
    prophaze.buildJobDetailApiUrl(14832),
    prophaze.buildJobDetailApiUrl(12849),
    prophaze.buildJobDetailApiUrl(11558),
  ])

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'prophazetechnologies')
  assert.equal(jobs[0].company, 'Prophaze Technologies')
  assert.equal(jobs[0].companyCareerPage, 'https://www.prophaze.com/company/careers/')
  assert.equal(jobs[0].companyDomain, 'prophaze.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].applyUrl, 'https://www.prophaze.com/jobs/pre-sales-engineer/')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].title, 'Technical Support Engineer')
  assert.equal(jobs[1].experienceLevel, 'Entry Level')
  assert.equal(jobs[2].title, 'SEO Specialist')
})

test('Prophaze Technologies fails closed when the verified homepage, careers shell, or jobs index drifts materially', async () => {
  const prophaze = await loadProphazeModule()

  await assert.rejects(
    prophaze.createProphazeTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === prophaze.HOMEPAGE_URL) {
          return homepageHtml.replace('Enterprise WAAP. Managed Your Way.', 'Unexpected Homepage')
        }
        return careersHtml
      },
      fetchJson: async () => jobsListPayload,
    }),
    /official homepage signal changed/i,
  )

  await assert.rejects(
    prophaze.createProphazeTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === prophaze.HOMEPAGE_URL) return homepageHtml
        return careersHtml.replace('/jobs/pre-sales-engineer/', '/roles/pre-sales-engineer/')
      },
      fetchJson: async () => jobsListPayload,
    }),
    /careers page and jobs index drifted/i,
  )

  await assert.rejects(
    prophaze.createProphazeTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === prophaze.HOMEPAGE_URL) return homepageHtml
        return careersHtml
      },
      fetchJson: async (url) => {
        if (url === prophaze.JOBS_API_URL) {
          return [{ ...jobsListPayload[0], link: 'https://example.com/jobs/pre-sales-engineer/' }]
        }
        return preSalesPayload
      },
    }),
    /jobs index payload changed/i,
  )
})
