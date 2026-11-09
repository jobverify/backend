import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Miko India</title>
    <link rel="canonical" href="https://in.miko.ai/pages/careers">
  </head>
  <body>
    <div class="careerIn backend">
      <h2>Backend Software</h2>
      <a href="https://rnc.keka.com/careers/jobdetails/49551" target="_blank">
        <div class="careerCard">
          <h3>Senior Java Developer</h3>
          <p><b>Experience:</b> 4+ years</p>
          <span>Full Time</span>
        </div>
      </a>
    </div>
    <div class="careerIn qa">
      <h2>QA</h2>
      <a href="https://rnc.keka.com/careers/jobdetails/47639" target="_blank">
        <div class="careerCard">
          <h3>Senior SDET</h3>
          <p><b>Location:</b> Mumbai</p>
          <p><b>Experience:</b> 5-10 years</p>
          <span>Full Time</span>
        </div>
      </a>
    </div>
  </body>
</html>
`

const kekaShellHtml = `
<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <div id="content-container"></div>
    <script>
      fetch('/ats/documents/d7f38166-f316-43c8-bc07-256b602da7a4/careerportal/portal.html')
        .then(response => response.text())
    </script>
  </body>
</html>
`

const embeddedCareersHtml = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.khConfig = {
        identifier: 'd7f38166-f316-43c8-bc07-256b602da7a4',
        domain: 'https://rnc.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://rnc.keka.com/careers/api/embedjobs/js/d7f38166-f316-43c8-bc07-256b602da7a4" defer></script>
  </head>
  <body>
    <h2>Open positions</h2>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: 'MIKO',
  shortName: 'MIKO',
  careersPortalDomain: 'rnc.keka.com',
  companyWebsite: 'https://miko.ai/',
}

const activeJobsPayload = [
  {
    id: 134690,
    title: 'HR Operations Intern',
    description: '<div>Own onboarding workflows and employee engagement cadences.</div>',
    departmentName: 'HR Department',
    jobLocations: [
      {
        name: 'Mumbai',
        city: 'Mumbai',
        state: 'MH',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '6 months or more',
    publishedOn: '2026-07-14T06:54:14.860Z',
    skillNames: ['Excel', 'People Ops'],
  },
  {
    id: 18289,
    title: 'Sales Associate',
    description: '<div>Drive retail sales and explain Miko Robot benefits to customers.</div>',
    departmentName: 'SALES',
    jobLocations: [
      {
        name: 'Mumbai',
        city: 'Mumbai',
        state: 'MH',
        countryCode: 'IN',
        countryName: 'India',
      },
      {
        name: 'Gurugram',
        city: 'Gurugram',
        state: 'HR',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '0 to 2',
    publishedOn: '2026-07-01T05:00:00.000Z',
    skillNames: [],
  },
  {
    id: 999001,
    title: 'US Robotics Engineer',
    description: '<div>United States only role.</div>',
    departmentName: 'Core Tech',
    jobLocations: [
      {
        name: 'San Francisco',
        city: 'San Francisco',
        state: 'CA',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '5+ years',
    publishedOn: '2026-07-11T00:00:00.000Z',
    skillNames: ['ROS'],
  },
]

const loadMikoModule = async () => {
  try {
    return await import('../../scraper/miko/script.js')
  } catch {
    assert.fail('Expected Miko scraper module at ../../scraper/miko/script.js')
  }
}

test('Miko pins the verified first-party careers page and public Keka handoff contract', async () => {
  const miko = await loadMikoModule()

  assert.equal(miko.SOURCE, 'miko')
  assert.equal(miko.COMPANY_NAME, 'Miko')
  assert.equal(miko.OFFICIAL_BRAND_NAME, 'MIKO')
  assert.equal(miko.CAREERS_URL, 'https://in.miko.ai/pages/careers')
  assert.equal(miko.OFFICIAL_CAREERS_HANDOFF_URL, 'https://rnc.keka.com/careers/')
  assert.equal(miko.EXPECTED_IDENTIFIER, 'd7f38166-f316-43c8-bc07-256b602da7a4')
  assert.equal(miko.EXPECTED_KEKA_DOMAIN, 'https://rnc.keka.com/careers/')
  assert.equal(miko.CAREER_PORTAL_INFO_URL, 'https://rnc.keka.com/careers/api/organization/default/careerportalinfo')
  assert.equal(
    miko.ACTIVE_JOBS_URL,
    'https://rnc.keka.com/careers/api/embedjobs/default/active/d7f38166-f316-43c8-bc07-256b602da7a4',
  )
  assert.equal(miko.VERIFIED_ON, '2026-07-16')
  assert.equal(miko.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(miko.extractKekaJobDetailLinks(careersHtml), [
    'https://rnc.keka.com/careers/jobdetails/49551',
    'https://rnc.keka.com/careers/jobdetails/47639',
  ])
  assert.equal(
    miko.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/d7f38166-f316-43c8-bc07-256b602da7a4/careerportal/portal.html',
  )
  assert.deepEqual(miko.extractCareerConfig(embeddedCareersHtml), {
    identifier: 'd7f38166-f316-43c8-bc07-256b602da7a4',
    domain: 'https://rnc.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    miko.buildCareerPortalInfoUrl(miko.extractCareerConfig(embeddedCareersHtml)),
    'https://rnc.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    miko.buildActiveJobsUrl(miko.extractCareerConfig(embeddedCareersHtml)),
    'https://rnc.keka.com/careers/api/embedjobs/default/active/d7f38166-f316-43c8-bc07-256b602da7a4',
  )
  assert.equal(miko.hasExpectedPortalIdentity(portalInfo), true)
})

test('Miko keeps only India jobs from the verified Keka payload and maps them to the shared shape', async () => {
  const miko = await loadMikoModule()

  const jobs = miko.extractSearchResults(activeJobsPayload, {
    domain: 'https://rnc.keka.com/careers/',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'HR Operations Intern',
    company: 'Miko',
    department: 'HR Department',
    location: 'Mumbai, MH, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '134690',
    requisitionId: '134690',
    sourceUrl: 'https://rnc.keka.com/careers/jobdetails/134690',
    applyUrl: 'https://rnc.keka.com/careers/applyjob/134690',
    employmentType: 'Full Time',
    experienceRequired: '6 months or more',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Excel', 'People Ops'],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription: 'Own onboarding workflows and employee engagement cadences.',
  })
  assert.equal(jobs[1].title, 'Sales Associate')
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(jobs[1].country, 'India')
})

test('Miko run validates the first-party careers page, branded Keka portal, and decorates active India jobs', async () => {
  const miko = await loadMikoModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await miko.createMikoScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === miko.CAREERS_URL) return careersHtml
      if (url === miko.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
      if (url === 'https://rnc.keka.com/ats/documents/d7f38166-f316-43c8-bc07-256b602da7a4/careerportal/portal.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected Miko text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === miko.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === miko.ACTIVE_JOBS_URL) return activeJobsPayload
      throw new Error(`Unexpected Miko JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTexts, [
    miko.CAREERS_URL,
    miko.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://rnc.keka.com/ats/documents/d7f38166-f316-43c8-bc07-256b602da7a4/careerportal/portal.html',
  ])
  assert.deepEqual(requestedJson, [
    miko.CAREER_PORTAL_INFO_URL,
    miko.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'miko')
  assert.equal(jobs[0].company, 'Miko')
  assert.equal(jobs[0].link, 'https://rnc.keka.com/careers/applyjob/134690')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Miko fails closed when the first-party careers page or Keka portal identity drifts materially', async () => {
  const miko = await loadMikoModule()

  await assert.rejects(
    miko.createMikoScraper().run({
      fetchText: async (url) => {
        if (url === miko.CAREERS_URL) {
          return careersHtml.replace('https://rnc.keka.com/careers/jobdetails/49551', 'https://jobs.example.com/49551')
        }
        return kekaShellHtml
      },
      fetchJson: async () => portalInfo,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    miko.createMikoScraper().run({
      fetchText: async (url) => {
        if (url === miko.CAREERS_URL) return careersHtml
        if (url === miko.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml.replace(
          'd7f38166-f316-43c8-bc07-256b602da7a4',
          '11111111-2222-3333-4444-555555555555',
        )
      },
      fetchJson: async () => portalInfo,
    }),
    /verified keka/i,
  )

  await assert.rejects(
    miko.createMikoScraper().run({
      fetchText: async (url) => {
        if (url === miko.CAREERS_URL) return careersHtml
        if (url === miko.OFFICIAL_CAREERS_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === miko.CAREER_PORTAL_INFO_URL) {
          return { ...portalInfo, name: 'Different Company' }
        }
        return activeJobsPayload
      },
    }),
    /company identity/i,
  )
})
