import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>
      Grow your Business | Get Instant Credit upto 25Lacs at 0% Interest |
      Buynow Paylater - ePayLater
    </title>
    <link rel="canonical" href="https://www.epaylater.in/" />
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@type": "Organization",
        "name": "epaylater",
        "url": "https://www.epaylater.in/",
        "sameAs": ["https://www.linkedin.com/company/epaylater/"]
      }
    </script>
    <a href="careers.html" class="nav-link">Careers</a>
    <a href="/supplier-login">Supplier Login</a>
    <a href="/blog">Blog</a>
    <p>Get instant credit for your Kirana store/Retail business at zero cost and 0 processing fees.</p>
    <p>Increase your sales, profits and get access to the widest seller network in India with ePayLater.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career</title>
  </head>
  <body>
    <main class="career-box">
      <a href="#role-section" class="btn typ-banner" id="join-btn-home-top">Explore Vacancies</a>
      <a href="mailto:careers@epaylater.in">
        <div class="popup-btn">Apply Now</div>
      </a>
      <h1 class="application-txt" id="popup-heading">Job Application Form</h1>
      <p>Fill out the form below to apply for job opening</p>
      <select id="job-opening" class="application-input">
        <option value="Senior Backend Developer">Senior Backend Developer</option>
        <option value="Data Analyst">Data Analyst</option>
        <option value="Tech Lead">Tech Lead</option>
      </select>
      <iframe
        src="https://epaylater.keka.com/careers/api/embedjobs/62503ac7-49d5-4c4c-98da-fb6b738d32f4"
        id="keka-openings"
      ></iframe>
    </main>
    <script>
      fetch("https://verify-internal.epaylater.in/v1/career/applicant", {
        method: "POST"
      })
    </script>
  </body>
</html>
`

const careerPortalInfo = {
  name: 'ePayLater',
  shortName: 'ePayLater',
  careersPortalDomain: 'epaylater.keka.com',
  socialLinks: [
    { type: 1, url: 'https://www.linkedin.com/company/epaylater/mycompany/?viewAsMember=true' },
  ],
  fontFamily: 'Roboto',
  jobListingSetting: {
    filters: ['department', 'location', 'jobType'],
    jobFields: ['location', 'experience', 'salaryRange'],
    jobListingFormat: 1,
  },
  applyStyles: false,
}

const activeJobsPayload = [
  {
    id: 144254,
    title: 'Cluster Manager - Lucknow (UP & East)',
    description:
      '<div><strong>Location</strong></div><div>Lucknow (Managing Territories across Uttar Pradesh, West Bengal, Bihar &amp; North East)</div><div><br></div><div><strong>About ePayLater</strong></div><div>Lead business growth across your assigned territories.</div>',
    excerpt: 'Lead business growth across your assigned territories.',
    departmentName: 'Sales',
    experience: '4-5 yrs',
    jobType: 2,
    publishedOn: '2026-06-10T11:01:40.127Z',
    jobLocations: [],
    skillNames: [],
  },
  {
    id: 70001,
    title: 'Assistant Manager - Accounts & Taxation (Fintech)',
    description: '<p>Maintain books of accounts and statutory compliance.</p>',
    excerpt: 'Maintain books of accounts and statutory compliance.',
    departmentName: 'Finance',
    experience: '7 years and above',
    jobType: 2,
    publishedOn: '2026-04-08T10:34:52.487Z',
    jobLocations: [
      { id: 7642, name: 'Mumbai', city: 'Mumbai', locationIdentifier: 'loc-mumbai' },
      { id: 7642, name: 'Head Office', city: 'Mumbai', locationIdentifier: 'loc-mumbai' },
    ],
    skillNames: [],
  },
  {
    id: 119004,
    title: 'Business Development - Internship',
    description: '<p>Support partnership discovery and market research.</p>',
    excerpt: 'Support partnership discovery and market research.',
    departmentName: 'Business Development',
    experience: null,
    jobType: 2,
    publishedOn: '2026-03-01T09:00:00.000Z',
    jobLocations: [],
    skillNames: ['Research'],
  },
]

const loadEPayLaterModule = async () => {
  try {
    return await import('../../scraper/epaylater/script.js')
  } catch {
    assert.fail('Expected ePayLater scraper module at ../../scraper/epaylater/script.js')
  }
}

test('ePayLater scraper helpers stay pinned to the verified first-party careers page and embedded Keka config', async () => {
  const ePayLater = await loadEPayLaterModule()

  assert.equal(ePayLater.SOURCE, 'epaylater')
  assert.equal(ePayLater.COMPANY, 'ePayLater')
  assert.equal(ePayLater.OFFICIAL_BRAND_NAME, 'ePayLater')
  assert.equal(ePayLater.VERIFIED_ON, '2026-07-15')
  assert.equal(ePayLater.HOMEPAGE_URL, 'https://www.epaylater.in/')
  assert.equal(ePayLater.CAREERS_URL, 'https://www.epaylater.in/careers.html')
  assert.equal(
    ePayLater.CAREER_PORTAL_INFO_URL,
    'https://epaylater.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(ePayLater.EXPECTED_KEKA_DOMAIN, 'https://epaylater.keka.com/careers/')
  assert.equal(ePayLater.EXPECTED_IDENTIFIER, '62503ac7-49d5-4c4c-98da-fb6b738d32f4')
  assert.equal(ePayLater.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ePayLater.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.deepEqual(ePayLater.extractCareerConfig(careersHtml), {
    identifier: '62503ac7-49d5-4c4c-98da-fb6b738d32f4',
    domain: 'https://epaylater.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    ePayLater.buildCareerPortalInfoUrl(ePayLater.extractCareerConfig(careersHtml)),
    'https://epaylater.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    ePayLater.buildActiveJobsUrl(ePayLater.extractCareerConfig(careersHtml)),
    'https://epaylater.keka.com/careers/api/embedjobs/default/active/62503ac7-49d5-4c4c-98da-fb6b738d32f4',
  )
  assert.deepEqual(
    ePayLater.extractSearchResults(activeJobsPayload, {
      domain: 'https://epaylater.keka.com/careers/',
    }),
    [
      {
        title: 'Cluster Manager - Lucknow (UP & East)',
        company: 'ePayLater',
        department: 'Sales',
        location: 'Lucknow (Managing Territories across Uttar Pradesh, West Bengal, Bihar & North East), India',
        city: 'Lucknow',
        country: 'India',
        jobId: '144254',
        requisitionId: '144254',
        sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/144254',
        applyUrl: 'https://epaylater.keka.com/careers/applyjob/144254',
        employmentType: 'Full Time',
        experienceRequired: '4-5 yrs',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-06-10',
        closingDate: null,
        jobDescription:
          'Location Lucknow (Managing Territories across Uttar Pradesh, West Bengal, Bihar & North East) About ePayLater Lead business growth across your assigned territories.',
      },
      {
        title: 'Assistant Manager - Accounts & Taxation (Fintech)',
        company: 'ePayLater',
        department: 'Finance',
        location: 'Mumbai, India',
        city: 'Mumbai',
        country: 'India',
        jobId: '70001',
        requisitionId: '70001',
        sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/70001',
        applyUrl: 'https://epaylater.keka.com/careers/applyjob/70001',
        employmentType: 'Full Time',
        experienceRequired: '7 years and above',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-04-08',
        closingDate: null,
        jobDescription: 'Maintain books of accounts and statutory compliance.',
      },
      {
        title: 'Business Development - Internship',
        company: 'ePayLater',
        department: 'Business Development',
        location: 'India',
        city: null,
        country: 'India',
        jobId: '119004',
        requisitionId: '119004',
        sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/119004',
        applyUrl: 'https://epaylater.keka.com/careers/applyjob/119004',
        employmentType: 'Full Time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Research'],
        postingDate: '2026-03-01',
        closingDate: null,
        jobDescription: 'Support partnership discovery and market research.',
      },
    ],
  )
})

test('ePayLater run returns public jobs from the verified first-party careers page and embedded Keka APIs', async () => {
  const ePayLater = await loadEPayLaterModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await ePayLater.createEPayLaterScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === ePayLater.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ePayLater.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected ePayLater page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === ePayLater.CAREER_PORTAL_INFO_URL) {
        return { status: 200, url, json: careerPortalInfo }
      }

      if (url === 'https://epaylater.keka.com/careers/api/embedjobs/default/active/62503ac7-49d5-4c4c-98da-fb6b738d32f4') {
        return { status: 200, url, json: activeJobsPayload }
      }

      throw new Error(`Unexpected ePayLater JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    ePayLater.HOMEPAGE_URL,
    ePayLater.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    ePayLater.CAREER_PORTAL_INFO_URL,
    'https://epaylater.keka.com/careers/api/embedjobs/default/active/62503ac7-49d5-4c4c-98da-fb6b738d32f4',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Cluster Manager - Lucknow (UP & East)',
      company: 'ePayLater',
      department: 'Sales',
      location: 'Lucknow (Managing Territories across Uttar Pradesh, West Bengal, Bihar & North East), India',
      city: 'Lucknow',
      country: 'India',
      jobId: '144254',
      requisitionId: '144254',
      sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/144254',
      applyUrl: 'https://epaylater.keka.com/careers/applyjob/144254',
      employmentType: 'Full Time',
      experienceRequired: '4-5 yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-10',
      closingDate: null,
      jobDescription:
        'Location Lucknow (Managing Territories across Uttar Pradesh, West Bengal, Bihar & North East) About ePayLater Lead business growth across your assigned territories.',
      source: 'epaylater',
      link: 'https://epaylater.keka.com/careers/applyjob/144254',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Assistant Manager - Accounts & Taxation (Fintech)',
      company: 'ePayLater',
      department: 'Finance',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '70001',
      requisitionId: '70001',
      sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/70001',
      applyUrl: 'https://epaylater.keka.com/careers/applyjob/70001',
      employmentType: 'Full Time',
      experienceRequired: '7 years and above',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-04-08',
      closingDate: null,
      jobDescription: 'Maintain books of accounts and statutory compliance.',
      source: 'epaylater',
      link: 'https://epaylater.keka.com/careers/applyjob/70001',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Business Development - Internship',
      company: 'ePayLater',
      department: 'Business Development',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '119004',
      requisitionId: '119004',
      sourceUrl: 'https://epaylater.keka.com/careers/jobdetails/119004',
      applyUrl: 'https://epaylater.keka.com/careers/applyjob/119004',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Research'],
      postingDate: '2026-03-01',
      closingDate: null,
      jobDescription: 'Support partnership discovery and market research.',
      source: 'epaylater',
      link: 'https://epaylater.keka.com/careers/applyjob/119004',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('ePayLater fails closed when the homepage, careers page, Keka config, portal info, or jobs feed drifts', async () => {
  const ePayLater = await loadEPayLaterModule()

  await assert.rejects(
    ePayLater.createEPayLaterScraper().run({
      fetchPage: async (url) => {
        if (url === ePayLater.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected ePayLater page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: ePayLater.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    ePayLater.createEPayLaterScraper().run({
      fetchPage: async (url) => {
        if (url === ePayLater.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ePayLater.CAREERS_URL) {
          return { status: 200, url, html: careersHtml.replace('Explore Vacancies', 'Explore Roles') }
        }

        throw new Error(`Unexpected ePayLater page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: ePayLater.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /careers page/i,
  )

  await assert.rejects(
    ePayLater.createEPayLaterScraper().run({
      fetchPage: async (url) => {
        if (url === ePayLater.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ePayLater.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '62503ac7-49d5-4c4c-98da-fb6b738d32f4',
              '11111111-2222-4333-8444-555555555555',
            ),
          }
        }

        throw new Error(`Unexpected ePayLater page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: ePayLater.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /keka job surface changed materially/i,
  )

  await assert.rejects(
    ePayLater.createEPayLaterScraper().run({
      fetchPage: async (url) => {
        if (url === ePayLater.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ePayLater.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        throw new Error(`Unexpected ePayLater page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === ePayLater.CAREER_PORTAL_INFO_URL) {
          return {
            status: 200,
            url,
            json: { ...careerPortalInfo, careersPortalDomain: 'changed.keka.com' },
          }
        }

        throw new Error(`Unexpected ePayLater JSON URL: ${url}`)
      },
    }),
    /career portal info/i,
  )

  await assert.rejects(
    ePayLater.createEPayLaterScraper().run({
      fetchPage: async (url) => {
        if (url === ePayLater.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ePayLater.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        throw new Error(`Unexpected ePayLater page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === ePayLater.CAREER_PORTAL_INFO_URL) {
          return { status: 200, url, json: careerPortalInfo }
        }

        if (url === 'https://epaylater.keka.com/careers/api/embedjobs/default/active/62503ac7-49d5-4c4c-98da-fb6b738d32f4') {
          return { status: 200, url, json: { broken: true } }
        }

        throw new Error(`Unexpected ePayLater JSON URL: ${url}`)
      },
    }),
    /active jobs/i,
  )
})
