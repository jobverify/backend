import assert from 'node:assert/strict'
import test from 'node:test'

const loadSonataModule = async () => {
  try {
    return await import('../../scraper/sonata/script.js')
  } catch {
    assert.fail('Expected Sonata scraper module at ../../scraper/sonata/script.js')
  }
}

const jobListingsHtml = `
  <html>
    <head>
      <title>Job listings | Sonata Software</title>
    </head>
    <body>
      <a href="/careers/applynow">Apply Now</a>
      <h1>Job listings</h1>
      <table class="table table-hover table-striped views-table views-view-table cols-5">
        <thead>
          <tr>
            <th>Title</th>
            <th>Skill</th>
            <th>Years of Experience</th>
            <th>Locations</th>
            <th>Requirement ID</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/node/5314">Azure Solution Architect</a></td>
            <td><p>Azure Solution Architect IAAS/PAAS/Ai</p></td>
            <td>10</td>
            <td>Bengaluru/Hyderabad</td>
            <td><a href="https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a682db8429a278/company_id/5feab0d9b94c6/business_unit/5feabc9953ac4">SSL-25-26-288</a></td>
          </tr>
          <tr>
            <td><a href="/node/5311">Salesforce Architect- Pre Sales</a></td>
            <td><p>Salesforce, Presales,Sales cloud, Service Cloud, CPQ, Vlocity &amp; Agent force</p></td>
            <td>10</td>
            <td>Bengaluru</td>
            <td><a href="https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a683038d5194a1/company_id/5feab0d9b94c6/business_unit/a646b3ba149120">SSL-25-26-307</a></td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
`

test('createSonataScraper targets the official Sonata job listings page and extracts first-party rows', async () => {
  const sonata = await loadSonataModule()
  const scraper = sonata.createSonataScraper()

  assert.equal(sonata.SOURCE, 'sonata')
  assert.equal(sonata.COMPANY, 'Sonata Software')
  assert.equal(sonata.CAREERS_URL, 'https://www.sonata-software.com/careers')
  assert.equal(sonata.JOB_LISTINGS_URL, 'https://dev2024.sonata-software.com/careers/job-postings')
  assert.equal(sonata.hasOfficialSonataJobListingsSignal(jobListingsHtml), true)

  assert.deepEqual(sonata.extractSearchResults(jobListingsHtml), [
    {
      title: 'Azure Solution Architect',
      company: 'Sonata Software',
      department: null,
      location: 'Bengaluru/Hyderabad, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'SSL-25-26-288',
      requisitionId: 'SSL-25-26-288',
      sourceUrl: 'https://dev2024.sonata-software.com/node/5314',
      applyUrl: 'https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a682db8429a278/company_id/5feab0d9b94c6/business_unit/5feabc9953ac4',
      employmentType: null,
      experienceRequired: '10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Azure Solution Architect IAAS/PAAS/Ai'],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'Salesforce Architect- Pre Sales',
      company: 'Sonata Software',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'SSL-25-26-307',
      requisitionId: 'SSL-25-26-307',
      sourceUrl: 'https://dev2024.sonata-software.com/node/5311',
      applyUrl: 'https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a683038d5194a1/company_id/5feab0d9b94c6/business_unit/a646b3ba149120',
      employmentType: null,
      experienceRequired: '10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Salesforce',
        'Presales',
        'Sales cloud',
        'Service Cloud',
        'CPQ',
        'Vlocity & Agent force',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
  ])

  assert.equal(typeof scraper.run, 'function')
})

test('run keeps Sonata jobs on the official public detail pages while preserving the Darwinbox apply handoff', async () => {
  const sonata = await loadSonataModule()
  const scraper = sonata.createSonataScraper({ maxJobs: 1 })
  const requestedUrls = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sonata.JOB_LISTINGS_URL) return jobListingsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-15T09:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [sonata.JOB_LISTINGS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Sonata Software')
  assert.equal(jobs[0].source, 'sonata')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].sourceUrl, 'https://dev2024.sonata-software.com/node/5314')
  assert.equal(
    jobs[0].applyUrl,
    'https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a682db8429a278/company_id/5feab0d9b94c6/business_unit/5feabc9953ac4',
  )
  assert.equal(
    jobs[0].link,
    'https://sonataone.darwinbox.in/recruitment/recruitment/jobsdetailedemployee/id/a682db8429a278/company_id/5feab0d9b94c6/business_unit/5feabc9953ac4',
  )
  assert.equal(jobs[0].scrapedAt, '2026-08-15T09:30:00.000Z')
})
