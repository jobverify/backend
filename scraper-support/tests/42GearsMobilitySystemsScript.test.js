import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - 42Gears Mobility Systems</title>
  </head>
  <body>
    <h1>Let's do something interesting - together.</h1>
    <h2>Current Openings</h2>
    <article class="job-card">
      <a href="https://www.42gears.com/careers/intern-admin-and-facilities/">
        <h3>Intern - Admin and facilities</h3>
      </a>
      <p>Internship</p>
      <p>Bengaluru, India</p>
      <p>Relevant Experience: Fresher Responsibilities: Qualifications:</p>
    </article>
    <article class="job-card">
      <a href="https://www.42gears.com/careers/lead-software-engineer/">
        <h3>Lead Software Engineer</h3>
      </a>
      <p>Full Time</p>
      <p>Bengaluru, India</p>
      <p>Relevant Experience: 5+ years Core Responsibilities Technical Requirements Security: Design:</p>
    </article>
    <article class="job-card">
      <a href="https://www.42gears.com/careers/channel-sales-manager-chicago-area/">
        <h3>Channel Sales Manager - Chicago area</h3>
      </a>
      <p>Full Time</p>
      <p>USA</p>
      <p>Location: Remote, based in Chicago</p>
    </article>
  </body>
</html>
`

const nextFlightPayload = [
  '$',
  '$L22',
  '4',
  {
    model: {
      heading: 'Current Openings',
      enableSearch: true,
      filters: {
        filters: {
          enableJobType: true,
          enableJobLocation: true,
        },
      },
      items: [],
    },
    items: [
      {
        title: 'Assistant Manager- Finance',
        excerpt:
          'Relevant Experience: Qualified CA with a minimum of 3 years&#8217; post-qualification experience We are looking for an Assistant Manager - Finance who is detail-oriented and proactive to support our finance and accounting operations.&hellip;',
        href: '/careers/assistant-manager-finance/',
        jobTypes: ['Full Time'],
        jobLocations: ['Bengaluru', 'India'],
      },
      {
        title: 'Lead Software Engineer',
        excerpt: 'Relevant Experience: 5+ years Core Responsibilities Technical Requirements Security: Design:',
        href: '/careers/lead-software-engineer/',
        jobTypes: ['Full Time'],
        jobLocations: ['Bengaluru', 'India'],
      },
      {
        title: 'Channel Sales Manager - Chicago area',
        excerpt: 'Location: Remote, based in Chicago Type: Full-time',
        href: '/careers/channel-sales-manager-chicago-area/',
        jobTypes: ['Full Time'],
        jobLocations: ['USA'],
      },
      {
        title: 'Product Specialist',
        excerpt: 'Relevant Experience: 3+ years Roles and responsibilities: Requirements',
        href: '/careers/product-specialist/',
        jobTypes: ['Full time'],
        jobLocations: [],
      },
    ],
  },
]

const nextFlightCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join 42Gears Team</title>
  </head>
  <body>
    <h1>Join 42Gears Team.</h1>
    <div id="careers-list">Current Openings</div>
    <script>self.__next_f.push([1,${JSON.stringify(`1f:${JSON.stringify(nextFlightPayload)}`)}])</script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/42gears/script.js')
  } catch {
    assert.fail('Expected 42Gears Mobility Systems scraper module at ../../scraper/42gears/script.js')
  }
}

test('42Gears Mobility Systems helpers stay pinned to the verified India-filtered first-party careers listing', async () => {
  const fortyTwoGears = await loadModule()

  assert.equal(fortyTwoGears.SOURCE, '42gears')
  assert.equal(fortyTwoGears.COMPANY, '42Gears Mobility Systems')
  assert.equal(
    fortyTwoGears.CAREERS_URL,
    'https://www.42gears.com/careers/?selected_jobtype=-1&selected_location=india',
  )
  assert.equal(fortyTwoGears.VERIFIED_ON, '2026-09-03')
  assert.equal(fortyTwoGears.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(fortyTwoGears.hasOfficialCareersSignal(nextFlightCareersHtml), true)
  assert.equal(fortyTwoGears.hasOfficialCareersSignal('<html><body><h1>Current Openings</h1></body></html>'), false)
  assert.deepEqual(fortyTwoGears.extractJobs(careersHtml), [
    {
      title: 'Intern - Admin and facilities',
      company: '42Gears Mobility Systems',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'intern-admin-and-facilities',
      requisitionId: 'intern-admin-and-facilities',
      sourceUrl: 'https://www.42gears.com/careers/intern-admin-and-facilities/',
      applyUrl: 'https://www.42gears.com/careers/intern-admin-and-facilities/',
      employmentType: 'Internship',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Relevant Experience: Fresher Responsibilities: Qualifications:',
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead Software Engineer',
      company: '42Gears Mobility Systems',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'lead-software-engineer',
      requisitionId: 'lead-software-engineer',
      sourceUrl: 'https://www.42gears.com/careers/lead-software-engineer/',
      applyUrl: 'https://www.42gears.com/careers/lead-software-engineer/',
      employmentType: 'Full Time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Relevant Experience: 5+ years Core Responsibilities Technical Requirements Security: Design:',
      remoteStatus: 'On-site',
    },
  ])
  assert.deepEqual(fortyTwoGears.extractJobs(nextFlightCareersHtml), [
    {
      title: 'Assistant Manager- Finance',
      company: '42Gears Mobility Systems',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'assistant-manager-finance',
      requisitionId: 'assistant-manager-finance',
      sourceUrl: 'https://www.42gears.com/careers/assistant-manager-finance/',
      applyUrl: 'https://www.42gears.com/careers/assistant-manager-finance/',
      employmentType: 'Full Time',
      experienceRequired: "Qualified CA with a minimum of 3 years' post-qualification experience",
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        "Relevant Experience: Qualified CA with a minimum of 3 years' post-qualification experience We are looking for an Assistant Manager - Finance who is detail-oriented and proactive to support our finance and accounting operations....",
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead Software Engineer',
      company: '42Gears Mobility Systems',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'lead-software-engineer',
      requisitionId: 'lead-software-engineer',
      sourceUrl: 'https://www.42gears.com/careers/lead-software-engineer/',
      applyUrl: 'https://www.42gears.com/careers/lead-software-engineer/',
      employmentType: 'Full Time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Relevant Experience: 5+ years Core Responsibilities Technical Requirements Security: Design:',
      remoteStatus: 'On-site',
    },
  ])
})

test('42Gears Mobility Systems run validates the verified careers page before decorating extracted jobs', async () => {
  const fortyTwoGears = await loadModule()
  const requestedUrls = []

  const jobs = await fortyTwoGears.create42GearsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === fortyTwoGears.CAREERS_URL) return nextFlightCareersHtml
      throw new Error(`Unexpected 42Gears URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [fortyTwoGears.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, '42gears')
  assert.equal(jobs[0].link, 'https://www.42gears.com/careers/assistant-manager-finance/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('42Gears Mobility Systems run fails closed when the verified careers surface drifts', async () => {
  const fortyTwoGears = await loadModule()

  await assert.rejects(
    fortyTwoGears.create42GearsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified 42gears mobility systems careers surface/i,
  )
})
