import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(currentDir, 'fixtures', 'karomitechnology')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const portalHtml = readFixture('portal.html')
const apiPayload = JSON.parse(readFixture('job-openings.json'))

const loadKaromiTechnologyModule = async () => {
  try {
    return await import('../../scraper/karomitechnology/script.js')
  } catch {
    assert.fail('Expected Karomi Technology scraper module at ../../scraper/karomitechnology/script.js')
  }
}

test('Karomi Technology constants stay pinned to the verified homepage handoff and public Zoho Recruit surfaces', async () => {
  const karomiTechnology = await loadKaromiTechnologyModule()

  assert.equal(karomiTechnology.HOMEPAGE_URL, 'https://www.karomi.com/')
  assert.equal(karomiTechnology.CAREERS_HANDOFF_URL, 'https://www.manageartworks.com/careers')
  assert.equal(karomiTechnology.CAREERS_PORTAL_URL, 'https://karomi.zohorecruit.in/jobs/Careers')
  assert.equal(
    karomiTechnology.CAREERS_API_URL,
    'https://karomi.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(karomiTechnology.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(karomiTechnology.hasOfficialPortalSignal(portalHtml), true)
})

test('extractIndiaJobs keeps only India listings from the Karomi public jobs feed', async () => {
  const karomiTechnology = await loadKaromiTechnologyModule()
  const jobs = karomiTechnology.extractIndiaJobs(apiPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Team Lead - Implementation',
      company: 'Karomi Technology',
      department: null,
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: '68103000004873051',
      requisitionId: '68103000004873051',
      sourceUrl: 'https://karomi.zohorecruit.in/jobs/Careers/68103000004873051/Team-Lead---Implementation?source=CareerSite',
      applyUrl: 'https://karomi.zohorecruit.in/jobs/Careers/68103000004873051/Team-Lead---Implementation?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "Configure and implement the product in line with client requirements, while planning and managing project timelines and deliverables.",
      publicExperienceChecked: true,
      remoteStatus: 'On-site',
    },
    {
      title: 'Enterprise Sales manager (Mumbai)',
      company: 'Karomi Technology',
      department: null,
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      jobId: '68103000004219013',
      requisitionId: '68103000004219013',
      sourceUrl: 'https://karomi.zohorecruit.in/jobs/Careers/68103000004219013/Enterprise-Sales-manager-Mumbai?source=CareerSite',
      applyUrl: 'https://karomi.zohorecruit.in/jobs/Careers/68103000004219013/Enterprise-Sales-manager-Mumbai?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'The Sales Head – CPG (India) will drive revenue growth and customer acquisition within the Consumer-Packaged Goods segment for ManageArtworks’ SaaS solutions.',
      publicExperienceChecked: true,
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the Karomi homepage and portal before fetching and decorating India jobs', async () => {
  const karomiTechnology = await loadKaromiTechnologyModule()
  const requestedUrls = []

  const jobs = await karomiTechnology.createKaromiTechnologyScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === karomiTechnology.HOMEPAGE_URL) return homepageHtml
      if (url === karomiTechnology.CAREERS_PORTAL_URL) return portalHtml

      assert.fail(`Unexpected HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return apiPayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    karomiTechnology.HOMEPAGE_URL,
    karomiTechnology.CAREERS_PORTAL_URL,
    karomiTechnology.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'karomitechnology')
  assert.equal(
    jobs[0].link,
    'https://karomi.zohorecruit.in/jobs/Careers/68103000004873051/Team-Lead---Implementation?source=CareerSite',
  )
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('run fails closed when the verified Karomi homepage or official portal markers drift', async () => {
  const karomiTechnology = await loadKaromiTechnologyModule()

  await assert.rejects(
    karomiTechnology.createKaromiTechnologyScraper().run({
      fetchText: async (url) => {
        if (url === karomiTechnology.HOMEPAGE_URL) {
          return '<html><body>Unexpected homepage</body></html>'
        }

        return portalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official Karomi Technology homepage/i,
  )

  await assert.rejects(
    karomiTechnology.createKaromiTechnologyScraper().run({
      fetchText: async (url) => {
        if (url === karomiTechnology.HOMEPAGE_URL) return homepageHtml
        return '<html><body>Unexpected portal</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /official Karomi careers portal/i,
  )
})
