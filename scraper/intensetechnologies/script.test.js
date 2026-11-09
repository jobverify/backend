import assert from 'node:assert/strict'
import test from 'node:test'

const loadIntenseTechnologiesModule = async () => import('./script.js')

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <link href="https://www.in10stech.com/careers" rel="canonical" />
  </head>
  <body>
    <main>
      <h1>Deliver Impact at Work and Beyond</h1>
      <h2>Open Positions</h2>
      <script>
        window.khConfig = {
          identifier: 'fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
          domain: 'https://intense.keka.com/careers/',
          targetContainer: '#khembedjobs'
        };
      </script>
      <script src="https://intense.keka.com/careers/api/embedjobs/js/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce" defer></script>
      <div id="khembedjobs"></div>
    </main>
  </body>
</html>
`

const portalInfo = {
  name: 'Intense Technologies',
  shortName: 'Intense Technologies',
  careersPortalDomain: 'intense.keka.com',
  companyWebsite: '',
  jobListingSetting: {
    filters: ['department', 'location'],
    groupBy: 'department',
  },
}

const activeJobsPayload = [
  {
    id: 72301,
    title: 'Template Designer Lead',
    description: '<div>Lead template design and implementation for enterprise CCM customers.</div>',
    departmentName: 'Customer Experience',
    jobType: 2,
    experience: '5-10 Years',
    publishedOn: '2026-05-19T09:00:38.843Z',
    skillNames: ['CXM', 'Workflowautomation'],
    jobLocations: [
      {
        city: 'Hyderabad',
        state: 'TG',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
  },
  {
    id: 72302,
    title: 'US Delivery Manager',
    description: '<div>Outside India role that should be filtered.</div>',
    departmentName: 'Delivery',
    jobType: 2,
    publishedOn: '2026-05-20T09:00:38.843Z',
    jobLocations: [
      {
        city: 'Dallas',
        state: 'TX',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
  },
]

test('Intense Technologies helpers stay pinned to the verified first-party careers page and Keka endpoints', async () => {
  const intense = await loadIntenseTechnologiesModule()

  assert.equal(intense.SOURCE, 'intensetechnologies')
  assert.equal(intense.COMPANY, 'Intense Technologies')
  assert.equal(intense.VERIFIED_ON, '2026-08-02')
  assert.equal(intense.CAREERS_URL, 'https://www.in10stech.com/careers')
  assert.equal(intense.CAREER_PORTAL_INFO_URL, 'https://intense.keka.com/careers/api/organization/default/careerportalinfo')
  assert.equal(intense.EXPECTED_IDENTIFIER, 'fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce')
  assert.equal(intense.EXPECTED_KEKA_DOMAIN, 'https://intense.keka.com/careers/')
  assert.equal(intense.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.deepEqual(intense.extractCareerConfig(careersPageHtml), {
    identifier: 'fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
    domain: 'https://intense.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    intense.buildCareerPortalInfoUrl({ domain: intense.EXPECTED_KEKA_DOMAIN }),
    'https://intense.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    intense.buildActiveJobsUrl({
      domain: intense.EXPECTED_KEKA_DOMAIN,
      identifier: intense.EXPECTED_IDENTIFIER,
    }),
    'https://intense.keka.com/careers/api/embedjobs/default/active/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
  )
  assert.equal(intense.hasExpectedCareerPortalInfo(portalInfo), true)

  assert.deepEqual(intense.extractSearchResults(activeJobsPayload, { domain: intense.EXPECTED_KEKA_DOMAIN }), [
    {
      title: 'Template Designer Lead',
      company: 'Intense Technologies',
      department: 'Customer Experience',
      location: 'Hyderabad, TG, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '72301',
      requisitionId: '72301',
      sourceUrl: 'https://intense.keka.com/careers/jobdetails/72301',
      applyUrl: 'https://intense.keka.com/careers/applyjob/72301',
      employmentType: 'Full Time',
      experienceRequired: '5-10 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['CXM', 'Workflowautomation'],
      postingDate: '2026-05-19',
      closingDate: null,
      jobDescription: 'Lead template design and implementation for enterprise CCM customers.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Intense Technologies run validates the verified first-party careers shell and public Keka identity', async () => {
  const intense = await loadIntenseTechnologiesModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await intense.createIntenseTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      assert.equal(url, intense.CAREERS_URL)
      return careersPageHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === intense.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === intense.buildActiveJobsUrl({
        domain: intense.EXPECTED_KEKA_DOMAIN,
        identifier: intense.EXPECTED_IDENTIFIER,
      })) {
        return activeJobsPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-16T07:30:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    'https://www.in10stech.com/careers',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://intense.keka.com/careers/api/organization/default/careerportalinfo',
    'https://intense.keka.com/careers/api/embedjobs/default/active/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'intensetechnologies')
  assert.equal(jobs[0].link, 'https://intense.keka.com/careers/applyjob/72301')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T07:30:00.000Z')
})

test('Intense Technologies can recover with browser-backed careers and Keka payloads when direct requests time out', async () => {
  const intense = await loadIntenseTechnologiesModule()
  const browserTextUrls = []
  const browserJsonUrls = []

  const jobs = await intense.createIntenseTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: www.in10stech.com:443, timeout: 10000ms)')
    },
    fetchJson: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: intense.keka.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      if (url === intense.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      browserJsonUrls.push(url)
      if (url === intense.CAREER_PORTAL_INFO_URL) return portalInfo
      if (url === intense.buildActiveJobsUrl({
        domain: intense.EXPECTED_KEKA_DOMAIN,
        identifier: intense.EXPECTED_IDENTIFIER,
      })) {
        return activeJobsPayload
      }

      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(browserTextUrls, [intense.CAREERS_URL])
  assert.deepEqual(browserJsonUrls, [
    intense.CAREER_PORTAL_INFO_URL,
    'https://intense.keka.com/careers/api/embedjobs/default/active/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'intensetechnologies')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('Intense Technologies fails closed when the verified careers shell or Keka identity drifts', async () => {
  const intense = await loadIntenseTechnologiesModule()

  await assert.rejects(
    intense.createIntenseTechnologiesScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
      fetchJson: async () => [],
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    intense.createIntenseTechnologiesScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async (url) => {
        if (url === intense.CAREER_PORTAL_INFO_URL) {
          return {
            ...portalInfo,
            careersPortalDomain: 'other.keka.com',
          }
        }

        return activeJobsPayload
      },
    }),
    /verified keka portal identity/i,
  )
})
