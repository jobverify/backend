import assert from 'node:assert/strict'
import test from 'node:test'

const loadDeShawModule = async () => {
  try {
    return await import('../../scraper/deshawindia/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <div class="job" data-job-id="6147">
    <div class="information">
      <p class="category">Core Tech</p>
      <span class="location">HYD/BLR</span>
    </div>
    <div class="description-wrapper">
      <a class="parent-arrow-long" href="/careers/lead-tech-djs-web-infrastructure-6147">
        <p><span class="job-display-name">Lead, Tech (DJS Web Infrastructure)</span></p>
      </a>
    </div>
  </div>
  <div class="job" data-job-id="2781">
    <div class="information">
      <p class="category">Financial Operations</p>
      <span class="location">HYD/BLR/GGM</span>
    </div>
    <div class="description-wrapper">
      <a class="parent-arrow-long" href="/careers/all-positions-in-financial-operations-2781">
        <p><span class="job-display-name">All positions in Financial Operations</span></p>
      </a>
    </div>
  </div>
`

const buildDetailHtml = (jobData) => `
  <html>
    <body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            routes: [],
            notMainUrl: false,
            jobData,
          },
        },
      })}</script>
    </body>
  </html>
`

const explicitDetailHtml = buildDetailHtml({
  jobMetadata: {
    isExploratory: false,
    workStatus: 'Regular FT',
    jobLocations: [
      { name: 'Hyderabad' },
      { name: 'Bengaluru' },
    ],
  },
  jobDescription: {
    websiteDescription: 'We are looking for an experienced engineer to join our Legal Tech team.',
    responsibilities: 'You will design, build, and support business-critical applications.',
    peopleWeAreLookingFor: [
      'The ideal candidate should hold basic qualifications and at least 4 years of programming experience in Python or equivalent languages.',
    ],
  },
})

const exploratoryDetailHtml = buildDetailHtml({
  jobMetadata: {
    isExploratory: true,
    workStatus: 'Regular FT',
    jobLocations: [
      { name: 'Hyderabad' },
      { name: 'Bengaluru' },
      { name: 'Gurugram' },
    ],
  },
  jobDescription: {
    websiteDescription: 'We invite you to submit a general, exploratory application for future opportunities.',
    responsibilities: null,
    peopleWeAreLookingFor: null,
  },
})

test('extractCareerListings maps D. E. Shaw India official career cards to India job records', async () => {
  const deShaw = await loadDeShawModule()
  assert.ok(deShaw)

  const jobs = deShaw.extractCareerListings(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Lead, Tech (DJS Web Infrastructure)',
    company: 'D. E. Shaw India',
    department: 'Core Tech',
    location: 'Hyderabad, Bengaluru, India',
    city: null,
    country: 'India',
    jobId: '6147',
    requisitionId: '6147',
    sourceUrl: 'https://www.deshawindia.com/careers/lead-tech-djs-web-infrastructure-6147',
    applyUrl: 'https://www.deshawindia.com/careers/lead-tech-djs-web-infrastructure-6147',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].location, 'Hyderabad, Bengaluru, Gurugram, India')
  assert.equal(jobs[1].department, 'Financial Operations')
})

test('extractJobDetail recovers explicit experience from the public detail payload', async () => {
  const deShaw = await loadDeShawModule()
  assert.ok(deShaw)

  const [listing] = deShaw.extractCareerListings(careersHtml)
  const detail = deShaw.extractJobDetail(explicitDetailHtml, listing)

  assert.equal(detail.title, 'Lead, Tech (DJS Web Infrastructure)')
  assert.equal(detail.location, 'Hyderabad, Bengaluru, India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '4+ years')
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /4 years of programming experience/i)
})

test('extractJobDetail marks exploratory public detail pages as checked missing', async () => {
  const deShaw = await loadDeShawModule()
  assert.ok(deShaw)

  const [, listing] = deShaw.extractCareerListings(careersHtml)
  const detail = deShaw.extractJobDetail(exploratoryDetailHtml, listing)

  assert.equal(detail.title, 'All positions in Financial Operations')
  assert.equal(detail.location, 'Hyderabad, Bengaluru, Gurugram, India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /exploratory application/i)
})

test('run fetches the D. E. Shaw India careers page and decorates official listings for the runner', async () => {
  const deShaw = await loadDeShawModule()
  assert.ok(deShaw)

  const requestedUrls = []
  const jobs = await deShaw.createDeShawScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://www.deshawindia.com/careers') return careersHtml
      if (url === 'https://www.deshawindia.com/careers/lead-tech-djs-web-infrastructure-6147') {
        return explicitDetailHtml
      }
      if (url === 'https://www.deshawindia.com/careers/all-positions-in-financial-operations-2781') {
        return exploratoryDetailHtml
      }
      throw new Error(`Unexpected test URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.deshawindia.com/careers',
    'https://www.deshawindia.com/careers/lead-tech-djs-web-infrastructure-6147',
    'https://www.deshawindia.com/careers/all-positions-in-financial-operations-2781',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'deshawindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].company, 'D. E. Shaw India')
  assert.equal(jobs[0].experienceRequired, '4+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
