import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loadIsroModule = async () => {
  try {
    return await import('../../scraper/isro/script.js')
  } catch {
    assert.fail('Expected ISRO scraper module at ../../scraper/scraper/isro/script.js')
  }
}

const readFixture = (name) => readFileSync(new URL(`./fixtures/isro/${name}`, import.meta.url), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const currentOpportunitiesHtml = readFixture('current-opportunities.html')
const viewAllHtml = readFixture('view-all-opportunities.html')
const istracDetailHtml = readFixture('ISTRACRecruitment4.html')
const urscDetailHtml = readFixture('URSCRecruitment11.html')

test('extracts active ISRO opportunities from the verified careers surface', async () => {
  const isro = await loadIsroModule()

  assert.equal(isro.hasCareersPageSignal(careersHtml), true)

  const requestedUrls = []
  const jobs = await isro.createIsroScraper({ asOfDate: new Date('2026-07-10T00:00:00Z') }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      switch (url) {
        case isro.HOMEPAGE_URL:
          return homepageHtml
        case isro.CAREERS_URL:
          return careersHtml
        case isro.CURRENT_OPPORTUNITIES_URL:
          return currentOpportunitiesHtml
        case isro.VIEW_ALL_OPPORTUNITIES_URL:
          return viewAllHtml
        case 'https://www.isro.gov.in/ISTRACRecruitment4.html':
          return istracDetailHtml
        case 'https://www.isro.gov.in/URSCRecruitment11.html':
          return urscDetailHtml
        default:
          throw new Error(`Unexpected URL: ${url}`)
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    isro.HOMEPAGE_URL,
    isro.CAREERS_URL,
    isro.CURRENT_OPPORTUNITIES_URL,
    isro.VIEW_ALL_OPPORTUNITIES_URL,
    'https://www.isro.gov.in/ISTRACRecruitment4.html',
    'https://www.isro.gov.in/URSCRecruitment11.html',
  ])
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    company: job.company,
    jobId: job.jobId,
    requisitionId: job.requisitionId,
    location: job.location,
    city: job.city,
    country: job.country,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    link: job.link,
    postingDate: job.postingDate,
    closingDate: job.closingDate,
    source: job.source,
  })), [
    {
      title: "Recruitment to the posts of Technician 'B', Draughtsman 'B', Technical Assistant, Scientific Assistant, Library Assistant 'A' and Cook 'A'",
      company: 'ISRO',
      jobId: 'isro-istrac-02-2026',
      requisitionId: 'ISTRAC:02:2026',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      sourceUrl: 'https://www.isro.gov.in/ISTRACRecruitment4.html',
      applyUrl: 'https://cdn.digialm.com/EForms/configuredHtml/1258/96897/Index.html',
      link: 'https://cdn.digialm.com/EForms/configuredHtml/1258/96897/Index.html',
      postingDate: '2026-06-27',
      closingDate: '2026-07-20',
      source: 'isro',
    },
    {
      title: 'Recruitment to the posts of Junior Research Fellow (JRF)',
      company: 'ISRO',
      jobId: 'isro-ursc-02-2026',
      requisitionId: 'URSC:02:2026',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      sourceUrl: 'https://www.isro.gov.in/URSCRecruitment11.html',
      applyUrl: 'https://www.isro.gov.in/media_isro/pdf/recruitmentNotice/2026/June/JRF_2026.pdf',
      link: 'https://www.isro.gov.in/media_isro/pdf/recruitmentNotice/2026/June/JRF_2026.pdf',
      postingDate: '2026-06-12',
      closingDate: '2026-07-11',
      source: 'isro',
    },
  ])
})
