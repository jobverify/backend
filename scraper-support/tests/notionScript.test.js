import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at Notion | We're Hiring!</title>
  </head>
  <body>
    <main>
      <h1>Careers at Notion</h1>
      <p>At Notion, every person helps teams of humans and AI agents think and work together.</p>
      <a href="https://jobs.ashbyhq.com/notion">Explore open roles</a>
      <h2>Open Positions</h2>
      <ul>
        <li><a href="https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715">Customer Support - Billing Hyderabad, India</a></li>
        <li><a href="https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92">Product Support Manager Hyderabad, India</a></li>
        <li><a href="https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4">QA Manager Hyderabad, India</a></li>
        <li><a href="https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5">Software Engineer, Developer Experience Hyderabad, India</a></li>
        <li><a href="https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87">Software Engineer, Infrastructure Hyderabad, India</a></li>
      </ul>
    </main>
  </body>
</html>
`

const ASHBY_PAYLOAD = {
  jobs: [
    {
      id: '42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      title: 'Software Engineer, Infrastructure',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Hyderabad, India',
      secondaryLocations: [],
      publishedAt: '2026-06-04T12:38:36.781+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      applyUrl: 'https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87/application',
      descriptionHtml: '<p>Build core platform systems for Notion from Hyderabad.</p>',
    },
    {
      id: '49bdf081-6e20-4323-8c73-6d6b19544ff5',
      title: 'Software Engineer, Developer Experience',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Hyderabad, India',
      secondaryLocations: [],
      publishedAt: '2026-06-24T08:26:55.883+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5',
      applyUrl: 'https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5/application',
      descriptionHtml: '<p>Improve the developer experience for Notion engineers in Hyderabad.</p>',
    },
    {
      id: '3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      title: 'Product Support Manager',
      department: 'Customer Experience',
      team: 'Customer Experience',
      employmentType: 'FullTime',
      location: 'Hyderabad, India',
      secondaryLocations: [],
      publishedAt: '2026-06-04T13:14:02.304+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      applyUrl: 'https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92/application',
      descriptionHtml: '<p>Lead support operations for Hyderabad-based product support teams.</p>',
    },
    {
      id: '9dd54b96-29f7-4263-8aba-768f90cd2715',
      title: 'Customer Support - Billing',
      department: 'Customer Experience',
      team: 'Customer Experience',
      employmentType: 'FullTime',
      location: 'Hyderabad, India',
      secondaryLocations: [],
      publishedAt: '2026-06-11T04:17:16.598+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715',
      applyUrl: 'https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715/application',
      descriptionHtml: '<p>Support billing operations for Notion customers from Hyderabad.</p>',
    },
    {
      id: 'f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      title: 'QA Manager',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Hyderabad, India',
      secondaryLocations: [],
      publishedAt: '2026-06-16T06:17:37.002+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      applyUrl: 'https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4/application',
      descriptionHtml: '<p>Lead quality assurance for Notion teams in Hyderabad.</p>',
    },
    {
      id: '05e14247-17c4-4e98-9a13-53828a4e2f13',
      title: 'Outbound Business Development Representative, AMER',
      department: 'Early Career',
      team: 'Early Career',
      employmentType: 'FullTime',
      location: 'New York, New York',
      secondaryLocations: [],
      publishedAt: '2026-04-02T21:00:55.755+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'New York',
          addressRegion: 'New York',
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13',
      applyUrl: 'https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application',
      descriptionHtml: '<p>Drive outbound pipeline generation for AMER.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/notion/script.js')
  } catch {
    assert.fail('Expected Notion scraper module at ../../scraper/notion/script.js')
  }
}

test('Notion pins the verified official careers and Ashby endpoints', async () => {
  const notion = await loadModule()

  assert.equal(notion.CAREERS_PAGE_URL, 'https://www.notion.com/careers')
  assert.equal(notion.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/notion')
  assert.equal(
    notion.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/notion',
  )
  assert.equal(notion.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    notion.extractVerifiedAshbyPublicBoardUrl(CAREERS_HTML),
    'https://jobs.ashbyhq.com/notion',
  )
  assert.equal(
    notion.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/notion'),
    'https://api.ashbyhq.com/posting-api/job-board/notion',
  )
})

test('Notion extracts only India jobs from the verified Ashby payload', async () => {
  const notion = await loadModule()
  const jobs = notion.extractAshbyJobs(ASHBY_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer, Infrastructure',
      company: 'Notion',
      department: 'Engineering',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      requisitionId: '42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      sourceUrl: 'https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      applyUrl: 'https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-04T12:38:36.781+00:00',
      closingDate: null,
      jobDescription: '<p>Build core platform systems for Notion from Hyderabad.</p>',
    },
    {
      title: 'Software Engineer, Developer Experience',
      company: 'Notion',
      department: 'Engineering',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '49bdf081-6e20-4323-8c73-6d6b19544ff5',
      requisitionId: '49bdf081-6e20-4323-8c73-6d6b19544ff5',
      sourceUrl: 'https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5',
      applyUrl: 'https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-24T08:26:55.883+00:00',
      closingDate: null,
      jobDescription: '<p>Improve the developer experience for Notion engineers in Hyderabad.</p>',
    },
    {
      title: 'Product Support Manager',
      company: 'Notion',
      department: 'Customer Experience',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      requisitionId: '3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      sourceUrl: 'https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      applyUrl: 'https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-04T13:14:02.304+00:00',
      closingDate: null,
      jobDescription: '<p>Lead support operations for Hyderabad-based product support teams.</p>',
    },
    {
      title: 'Customer Support - Billing',
      company: 'Notion',
      department: 'Customer Experience',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '9dd54b96-29f7-4263-8aba-768f90cd2715',
      requisitionId: '9dd54b96-29f7-4263-8aba-768f90cd2715',
      sourceUrl: 'https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715',
      applyUrl: 'https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-11T04:17:16.598+00:00',
      closingDate: null,
      jobDescription: '<p>Support billing operations for Notion customers from Hyderabad.</p>',
    },
    {
      title: 'QA Manager',
      company: 'Notion',
      department: 'Engineering',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: 'f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      requisitionId: 'f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      sourceUrl: 'https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      applyUrl: 'https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-16T06:17:37.002+00:00',
      closingDate: null,
      jobDescription: '<p>Lead quality assurance for Notion teams in Hyderabad.</p>',
    },
  ])
})

test('Notion run validates the official careers handoff and returns only India roles from Ashby', async () => {
  const notion = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await notion.createNotionScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === notion.CAREERS_PAGE_URL) return CAREERS_HTML
      throw new Error(`Unexpected Notion text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ASHBY_PAYLOAD
    },
  })

  assert.deepEqual(requestedTexts, [notion.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [notion.ASHBY_JOB_BOARD_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'notion')
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
        title: 'Software Engineer, Infrastructure',
        city: 'Hyderabad',
        sourceUrl: 'https://jobs.ashbyhq.com/notion/42f18ccd-c4c8-4a85-8c1f-de12c575fe87',
      },
      {
        title: 'Software Engineer, Developer Experience',
        city: 'Hyderabad',
        sourceUrl: 'https://jobs.ashbyhq.com/notion/49bdf081-6e20-4323-8c73-6d6b19544ff5',
      },
      {
        title: 'Product Support Manager',
        city: 'Hyderabad',
        sourceUrl: 'https://jobs.ashbyhq.com/notion/3339493a-ee21-49f3-ab09-e1f8ba8f1b92',
      },
      {
        title: 'Customer Support - Billing',
        city: 'Hyderabad',
        sourceUrl: 'https://jobs.ashbyhq.com/notion/9dd54b96-29f7-4263-8aba-768f90cd2715',
      },
      {
        title: 'QA Manager',
        city: 'Hyderabad',
        sourceUrl: 'https://jobs.ashbyhq.com/notion/f76618cc-f961-4d49-8ead-6eadcdebd0b4',
      },
    ],
  )
})

test('Notion fails closed when the verified careers page, Ashby handoff, or payload drifts', async () => {
  const notion = await loadModule()

  await assert.rejects(
    notion.createNotionScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /verified notion official careers page/i,
  )

  await assert.rejects(
    notion.createNotionScraper().run({
      fetchText: async () =>
        CAREERS_HTML.replaceAll('jobs.ashbyhq.com/notion', 'jobs.ashbyhq.com/other'),
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /verified ashby public board handoff/i,
  )

  await assert.rejects(
    notion.createNotionScraper().run({
      fetchText: async () => CAREERS_HTML,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified ashby payload/i,
  )
})
