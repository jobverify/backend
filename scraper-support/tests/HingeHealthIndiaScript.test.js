import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const culturePageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title data-gatsby-head="true">Culture & Engagement | Hinge Health</title>
  </head>
  <body>
    <h1>People-first. Culture-forward. Always learning.</h1>
    <p>Join us in moving people beyond pain!</p>
    <a href="https://jobs.ashbyhq.com/hinge-health">Explore career opportunities</a>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'workday-system-admin-id',
      title: 'Workday System Admin',
      department: 'RnD',
      team: 'IT',
      employmentType: 'FullTime',
      location: 'Bengaluru-HQ',
      secondaryLocations: [],
      publishedAt: '2026-07-15T10:08:28.578+00:00',
      isListed: true,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/hinge-health/e25375e0-c089-4c95-87a1-8c9c5f0f9b83',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/e25375e0-c089-4c95-87a1-8c9c5f0f9b83/application',
      descriptionHtml: '<p>Administer Hinge Health Workday systems from Bengaluru.</p>',
    },
    {
      id: 'product-manager-id',
      title: 'Product Manager',
      department: 'RnD',
      team: 'Product',
      employmentType: 'FullTime',
      location: 'Bengaluru-HQ',
      secondaryLocations: [],
      publishedAt: '2026-05-29T12:19:11.615+00:00',
      isListed: true,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/hinge-health/73e6bba2-873b-49fc-ac63-92f67e62c09d',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/73e6bba2-873b-49fc-ac63-92f67e62c09d/application',
      descriptionHtml: '<p>Lead product strategy from Bengaluru.</p>',
    },
    {
      id: 'senior-software-engineer-id',
      title: 'Senior Software Engineer',
      department: 'RnD',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Bengaluru-HQ',
      secondaryLocations: [],
      publishedAt: '2026-05-29T14:56:29.630+00:00',
      isListed: true,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/hinge-health/b2964f69-23d0-4fe9-af0b-7466cdd051ee',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/b2964f69-23d0-4fe9-af0b-7466cdd051ee/application',
      descriptionHtml: '<p>Build product systems for Hinge Health from Bengaluru.</p>',
    },
    {
      id: 'senior-software-engineer-backend-id',
      title: 'Senior Software Engineer-Backend',
      department: 'RnD',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Bengaluru-HQ',
      secondaryLocations: [],
      publishedAt: '2026-07-07T04:56:55.216+00:00',
      isListed: true,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/hinge-health/8390aad0-ade1-4875-92d1-28a7ff4676a1',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/8390aad0-ade1-4875-92d1-28a7ff4676a1/application',
      descriptionHtml: '<p>Build backend systems for Hinge Health from Bengaluru.</p>',
    },
    {
      id: 'san-francisco-role-id',
      title: 'Staff Software Engineer, Growth',
      department: 'RnD',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'San Francisco-HQ',
      secondaryLocations: [],
      publishedAt: '2026-03-05T16:40:49.613+00:00',
      isListed: true,
      workplaceType: 'Hybrid',
      address: {
        postalAddress: {
          addressLocality: 'San Francisco',
          addressRegion: 'California',
          addressCountry: 'US',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/hinge-health/148e6d63-1fa8-4423-9b16-ac4b85765a65',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/148e6d63-1fa8-4423-9b16-ac4b85765a65/application',
      descriptionHtml: '<p>Build growth systems from San Francisco.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/hingehealthindia/script.js')
  } catch {
    assert.fail('Expected Hinge Health India scraper module at ../../scraper/hingehealthindia/script.js')
  }
}

test('Hinge Health India pins the verified official careers handoff and Ashby endpoints', async () => {
  const hingeHealthIndia = await loadModule()

  assert.equal(
    hingeHealthIndia.CULTURE_PAGE_URL,
    'https://www.hingehealth.com/about/culture-and-engagement/',
  )
  assert.equal(
    hingeHealthIndia.ASHBY_PUBLIC_BOARD_URL,
    'https://jobs.ashbyhq.com/hinge-health',
  )
  assert.equal(
    hingeHealthIndia.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/hinge-health',
  )
  assert.equal(hingeHealthIndia.hasOfficialCulturePageSignal(culturePageHtml), true)
  assert.equal(
    hingeHealthIndia.extractVerifiedAshbyPublicBoardUrl(culturePageHtml),
    'https://jobs.ashbyhq.com/hinge-health',
  )
  assert.equal(
    hingeHealthIndia.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/hinge-health'),
    'https://api.ashbyhq.com/posting-api/job-board/hinge-health',
  )
})

test('Hinge Health India extracts only India jobs from the verified Ashby payload', async () => {
  const hingeHealthIndia = await loadModule()
  const jobs = hingeHealthIndia.extractAshbyJobs(ashbyPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Workday System Admin',
      company: 'Hinge Health India',
      department: 'RnD',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'workday-system-admin-id',
      requisitionId: 'workday-system-admin-id',
      sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/e25375e0-c089-4c95-87a1-8c9c5f0f9b83',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/e25375e0-c089-4c95-87a1-8c9c5f0f9b83/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T10:08:28.578+00:00',
      closingDate: null,
      jobDescription: '<p>Administer Hinge Health Workday systems from Bengaluru.</p>',
    },
    {
      title: 'Product Manager',
      company: 'Hinge Health India',
      department: 'RnD',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'product-manager-id',
      requisitionId: 'product-manager-id',
      sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/73e6bba2-873b-49fc-ac63-92f67e62c09d',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/73e6bba2-873b-49fc-ac63-92f67e62c09d/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-29T12:19:11.615+00:00',
      closingDate: null,
      jobDescription: '<p>Lead product strategy from Bengaluru.</p>',
    },
    {
      title: 'Senior Software Engineer',
      company: 'Hinge Health India',
      department: 'RnD',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'senior-software-engineer-id',
      requisitionId: 'senior-software-engineer-id',
      sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/b2964f69-23d0-4fe9-af0b-7466cdd051ee',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/b2964f69-23d0-4fe9-af0b-7466cdd051ee/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-29T14:56:29.630+00:00',
      closingDate: null,
      jobDescription: '<p>Build product systems for Hinge Health from Bengaluru.</p>',
    },
    {
      title: 'Senior Software Engineer-Backend',
      company: 'Hinge Health India',
      department: 'RnD',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'senior-software-engineer-backend-id',
      requisitionId: 'senior-software-engineer-backend-id',
      sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/8390aad0-ade1-4875-92d1-28a7ff4676a1',
      applyUrl: 'https://jobs.ashbyhq.com/hinge-health/8390aad0-ade1-4875-92d1-28a7ff4676a1/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-07T04:56:55.216+00:00',
      closingDate: null,
      jobDescription: '<p>Build backend systems for Hinge Health from Bengaluru.</p>',
    },
  ])
})

test('Hinge Health India run validates the official culture-page handoff and returns only India roles from Ashby', async () => {
  const hingeHealthIndia = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await hingeHealthIndia.createHingeHealthIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === hingeHealthIndia.CULTURE_PAGE_URL) return culturePageHtml
      throw new Error(`Unexpected Hinge Health India text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ashbyPayload
    },
  })

  assert.deepEqual(requestedTexts, [hingeHealthIndia.CULTURE_PAGE_URL])
  assert.deepEqual(requestedJson, [hingeHealthIndia.ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'hingehealthindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      city: job.city,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Workday System Admin',
        city: 'Bengaluru',
        sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/e25375e0-c089-4c95-87a1-8c9c5f0f9b83',
      },
      {
        title: 'Product Manager',
        city: 'Bengaluru',
        sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/73e6bba2-873b-49fc-ac63-92f67e62c09d',
      },
      {
        title: 'Senior Software Engineer',
        city: 'Bengaluru',
        sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/b2964f69-23d0-4fe9-af0b-7466cdd051ee',
      },
      {
        title: 'Senior Software Engineer-Backend',
        city: 'Bengaluru',
        sourceUrl: 'https://jobs.ashbyhq.com/hinge-health/8390aad0-ade1-4875-92d1-28a7ff4676a1',
      },
    ],
  )
})

test('Hinge Health India fails closed when the verified culture page or Ashby payload drifts', async () => {
  const hingeHealthIndia = await loadModule()

  await assert.rejects(
    hingeHealthIndia.createHingeHealthIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ashbyPayload,
    }),
    /verified hinge health india official culture page/i,
  )

  await assert.rejects(
    hingeHealthIndia.createHingeHealthIndiaScraper().run({
      fetchText: async () =>
        culturePageHtml.replace('https://jobs.ashbyhq.com/hinge-health', 'https://jobs.ashbyhq.com/other'),
      fetchJson: async () => ashbyPayload,
    }),
    /verified hinge health india official culture page/i,
  )

  await assert.rejects(
    hingeHealthIndia.createHingeHealthIndiaScraper().run({
      fetchText: async () => culturePageHtml,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified ashby payload/i,
  )
})
