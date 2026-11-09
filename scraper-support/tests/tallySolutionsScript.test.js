import assert from 'node:assert/strict'
import test from 'node:test'

const loadTallySolutionsModule = async () => {
  try {
    return await import('../../scraper/tallysolutions/script.js')
  } catch {
    return null
  }
}

const samplePayload = {
  success: true,
  data: [
    {
      jobId: 'TS-1001',
      jobTitle: 'Software Development Engineer',
      jobLocation: 'Bengaluru, Karnataka, India',
      department: 'Engineering',
      experience: '2-5 years',
      employmentType: 'Full Time',
      postedOn: '2026-06-18',
      description: `
        <div class="job-description">
          <p>Build accounting platform experiences.</p>
          <h4>Skills</h4>
          <ul>
            <li>JavaScript</li>
            <li>Node.js</li>
          </ul>
          <form class="job-apply-form">
            <input type="hidden" name="job_id" value="TS-1001" />
          </form>
        </div>
      `,
    },
    {
      jobId: 'TS-2002',
      jobTitle: 'Regional Sales Lead',
      jobLocation: 'Dubai, United Arab Emirates',
      department: 'Sales',
      experience: '8+ years',
      employmentType: 'Full Time',
      postedOn: '2026-06-11',
      description: '<p>Lead regional sales across the Gulf region.</p>',
    },
  ],
}

test('buildListingRequestBody keeps the Tally Solutions public POST filter contract', async () => {
  const tallySolutions = await loadTallySolutionsModule()
  assert.ok(tallySolutions)

  assert.equal(
    tallySolutions.buildListingUrl(),
    'https://tallysolutions.com/wp-content/themes/tally/api/api-careers-job-listing.php',
  )
  assert.equal(
    tallySolutions.buildListingRequestBody(),
    'companySelector=&countrySelector=&departmentSelector=',
  )
  assert.equal(
    tallySolutions.buildListingRequestBody({
      companySelector: 'Tally Solutions',
      countrySelector: 'India',
      departmentSelector: 'Engineering',
    }),
    'companySelector=Tally+Solutions&countrySelector=India&departmentSelector=Engineering',
  )
})

test('extractListings keeps India Tally Solutions jobs and models the same-page apply flow', async () => {
  const tallySolutions = await loadTallySolutionsModule()
  assert.ok(tallySolutions)

  const jobs = tallySolutions.extractListings(samplePayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Development Engineer',
    company: 'Tally Solutions',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'TS-1001',
    requisitionId: 'TS-1001',
    sourceUrl: 'https://tallysolutions.com/careers/opportunities/',
    applyUrl: 'https://tallysolutions.com/careers/opportunities/',
    employmentType: 'Full Time',
    experienceRequired: '2-5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'JavaScript',
      'Node.js',
    ],
    postingDate: '2026-06-18',
    closingDate: null,
    jobDescription: 'Build accounting platform experiences. Skills JavaScript Node.js',
  })
})

test('run posts to the Tally Solutions public jobs endpoint and decorates shared fields', async () => {
  const tallySolutions = await loadTallySolutionsModule()
  assert.ok(tallySolutions)

  const requests = []
  const scraper = tallySolutions.createTallySolutionsScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchListings: async ({ url, body }) => {
      requests.push({ url, body })
      return samplePayload
    },
  })

  assert.deepEqual(requests, [
    {
      url: tallySolutions.buildListingUrl(),
      body: tallySolutions.buildListingRequestBody(),
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'tallysolutions')
  assert.equal(jobs[0].link, 'https://tallysolutions.com/careers/opportunities/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
