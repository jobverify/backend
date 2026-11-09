import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_URL,
  createRamcoSystemsLtdScraper,
  extractEmbeddedJobData,
  extractIndiaListings,
  extractJobsPageUrl,
  hasOfficialCareersSignal,
  hasOfficialJobsSignal,
} from '../../scraper/ramcosystemsltd/script.js'

const careersPageHtml = `
  <html>
    <head>
      <title>Ramco Careers | Jobs at Ramco | Values and Work Culture</title>
    </head>
    <body>
      <a href="https://www.ramco.com/careers/jobs-by-locations">Explore opportunities</a>
      <a href="https://www.ramco.com/careers/jobs-by-locations?experience=Experienced">Experienced</a>
    </body>
  </html>
`

const jobsPageHtml = `
  <html>
    <head>
      <title>Ramco Careers | Explore Job Opportunities</title>
    </head>
    <body>
      <div class="job-listing"></div>
      <script>
        const jobData = [
          {
            "page_path" : "software-engineer",
            "job_title" : \`Software Engineer\`,
            "job_code" : "SE-001",
            "job_level" : "Experienced",
            "location" : "India",
            "location_coordinates" : \`\`,
            "job_status" : "Active",
            "experience" : \`<p>2 to 5 Years of Experience</p>\`,
            "qualification" : \`BE / B.Tech\`,
            "roles_responsibilities" : \`<p>Build product features.</p><ul><li>Own delivery</li></ul>\`,
            "skills" : \`<p>JavaScript, Node.js</p>\`,
            "sbu" : \`Aviation\`,
            "hr_spoc" : "hr@ramco.com",
            "hiring_manager":"Hiring Manager",
            "priority" : "High",
            "qualification" : "Experienced"
          },
          {
            "page_path" : "regional-sales-us",
            "job_title" : \`Regional Sales - US\`,
            "job_code" : "SAL-001",
            "job_level" : "Experienced",
            "location" : "United States",
            "location_coordinates" : \`\`,
            "job_status" : "Active",
            "experience" : \`<p>8 to 15 Years of Experience</p>\`,
            "qualification" : \`Graduation\`,
            "roles_responsibilities" : \`<p>Sell software.</p>\`,
            "skills" : \`<p>Enterprise sales</p>\`,
            "sbu" : \`HR & Payroll\`,
            "hr_spoc" : "sales@ramco.com",
            "hiring_manager":"Sales Manager",
            "priority" : "High",
            "qualification" : "Experienced"
          },
          {
            "page_path" : "intern-product",
            "job_title" : \`Product Intern\`,
            "job_code" : "INT-001",
            "job_level" : "Entry",
            "location" : "India",
            "location_coordinates" : \`\`,
            "job_status" : "Inactive",
            "experience" : \`<p>0 to 1 Years of Experience</p>\`,
            "qualification" : \`Any Graduate\`,
            "roles_responsibilities" : \`<p>Support PM team.</p>\`,
            "skills" : \`<p>Research</p>\`,
            "sbu" : \`Corporate Support\`,
            "hr_spoc" : "interns@ramco.com",
            "hiring_manager":"Intern Manager",
            "priority" : "Low",
            "qualification" : "Internship"
          }
        ]
        const displayJobposts = () => {}
      </script>
    </body>
  </html>
`

test('Ramco helpers validate the official careers handoff and parse the embedded public jobs dataset', () => {
  assert.equal(CAREERS_URL, 'https://www.ramco.com/careers/')
  assert.equal(JOBS_URL, 'https://www.ramco.com/careers/jobs-by-locations')
  assert.equal(hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(extractJobsPageUrl(careersPageHtml), JOBS_URL)
  assert.equal(hasOfficialJobsSignal(jobsPageHtml), true)

  const jobData = extractEmbeddedJobData(jobsPageHtml)

  assert.equal(jobData.length, 3)
  assert.equal(jobData[0].page_path, 'software-engineer')
  assert.equal(jobData[0].job_title, 'Software Engineer')
  assert.equal(jobData[0].qualificationRequirement, 'BE / B.Tech')
  assert.equal(jobData[0].qualificationBucket, 'Experienced')
})

test('extractIndiaListings keeps only active India jobs from the official Ramco jobs page', () => {
  const jobs = extractIndiaListings(jobsPageHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer',
      company: 'Ramco Systems Ltd.',
      department: 'Aviation',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'software-engineer',
      requisitionId: 'SE-001',
      sourceUrl: 'https://www.ramco.com/careers/jobs-by-locations/software-engineer',
      applyUrl: 'https://www.ramco.com/careers/jobs-by-locations/software-engineer',
      employmentType: null,
      experienceRequired: '2 to 5 Years of Experience',
      minimumQualification: 'BE / B.Tech',
      preferredQualification: null,
      requiredSkills: ['JavaScript', 'Node.js'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build product features. Own delivery JavaScript, Node.js',
      remoteStatus: 'On-site',
    },
  ])
})

test('run uses the official Ramco careers handoff plus same-domain embedded jobs page', async () => {
  const requestedUrls = []

  const jobs = await createRamcoSystemsLtdScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersPageHtml
      if (url === JOBS_URL) return jobsPageHtml
      throw new Error(`Unexpected Ramco URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ramcosystemsltd')
  assert.equal(jobs[0].link, 'https://www.ramco.com/careers/jobs-by-locations/software-engineer')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
