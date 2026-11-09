import assert from 'node:assert/strict'
import test from 'node:test'

const loadSkanrayTechnologiesModule = async () => {
  try {
    return await import('../../scraper/skanraytechnologies/script.js')
  } catch (error) {
    assert.fail(`Expected Skanray Technologies scraper module at ../../scraper/skanraytechnologies/script.js: ${error.message}`)
  }
}

const sampleCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Skanray Technologies Careers</title>
  </head>
  <body>
    <section class="elementor-section">
      <div class="elementor-widget-container">
        <h2>Current Openings</h2>
        <ul class="elementor-icon-list-items">
          <li class="elementor-icon-list-item">
            <span class="elementor-icon-list-text">Field Service Engineer&nbsp;</span>
          </li>
          <li class="elementor-icon-list-item">
            <span class="elementor-icon-list-text">Embedded Software Engineer</span>
          </li>
          <li class="elementor-icon-list-item">
            <span class="elementor-icon-list-text">Quality Engineer</span>
          </li>
        </ul>
      </div>
    </section>
    <section class="elementor-section">
      <div class="elementor-widget-container">
        <h3>Apply for Open Roles</h3>
        <form class="elementor-form" action="/forms/">
          <label>Name</label>
          <label>Email</label>
          <label>Phone</label>
          <label>Current Location</label>
        </form>
      </div>
    </section>
  </body>
</html>
`

test('run fetches the Skanray Technologies careers form page and returns visible role titles with shared URLs', async () => {
  const skanray = await loadSkanrayTechnologiesModule()
  const requestedUrls = []

  const jobs = await skanray.createSkanrayTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return sampleCareerHtml
    },
  })

  assert.deepEqual(requestedUrls, [skanray.CAREER_PAGE_URL])
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Embedded Software Engineer',
      'Field Service Engineer',
      'Quality Engineer',
    ],
  )
  assert.deepEqual(jobs[0], {
    title: 'Embedded Software Engineer',
    company: 'Skanray Technologies',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'skanraytechnologies-embedded-software-engineer',
    requisitionId: 'skanraytechnologies-embedded-software-engineer',
    sourceUrl: 'https://skanray.com/forms/',
    applyUrl: 'https://skanray.com/forms/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply via the Skanray Technologies careers form page for the Embedded Software Engineer opening.',
    source: 'skanraytechnologies',
    link: 'https://skanray.com/forms/',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
