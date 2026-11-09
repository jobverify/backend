import assert from 'node:assert/strict'
import test from 'node:test'

const loadCredresolveModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>CredResolve Advisory Services - Loan Settlement and Financial Resolution Experts in India</title>
  </head>
  <body>
    <main>
      <h1>CredResolve Advisory Services</h1>
      <p>Loan Settlement and Financial Resolution Experts in India</p>
      <a href="https://credresolve.co.in/about-us/">About CredResolve</a>
      <a href="https://credresolve.co.in/jobopenings">Job Openings</a>
      <a href="mailto:contact@credresolve.co.in">contact@credresolve.co.in</a>
      <p>Head Office NewTown, Kolkata</p>
    </main>
  </body>
</html>
`

const jobOpeningsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Openings &#8211; CredResolve Advisory Services</title>
  </head>
  <body>
    <main>
      <h1>Job Openings</h1>
      <p>Careers at CredResolve Advisory Services</p>
      <a href="https://credresolve.co.in/jobopenings/back-office-executive/">Back Office Executive</a>
      <a href="https://credresolve.co.in/jobopenings/customer-support-executive/">Customer Support Executive</a>
    </main>
  </body>
</html>
`

const listingPayload = [
  {
    id: 606,
    link: 'https://credresolve.co.in/jobopenings/back-office-executive/',
    title: {
      rendered: 'Back Office Executive',
    },
    content: {
      rendered: `
        <h3 class="wp-block-heading">Job Title</h3>
        <p>Back Office Executive</p>
        <h3 class="wp-block-heading">Job Location</h3>
        <p>In-office</p>
        <h3 class="wp-block-heading">Job Type</h3>
        <p>Full-Time</p>
        <h3 class="wp-block-heading">Job Category</h3>
        <p>Administration / Operations</p>
        <h3 class="wp-block-heading">Job Description</h3>
        <p>The Back Office Executive will handle documentation, data entry, and operational support for financial and legal cases.</p>
        <h3 class="wp-block-heading">Key Responsibilities</h3>
        <ul class="wp-block-list">
          <li>Maintain records and documents</li>
          <li>Data entry and reporting</li>
        </ul>
        <h3 class="wp-block-heading">Requirements</h3>
        <ul class="wp-block-list">
          <li>Basic computer knowledge</li>
          <li>Attention to detail</li>
        </ul>
      `,
      protected: false,
    },
    class_list: [
      'post-606',
      'awsm_job_openings',
      'type-awsm_job_openings',
      'status-publish',
      'hentry',
    ],
  },
  {
    id: 600,
    link: 'https://credresolve.co.in/jobopenings/customer-support-executive/',
    title: {
      rendered: 'Customer Support Executive',
    },
    content: {
      rendered: `
        <h3 class="wp-block-heading">Job Title</h3>
        <p>Customer Support Executive</p>
        <h3 class="wp-block-heading">Job Location</h3>
        <p>Mumbai, India</p>
        <h3 class="wp-block-heading">Job Type</h3>
        <p>In-office</p>
        <h3 class="wp-block-heading">Job Category</h3>
        <p>Customer Support / Client Service</p>
        <h3 class="wp-block-heading">Job Description</h3>
        <p>CredResolve Advisory Services is looking for a Customer Support Executive to handle client inquiries.</p>
        <h3 class="wp-block-heading">Requirements</h3>
        <ul class="wp-block-list">
          <li>Good communication skills</li>
          <li>Ability to handle pressure and multitask</li>
        </ul>
      `,
      protected: false,
    },
    class_list: [
      'post-600',
      'awsm_job_openings',
      'type-awsm_job_openings',
      'status-publish',
      'hentry',
    ],
  },
]

test('CredResolve helpers stay pinned to the verified official homepage, job openings page, and AWSM REST feed', async () => {
  const credresolve = await loadCredresolveModule()
  assert.ok(credresolve, 'Expected scraper module at ./script.js')

  assert.equal(credresolve.SOURCE, 'credresolve')
  assert.equal(credresolve.COMPANY, 'CredResolve')
  assert.equal(credresolve.HOMEPAGE_URL, 'https://credresolve.co.in/')
  assert.equal(credresolve.JOB_OPENINGS_URL, 'https://credresolve.co.in/jobopenings')
  assert.equal(credresolve.CAREERS_API_URL, 'https://credresolve.co.in/wp-json/wp/v2/awsm_job_openings')
  assert.equal(typeof credresolve.hasOfficialHomepageSignal, 'function')
  assert.equal(typeof credresolve.hasOfficialJobOpeningsSignal, 'function')
  assert.equal(typeof credresolve.buildSearchUrl, 'function')
  assert.equal(typeof credresolve.extractSearchResults, 'function')
  assert.equal(typeof credresolve.createCredresolveScraper, 'function')
  assert.equal(typeof credresolve.run, 'function')

  assert.equal(credresolve.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(credresolve.hasOfficialJobOpeningsSignal(jobOpeningsHtml), true)
  assert.equal(
    credresolve.buildSearchUrl(1),
    'https://credresolve.co.in/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1',
  )

  assert.deepEqual(credresolve.extractSearchResults(listingPayload).map(({rawNativeRoleEvidence,...job})=>job), [
    {
      title: 'Back Office Executive',
      company: 'CredResolve',
      department: 'Administration / Operations',
      location: null,
      city: null,
      country: null,
      jobId: '606',
      requisitionId: '606',
      sourceUrl: 'https://credresolve.co.in/jobopenings/back-office-executive/',
      applyUrl: 'https://credresolve.co.in/jobopenings/back-office-executive/',
      employmentType: 'Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Basic computer knowledge',
        'Attention to detail',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'The Back Office Executive will handle documentation, data entry, and operational support for financial and legal cases. Maintain records and documents Data entry and reporting Basic computer knowledge Attention to detail',
      remoteStatus: 'On-site',
    },
    {
      title: 'Customer Support Executive',
      company: 'CredResolve',
      department: 'Customer Support / Client Service',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '600',
      requisitionId: '600',
      sourceUrl: 'https://credresolve.co.in/jobopenings/customer-support-executive/',
      applyUrl: 'https://credresolve.co.in/jobopenings/customer-support-executive/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Good communication skills',
        'Ability to handle pressure and multitask',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'CredResolve Advisory Services is looking for a Customer Support Executive to handle client inquiries. Good communication skills Ability to handle pressure and multitask',
      remoteStatus: 'On-site',
    },
  ])
})

test('CredResolve run validates the verified first-party surfaces and paginates the AWSM feed', async () => {
  const credresolve = await loadCredresolveModule()
  assert.ok(credresolve, 'Expected scraper module at ./script.js')

  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await credresolve.createCredresolveScraper({ pageSize: 2 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === credresolve.HOMEPAGE_URL) return homepageHtml
      if (url === credresolve.JOB_OPENINGS_URL) return jobOpeningsHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === credresolve.buildSearchUrl(1, 2)) return listingPayload
      if (url === credresolve.buildSearchUrl(2, 2)) return []
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-12T06:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    'https://credresolve.co.in/',
    'https://credresolve.co.in/jobopenings',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://credresolve.co.in/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=1',
    'https://credresolve.co.in/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=2',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'credresolve')
  assert.equal(jobs[0].link, 'https://credresolve.co.in/jobopenings/back-office-executive/')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T06:00:00.000Z')
})

test('CredResolve fails closed when the verified public surfaces drift', async () => {
  const credresolve = await loadCredresolveModule()
  assert.ok(credresolve, 'Expected scraper module at ./script.js')

  await assert.rejects(
    credresolve.createCredresolveScraper().run({
      fetchText: async (url) => {
        if (url === credresolve.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official homepage surface/i,
  )

  await assert.rejects(
    credresolve.createCredresolveScraper().run({
      fetchText: async (url) => {
        if (url === credresolve.HOMEPAGE_URL) return homepageHtml
        if (url === credresolve.JOB_OPENINGS_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official job openings surface/i,
  )

  await assert.rejects(
    credresolve.createCredresolveScraper().run({
      fetchText: async (url) => {
        if (url === credresolve.HOMEPAGE_URL) return homepageHtml
        if (url === credresolve.JOB_OPENINGS_URL) return jobOpeningsHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0 }),
    }),
    /verified wp job openings feed/i,
  )
})
