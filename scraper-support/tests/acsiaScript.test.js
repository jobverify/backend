import assert from 'node:assert/strict'
import test from 'node:test'

const loadAcsiaModule = async () => {
  try {
    return await import('../../scraper/acsia/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at Acsia I Jobs in Automotive Technology</title>
  </head>
  <body>
    <div class="brxe-listening brxe-block">
      <div class="accordion-title-wrapper bricks-lazy-hidden">
        <div class="brxe-dcvxep brxe-block bricks-lazy-hidden">
          <div class="brxe-tnyabu brxe-text-basic">IT Support Role</div>
        </div>
      </div>
      <div class="brxe-jityhy brxe-block accordion-content-wrapper bricks-lazy-hidden">
        <div class="brxe-xbcvzw brxe-text">
          <p class="wp-block-paragraph">No. of Open positions – 1</p>
          <p class="wp-block-paragraph">Location – Trivandrum</p>
          <p class="wp-block-paragraph">Exp band – 2 to 4 years</p>
          <p class="wp-block-paragraph"><strong>Required Skills &amp; Experience:</strong></p>
          <ul class="wp-block-list">
            <li>2 to 4 years of proven experience in an IT support role delivering L1 and L2 technical assistance.</li>
            <li>Hands-on experience with IT ticketing and ITSM platforms.</li>
          </ul>
        </div>
        <a class="brxe-pocddm brxe-button bricks-button bricks-background-primary" href="/careers/#apply-form">Apply</a>
      </div>
    </div>
    <div class="brxe-listening brxe-block">
      <div class="accordion-title-wrapper bricks-lazy-hidden">
        <div class="brxe-dcvxep brxe-block bricks-lazy-hidden">
          <div class="brxe-tnyabu brxe-text-basic">AUTOSAR Architect</div>
        </div>
      </div>
      <div class="brxe-jityhy brxe-block accordion-content-wrapper bricks-lazy-hidden">
        <div class="brxe-xbcvzw brxe-text">
          <p class="wp-block-paragraph">No. of Open positions – 1</p>
          <p class="wp-block-paragraph">Location – Trivandrum</p>
          <p class="wp-block-paragraph">Exp band – 8 to 12 years</p>
          <p class="wp-block-paragraph">Notice Period : 30- 45 days</p>
          <p class="wp-block-paragraph"><strong>Required Skills and Experience:</strong></p>
          <ul class="wp-block-list">
            <li>8 to 12 years of experience in automotive embedded software development.</li>
            <li>Deep expertise in Classical AUTOSAR architecture.</li>
          </ul>
        </div>
        <a class="brxe-pocddm brxe-button bricks-button bricks-background-primary" href="/careers/#apply-form">Apply</a>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps visible Acsia accordion openings into shared scraper fields', async () => {
  const acsia = await loadAcsiaModule()
  assert.ok(acsia)

  const jobs = acsia.extractSearchResults(careerPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'IT Support Role',
    company: 'Acsia Technologies',
    department: null,
    location: 'Trivandrum, India',
    city: 'Trivandrum',
    country: 'India',
    jobId: 'it-support-role',
    requisitionId: 'it-support-role',
    sourceUrl: 'https://www.acsiatech.com/careers/#apply-form',
    applyUrl: 'https://www.acsiatech.com/careers/#apply-form',
    employmentType: null,
    experienceRequired: '2 to 4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      '2 to 4 years of proven experience in an IT support role delivering L1 and L2 technical assistance.',
      'Hands-on experience with IT ticketing and ITSM platforms.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'No. of Open positions - 1 Location - Trivandrum Exp band - 2 to 4 years Required Skills & Experience: 2 to 4 years of proven experience in an IT support role delivering L1 and L2 technical assistance. Hands-on experience with IT ticketing and ITSM platforms.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'AUTOSAR Architect')
  assert.equal(jobs[1].jobId, 'autosar-architect')
  assert.equal(jobs[1].experienceRequired, '8 to 12 years')
  assert.equal(jobs[1].location, 'Trivandrum, India')
  assert.match(jobs[1].jobDescription, /Notice Period : 30- 45 days/i)
})

test('run fetches the Acsia careers page and decorates current openings', async () => {
  const acsia = await loadAcsiaModule()
  assert.ok(acsia)

  const requestedTexts = []
  const scraper = acsia.createAcsiaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === acsia.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [acsia.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'acsia')
  assert.equal(jobs[0].link, 'https://www.acsiatech.com/careers/#apply-form')
  assert.equal(jobs[0].company, 'Acsia Technologies')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run can recover with a browser-backed Acsia careers page when direct requests are blocked', async () => {
  const acsia = await loadAcsiaModule()
  assert.ok(acsia)

  const browserUrls = []
  const jobs = await acsia.createAcsiaScraper().run({
    fetchText: async () => {
      throw new Error(`HTTP 403 for ${acsia.CAREER_PAGE_URL}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careerPageHtml
    },
  })

  assert.deepEqual(browserUrls, [acsia.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'acsia')
})
