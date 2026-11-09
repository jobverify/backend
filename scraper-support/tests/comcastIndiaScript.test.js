import assert from 'node:assert/strict'
import test from 'node:test'

const searchResultsHtml = `
  <section id="search-results" data-total-job-results="28" data-total-pages="2" data-current-page="1">
    <section id="search-results-list">
      <ul>
        <li>
          <a href="/job/chennai/devops-engineer-2/45483/97743830032" data-job-id="97743830032">
            <h2>DevOps Engineer 2</h2>
            <span class="job-location">Chennai, Tamil Nadu, India</span>
          </a>
        </li>
        <li>
          <a href="/job/chennai/software-engineer-3/45483/97743830033" data-job-id="97743830033">
            <h2>Software Engineer 3</h2>
            <span class="job-location">Chennai, Tamil Nadu, India</span>
          </a>
        </li>
        <li>
          <a href="/job/philadelphia/platform-engineer/45483/97743839999" data-job-id="97743839999">
            <h2>Platform Engineer</h2>
            <span class="job-location">Philadelphia, Pennsylvania</span>
          </a>
        </li>
      </ul>
      <nav class="pagination">
        <a class="next" href="/search-jobs?p=2" rel="nofollow">next page</a>
      </nav>
    </section>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <meta name="search-job-apply-url" content="https://comcast.wd5.myworkdayjobs.com/Comcast_Careers/job/Chennai-Tamil-Nadu-India/DevOps-Engineer-2_R440544/apply">
      <meta name="job-ats-req-id" content="R440544">
      <script type="application/ld+json">{
        "@context":"http://schema.org",
        "@type":"JobPosting",
        "datePosted":"2026-07-14",
        "description":"<p>Build and maintain deployment automation for Comcast India engineering teams.</p><p><b>Required Skill</b></p><ul><li><p>Kubernetes</p></li><li><p>Terraform</p></li></ul><p><b>Preferred Skill</b></p><ul><li><p>AWS</p></li></ul><h2><b>Education</b></h2><ul><li><p>Bachelor's degree in Engineering</p></li></ul><p>Experience required: 5-8 years</p>",
        "employmentType":"Regular",
        "identifier":"R440544",
        "title":"DevOps Engineer 2",
        "url":"https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032",
        "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Chennai","addressRegion":"Tamil Nadu","addressCountry":"India"}}]
      }</script>
    </head>
    <body>
      <section class="ajd_section ajd_job-details job-description" data-selector-name="jobdetails" data-org-id="45483" data-job-id="97743830032">
        <h2 class="ajd_section__heading ajd_job-details__heading heading-2">DevOps Engineer 2</h2>
        <p class="ajd_header__location">Chennai, Tamil Nadu, India</p>
      </section>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/comcastindia/script.js')
  } catch {
    assert.fail('Expected Comcast India scraper module at ../../scraper/comcastindia/script.js')
  }
}

test('Comcast India exports stable TalentBrew search URLs and metadata', async () => {
  const comcast = await loadModule()

  assert.equal(comcast.COMPANY_NAME, 'Comcast India')
  assert.equal(comcast.SOURCE, 'comcastindia')
  assert.equal(comcast.ATS_PLATFORM, 'talentbrew-radancy')
  assert.equal(
    comcast.CAREER_PAGE_URL,
    'https://jobs.comcast.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(comcast.buildSearchUrl(), comcast.CAREER_PAGE_URL)
  assert.equal(
    comcast.buildSearchUrl({ page: 2 }),
    'https://jobs.comcast.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})

test('extractSearchResults keeps Comcast India roles and ignores non-India cards', async () => {
  const comcast = await loadModule()
  const jobs = comcast.extractSearchResults(searchResultsHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'DevOps Engineer 2',
    company: 'Comcast India',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97743830032',
    requisitionId: '97743830032',
    sourceUrl: 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
    applyUrl: 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('extractJobDetail reads Comcast India detail metadata and workday apply links', async () => {
  const comcast = await loadModule()

  const detail = comcast.extractJobDetail(detailHtml, {
    title: 'DevOps Engineer 2',
    company: 'Comcast India',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97743830032',
    requisitionId: '97743830032',
    sourceUrl: 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
    applyUrl: 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
  })

  assert.deepEqual(detail, {
    title: 'DevOps Engineer 2',
    company: 'Comcast India',
    department: null,
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '97743830032',
    requisitionId: 'R440544',
    sourceUrl: 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
    applyUrl: 'https://comcast.wd5.myworkdayjobs.com/Comcast_Careers/job/Chennai-Tamil-Nadu-India/DevOps-Engineer-2_R440544/apply',
    employmentType: 'Full-time',
    experienceRequired: '5-8 years',
    minimumQualification: "Bachelor's degree in Engineering",
    preferredQualification: 'AWS',
    requiredSkills: [
      'Kubernetes',
      'Terraform',
    ],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription: 'Build and maintain deployment automation for Comcast India engineering teams. Required Skill Kubernetes Terraform Preferred Skill AWS Education Bachelor\'s degree in Engineering Experience required: 5-8 years',
    remoteStatus: null,
  })
})

test('run paginates Comcast India search results, enriches detail pages, and decorates shared runner fields', async () => {
  const comcast = await loadModule()
  const requests = []

  const jobs = await comcast.createComcastIndiaScraper({ maxPages: 1, maxJobs: 1 }).run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === comcast.buildSearchUrl()) return searchResultsHtml
      if (url === 'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032') {
        return detailHtml
      }
      throw new Error(`Unexpected Comcast URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    comcast.buildSearchUrl(),
    'https://jobs.comcast.com/job/chennai/devops-engineer-2/45483/97743830032',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'comcastindia')
  assert.equal(jobs[0].jobId, '97743830032')
  assert.equal(
    jobs[0].applyUrl,
    'https://comcast.wd5.myworkdayjobs.com/Comcast_Careers/job/Chennai-Tamil-Nadu-India/DevOps-Engineer-2_R440544/apply',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
