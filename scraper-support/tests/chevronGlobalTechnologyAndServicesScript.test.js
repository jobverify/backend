import assert from 'node:assert/strict'
import test from 'node:test'

const searchResultsHtml = `
  <section id="search-results" data-total-job-results="38" data-total-pages="3" data-current-page="1">
    <section id="search-results-list">
      <ul>
        <li>
          <a href="/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200" data-job-id="96543107200">
            <h2>Lead Data Analyst - Profiling &amp; Cleansing</h2>
            <span class="job-location">Bengaluru, India</span>
          </a>
        </li>
        <li>
          <a href="/job/bengaluru/automation-systems-engineer/38138/95882556896" data-job-id="95882556896">
            <h2>Automation Systems Engineer</h2>
            <span class="job-location">Bengaluru, India</span>
          </a>
        </li>
        <li>
          <a href="/job/houston/senior-advisor-tax-accounting/38138/94781599280" data-job-id="94781599280">
            <h2>Senior Advisor - Tax Accounting</h2>
            <span class="job-location">Houston, Texas</span>
          </a>
        </li>
      </ul>
      <nav class="pagination">
        <a class="next" href="/search-jobs&amp;p=2" rel="nofollow">next page</a>
      </nav>
    </section>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <meta name="search-job-apply-url" content="https://chevron.wd5.myworkdayjobs.com/jobs/job/Bengaluru-Karnataka-India/Lead-Data-Analyst---Profiling---Cleansing_R000071936">
      <meta name="job-ats-req-id" content="R000071936">
      <script type="application/ld+json">{
        "@context":"http://schema.org",
        "@type":"JobPosting",
        "datePosted":"2026-7-6",
        "description":"<p>The Chevron Engineering and Innovation Excellence Center (ENGINE) in Bengaluru India supports global operations.</p><p><b>Responsibilities</b></p><ul><li><p>Lead the data cleansing workstream.</p></li></ul><p><b>Required Skill</b></p><ul><li><p>Senior Project Management - milestones driven</p></li><li><p>Experience in JDE or SAP data models.</p></li></ul><p><b>Preferred Skill</b></p><ul><li><p>Specific knowledge of JDE and S/4 preferred</p></li></ul><h2><b>Education</b></h2><ul><li><p>Bachelor's degree in Computer Science or equivalent experience</p></li></ul><p>ENGINE refers to the Chevron Engineering and Innovation Excellence Center, which operates under Chevron Global Technology and Services Private Limited.</p><p>Looking for 12-18 years of experience in SAP Project Management</p>",
        "employmentType":"Regular",
        "identifier":"R000071936",
        "title":"Lead Data Analyst - Profiling & Cleansing",
        "url":"https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200",
        "hiringOrganization":{"@type":"Organization","name":"Chevron"},
        "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bengaluru","addressRegion":"Karnataka","addressCountry":"India"}}]
      }</script>
    </head>
    <body>
      <section class="ajd_section ajd_job-details job-description" data-selector-name="jobdetails" data-org-id="38138" data-job-id="96543107200">
        <h2 class="ajd_section__heading ajd_job-details__heading heading-2">Lead Data Analyst - Profiling &amp; Cleansing</h2>
        <p class="ajd_header__location">Bengaluru, India</p>
      </section>
    </body>
  </html>
`

const loadModule = async () => import('../../scraper/chevronglobaltechnologyandservices/script.js')

test('extractSearchResults keeps Chevron Global Technology and Services India roles and drops non-India cards', async () => {
  const chevron = await loadModule()
  const jobs = chevron.extractSearchResults(searchResultsHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Lead Data Analyst - Profiling & Cleansing',
    company: 'Chevron Global Technology and Services',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '96543107200',
    requisitionId: '96543107200',
    sourceUrl: 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
    applyUrl: 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].jobId, '95882556896')
})

test('extractPaginationSummary reads Chevron India page counts and next-page URLs', async () => {
  const chevron = await loadModule()

  assert.deepEqual(chevron.extractPaginationSummary(searchResultsHtml), {
    hasNext: true,
    currentPage: 1,
    totalPages: 3,
    totalJobCount: 38,
  })
})

test('extractJobDetail reads Chevron detail JSON-LD, apply metadata, and company-specific affiliate text', async () => {
  const chevron = await loadModule()

  const detail = chevron.extractJobDetail(detailHtml, {
    title: 'Lead Data Analyst - Profiling & Cleansing',
    company: 'Chevron Global Technology and Services',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '96543107200',
    requisitionId: '96543107200',
    sourceUrl: 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
    applyUrl: 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
  })

  assert.deepEqual(detail, {
    title: 'Lead Data Analyst - Profiling & Cleansing',
    company: 'Chevron Global Technology and Services',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '96543107200',
    requisitionId: 'R000071936',
    sourceUrl: 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
    applyUrl: 'https://chevron.wd5.myworkdayjobs.com/jobs/job/Bengaluru-Karnataka-India/Lead-Data-Analyst---Profiling---Cleansing_R000071936',
    employmentType: 'Full-time',
    experienceRequired: '12-18 years',
    minimumQualification: "Bachelor's degree in Computer Science or equivalent experience",
    preferredQualification: 'Specific knowledge of JDE and S/4 preferred',
    requiredSkills: [
      'Senior Project Management - milestones driven',
      'Experience in JDE or SAP data models.',
    ],
    postingDate: '2026-07-06',
    closingDate: null,
    jobDescription: /Chevron Global Technology and Services Private Limited/i.test(detail.jobDescription) ? detail.jobDescription : null,
    remoteStatus: null,
  })
  assert.match(detail.jobDescription, /Lead the data cleansing workstream/i)
})

test('run paginates Chevron India results, enriches detail pages, and decorates shared runner fields', async () => {
  const chevron = await loadModule()
  const requests = []
  const scraper = chevron.createChevronGlobalTechnologyAndServicesScraper({ maxPages: 1, maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === chevron.buildSearchUrl()) return searchResultsHtml
      if (url === 'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200') {
        return detailHtml
      }
      throw new Error(`Unexpected Chevron URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    chevron.buildSearchUrl(),
    'https://careers.chevron.com/job/bengaluru/lead-data-analyst-profiling-and-cleansing/38138/96543107200',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'chevronglobaltechnologyandservices')
  assert.equal(jobs[0].company, 'Chevron Global Technology and Services')
  assert.equal(jobs[0].jobId, '96543107200')
  assert.equal(jobs[0].requisitionId, 'R000071936')
  assert.equal(
    jobs[0].applyUrl,
    'https://chevron.wd5.myworkdayjobs.com/jobs/job/Bengaluru-Karnataka-India/Lead-Data-Analyst---Profiling---Cleansing_R000071936',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
