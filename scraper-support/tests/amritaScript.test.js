import assert from 'node:assert/strict'
import test from 'node:test'

const loadAmritaModule = async () => {
  try {
    return await import('../../scraper/amrita/script.js')
  } catch {
    return null
  }
}

const buildCareersHtml = ({ updatedAt = '2025-07-03T15:16:55+05:30' } = {}) => `
<!doctype html>
<html>
  <head>
    <meta property="og:updated_time" content="${updatedAt}" />
  </head>
  <body>
    <div class="career-list">
      <div class="jobs-list">
        <ul>
          <li>
            <div class="position"><a href="https://www.amrita.edu/job/lab-assistant-amritapuri/">Lab Assistant @Amritapuri</a></div>
            <div class="place"><span></span>Amritapuri</div>
            <div class="aply-bnt">
              <a href="https://www.amrita.edu/job/lab-assistant-amritapuri/" class="btn btn-bordered">View Details</a>
              <a href="https://careers.amrita.edu/client/job-search?jid=abc123" class="btn btn-bordered">Apply now</a>
              <div class="app-date">Closing date : <span>Jun 30, 2026</span></div>
            </div>
          </li>
          <li>
            <div class="position"><a href="https://www.amrita.edu/job/faculty-associate-amrita-online-commerce-program-mysuru-campus/">Faculty Associate, Amrita Online - Commerce Program @ Mysuru Campus</a></div>
            <div class="place"><span>AHEAD - Online</span>Mysuru</div>
            <div class="aply-bnt">
              <a href="https://www.amrita.edu/job/faculty-associate-amrita-online-commerce-program-mysuru-campus/" class="btn btn-bordered">View Details</a>
              <a href="https://careers.amrita.edu/client/job-search?jid=xyz789" class="btn btn-bordered">Apply now</a>
              <div class="app-date">Closing date : <span>Jul 15, 2026</span></div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps the Amrita jobs list into shared scraper fields', async () => {
  const amrita = await loadAmritaModule()
  assert.ok(amrita)

  const jobs = amrita.extractSearchResults(buildCareersHtml())

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Lab Assistant @Amritapuri',
    company: 'Amrita Vishwa Vidyapeetham',
    department: null,
    location: 'Amritapuri, India',
    city: 'Amritapuri',
    country: 'India',
    jobId: 'lab-assistant-amritapuri',
    requisitionId: 'abc123',
    sourceUrl: 'https://www.amrita.edu/job/lab-assistant-amritapuri/',
    applyUrl: 'https://careers.amrita.edu/client/job-search?jid=abc123',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-07-03T09:46:55.000Z',
    closingDate: '2026-06-30T00:00:00.000Z',
    jobDescription: 'Campus: Amritapuri',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, 'faculty-associate-amrita-online-commerce-program-mysuru-campus')
  assert.equal(jobs[1].department, 'AHEAD - Online')
  assert.equal(jobs[1].city, 'Mysuru')
  assert.equal(jobs[1].closingDate, '2026-07-15T00:00:00.000Z')
})

test('run fetches the Amrita jobs page and decorates jobs', async () => {
  const amrita = await loadAmritaModule()
  assert.ok(amrita)

  const requestedUrls = []
  const scraper = amrita.createAmritaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === amrita.CAREER_PAGE_URL) return buildCareersHtml()
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(amrita.buildSearchUrl(), amrita.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [amrita.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'amrita')
  assert.equal(jobs[0].link, 'https://careers.amrita.edu/client/job-search?jid=abc123')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
