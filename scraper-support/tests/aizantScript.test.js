import assert from 'node:assert/strict'
import test from 'node:test'

const loadAizantModule = async () => {
  try {
    return await import('../../scraper/aizant/script.js')
  } catch {
    return null
  }
}

const buildCareersHtml = ({ updatedAt = '2025-03-20T05:41:00+00:00' } = {}) => `
<!doctype html>
<html>
  <head>
    <meta property="article:modified_time" content="${updatedAt}" />
  </head>
  <body>
    <div class="panel-group fusion-toggle-icon-boxed" id="accordion-4030-1">
      <div class="fusion-panel panel-default panel-350ce48a83522e4f9 fusion-toggle-boxed-mode">
        <div class="panel-heading">
          <h5 class="panel-title toggle" id="toggle_350ce48a83522e4f9">
            <a href="#350ce48a83522e4f9">
              <span class="fusion-toggle-heading">Assistant Manager/Dy Manager - Business Development for CMO</span>
            </a>
          </h5>
        </div>
        <div id="350ce48a83522e4f9" class="panel-collapse collapse">
          <div class="panel-body toggle-content fusion-clearfix">
            <strong>Location:</strong> Hyderabad<br />
            <strong>Experience:</strong> 5-7 years
            <p><strong>About the Role:</strong> We’re looking for a dynamic professional passionate about building client relationships and driving business growth.</p>
            <p><strong>Key Responsibilities:</strong></p>
            <ul>
              <li>Build and nurture client relationships.</li>
              <li>Develop and implement business growth strategies.</li>
            </ul>
            <p><a class="job-apply" href="#">Apply Now</a></p>
          </div>
        </div>
      </div>
      <div class="fusion-panel panel-default panel-0a5c88b6a82dec0b3 fusion-toggle-boxed-mode">
        <div class="panel-heading">
          <h5 class="panel-title toggle" id="toggle_0a5c88b6a82dec0b3">
            <a href="#0a5c88b6a82dec0b3">
              <span class="fusion-toggle-heading">Executive / Senior Executive – Project Management (Clinical - BA/BE)</span>
            </a>
          </h5>
        </div>
        <div id="0a5c88b6a82dec0b3" class="panel-collapse collapse">
          <div class="panel-body toggle-content fusion-clearfix">
            <strong>Location:</strong> Hyderabad<br />
            <strong>Experience:</strong> 2-4 years
            <p><strong>Qualifications:</strong> Bachelor's/Master's in Pharmacy, Life Sciences, or related fields</p>
            <p><strong>About the Role:</strong> Join our team to manage and oversee clinical projects.</p>
            <p><a class="job-apply" href="#">Apply Now</a></p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps the Aizant open-jobs accordion into shared scraper fields', async () => {
  const aizant = await loadAizantModule()
  assert.ok(aizant)

  const jobs = aizant.extractSearchResults(buildCareersHtml())

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Manager/Dy Manager - Business Development for CMO',
    company: 'Aizant Drug Research Solutions Pvt. Ltd.',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: '350ce48a83522e4f9',
    requisitionId: '350ce48a83522e4f9',
    sourceUrl: 'https://www.aizant.com/careers/we-are-hiring/#350ce48a83522e4f9',
    applyUrl: 'https://www.aizant.com/careers/we-are-hiring/#350ce48a83522e4f9',
    employmentType: null,
    experienceRequired: '5-7 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-03-20T05:41:00.000Z',
    closingDate: null,
    jobDescription: 'About the Role: We’re looking for a dynamic professional passionate about building client relationships and driving business growth. Key Responsibilities: Build and nurture client relationships. Develop and implement business growth strategies.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, '0a5c88b6a82dec0b3')
  assert.equal(jobs[1].experienceRequired, '2-4 years')
  assert.match(jobs[1].jobDescription, /Bachelor's\/Master's in Pharmacy/i)
})

test('run fetches the Aizant careers page and decorates jobs', async () => {
  const aizant = await loadAizantModule()
  assert.ok(aizant)

  const requestedUrls = []
  const scraper = aizant.createAizantScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aizant.CAREER_PAGE_URL) return buildCareersHtml()
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(aizant.buildSearchUrl(), aizant.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [aizant.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aizant')
  assert.equal(jobs[0].link, 'https://www.aizant.com/careers/we-are-hiring/#350ce48a83522e4f9')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
