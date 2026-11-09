import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  EXPECTED_IDENTIFIER,
  EXPECTED_KEKA_DOMAIN,
  EXPECTED_PORTAL_NAME,
  EXPECTED_PORTAL_SLUG,
  buildActiveJobsUrl,
  buildCareerPortalInfoUrl,
  createKekaTechnologiesScraper,
  extractCareerConfig,
  extractEmbeddedCareersDocumentPath,
  extractSearchResults,
  hasExpectedPortalIdentity,
  hasOfficialCareersSignal,
} from './script.js'

const careersShellHtml = `
  <html>
    <body>
      <div id="content-container"></div>
      <script>
        window.isCareersPage = true;
        fetch('/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/9bca850b726f4d2e8844b67ebc40462f.html');
      </script>
      <script src="https://hr.keka.com/careers/api/embedjobs/js/${EXPECTED_IDENTIFIER}"></script>
    </body>
  </html>
`

const embeddedCareersHtml = `
  <html>
    <head>
      <script>
        window.khConfig = {
          identifier: '${EXPECTED_IDENTIFIER}',
          domain: '${EXPECTED_KEKA_DOMAIN}',
          targetContainer: '#khembedjobs'
        };
      </script>
    </head>
    <body>
      <div id="khembedjobs"></div>
    </body>
  </html>
`

const portalInfoPayload = {
  name: EXPECTED_PORTAL_NAME,
  shortName: EXPECTED_PORTAL_NAME,
  careersPortalDomain: 'hr.keka.com',
  companyWebsite: 'https://hr.keka.com/careers',
}

const activeJobsPayload = [
  {
    id: 136293,
    title: 'Payroll Specialist - US',
    description: '<p>Own end-to-end payroll delivery.</p>',
    departmentName: 'Customer Experience',
    jobLocations: [
      {
        id: 64,
        name: 'Hyderabad',
        city: 'Hyderabad',
        state: 'TG',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '3-6',
    jobNumber: 'KEKA/1374',
    publishedOn: '2026-07-30T11:36:34.147Z',
    skillNames: [],
  },
  {
    id: 135901,
    title: 'Business Development Executive - Mid Market',
    description: '<p>Build and close a strong sales pipeline.</p>',
    departmentName: 'Sales',
    jobLocations: [
      {
        id: 66,
        name: 'Delhi',
        city: 'Delhi',
        state: 'DL',
        countryCode: 'IN',
        countryName: 'India',
      },
      {
        id: 28867,
        name: 'Gurugram',
        city: 'Gurugram',
        state: 'Haryana',
        countryCode: 'IN',
        countryName: 'India',
      },
      {
        id: 70,
        name: 'Bengaluru',
        city: 'Bengaluru',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '4-7',
    jobNumber: 'KEKA/1370',
    publishedOn: '2026-07-27T09:06:27.633Z',
    skillNames: [],
  },
  {
    id: 999999,
    title: 'US Recruiter',
    description: '<p>Remote only.</p>',
    departmentName: 'Talent',
    jobLocations: [
      {
        id: 1,
        name: 'Austin',
        city: 'Austin',
        state: 'TX',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '2-4',
    jobNumber: 'KEKA/9999',
    publishedOn: '2026-07-27T09:06:27.633Z',
    skillNames: [],
  },
]

test('validates the official Keka careers shell and embedded config for the live jobs API host', () => {
  assert.equal(CAREERS_URL, 'https://hr.keka.com/careers/')
  assert.equal(hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(hasOfficialCareersSignal('<main>Keka careers</main>'), false)
  assert.equal(
    extractEmbeddedCareersDocumentPath(careersShellHtml),
    '/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/9bca850b726f4d2e8844b67ebc40462f.html',
  )
  assert.deepEqual(extractCareerConfig(embeddedCareersHtml), {
    identifier: EXPECTED_IDENTIFIER,
    domain: EXPECTED_KEKA_DOMAIN,
    portalName: EXPECTED_PORTAL_SLUG,
  })
})

test('builds the live Keka careers API endpoints and validates the official portal identity payload', () => {
  assert.equal(
    buildCareerPortalInfoUrl({ domain: EXPECTED_KEKA_DOMAIN }),
    'https://hr.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    buildActiveJobsUrl({ domain: EXPECTED_KEKA_DOMAIN, identifier: EXPECTED_IDENTIFIER }),
    `https://hr.keka.com/careers/api/embedjobs/default/active/${EXPECTED_IDENTIFIER}`,
  )
  assert.equal(hasExpectedPortalIdentity(portalInfoPayload), true)
  assert.equal(hasExpectedPortalIdentity({ ...portalInfoPayload, careersPortalDomain: 'example.com' }), false)
})

test('extractSearchResults maps only India jobs from the live Keka API and normalizes compact experience values', () => {
  assert.deepEqual(extractSearchResults(activeJobsPayload, { domain: EXPECTED_KEKA_DOMAIN }), [
    {
      title: 'Payroll Specialist - US',
      company: 'KEKA TECHNOLOGIES',
      department: 'Customer Experience',
      location: 'Hyderabad, TG, India',
      city: 'Hyderabad',
      state: 'TG',
      country: 'India',
      jobId: '136293',
      requisitionId: 'KEKA/1374',
      sourceUrl: 'https://hr.keka.com/careers/jobdetails/136293',
      applyUrl: 'https://hr.keka.com/careers/applyjob/136293',
      employmentType: 'Full Time',
      experienceRequired: '3-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-30',
      closingDate: null,
      jobDescription: 'Own end-to-end payroll delivery.',
    },
    {
      title: 'Business Development Executive - Mid Market',
      company: 'KEKA TECHNOLOGIES',
      department: 'Sales',
      location: 'Delhi / Gurugram / Bengaluru, India',
      city: 'Delhi',
      state: null,
      country: 'India',
      jobId: '135901',
      requisitionId: 'KEKA/1370',
      sourceUrl: 'https://hr.keka.com/careers/jobdetails/135901',
      applyUrl: 'https://hr.keka.com/careers/applyjob/135901',
      employmentType: 'Full Time',
      experienceRequired: '4-7 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-27',
      closingDate: null,
      jobDescription: 'Build and close a strong sales pipeline.',
    },
  ])
})

test('createKekaTechnologiesScraper runs against the current careers shell and active jobs API contract', async () => {
  const scraper = createKekaTechnologiesScraper()
  const fetchedUrls = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      fetchedUrls.push(url)
      if (url === CAREERS_URL) return careersShellHtml
      if (url === 'https://hr.keka.com/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/9bca850b726f4d2e8844b67ebc40462f.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      fetchedUrls.push(url)
      if (url === 'https://hr.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfoPayload
      }
      if (url === `https://hr.keka.com/careers/api/embedjobs/default/active/${EXPECTED_IDENTIFIER}`) {
        return activeJobsPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-07T02:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'kekatechnologies')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'hr.keka.com')
  assert.equal(jobs[0].atsPlatform, 'keka-careers-embed-jobs-api')
  assert.equal(jobs[0].scrapedAt, '2026-08-07T02:00:00.000Z')
  assert.deepEqual(fetchedUrls, [
    'https://hr.keka.com/careers/',
    'https://hr.keka.com/ats/documents/24040a7e-a7c5-47a5-9cd5-019962c66385/careerportal/9bca850b726f4d2e8844b67ebc40462f.html',
    'https://hr.keka.com/careers/api/organization/default/careerportalinfo',
    `https://hr.keka.com/careers/api/embedjobs/default/active/${EXPECTED_IDENTIFIER}`,
  ])
})
