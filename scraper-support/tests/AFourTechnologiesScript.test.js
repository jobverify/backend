import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <h3>Unlock Your Career Potential With AFour Technologies</h3>
      <p>We are hiring</p>

      <div class="elementor-column">
        <h2 class="elementor-heading-title">Cobol Developer</h2>
        <h2 class="elementor-heading-title">4-8 Years</h2>
        <div class="elementor-widget-text-editor"><p>Cobol, db2, java, file handling, string handling, deployment</p></div>
        <a class="elementor-button" href="https://afourtech.com/cobol-developer/"><span>Apply Now</span></a>
      </div>
      <div class="elementor-column">
        <h2 class="elementor-heading-title">Senior SDET Performance</h2>
        <h2 class="elementor-heading-title">4-7 Years</h2>
        <div class="elementor-widget-text-editor"><p>Performance testing</p></div>
        <a class="elementor-button" href="https://afourtech.com/senior-sdet-performance/"><span>Apply Now</span></a>
      </div>
      <div class="elementor-column">
        <h2 class="elementor-heading-title">Lead SDET</h2>
        <h2 class="elementor-heading-title">7-10 Years</h2>
        <div class="elementor-widget-text-editor"><p>Slenium, python, java, ci/cd, api testing</p></div>
        <a class="elementor-button" href="https://afourtech.com/lead-sdet/"><span>Apply Now</span></a>
      </div>
      <div class="elementor-column">
        <h2 class="elementor-heading-title">Sr. SDE Java</h2>
        <h2 class="elementor-heading-title">4-8 Years</h2>
        <div class="elementor-widget-text-editor"><p>Java development</p></div>
        <a class="elementor-button" href="https://afourtech.com/sr-sde-java/"><span>Apply Now</span></a>
      </div>
      <div class="elementor-column">
        <h2 class="elementor-heading-title">Lead SDET Enterprise Analytics Testing</h2>
        <h2 class="elementor-heading-title">6-8 Years</h2>
        <div class="elementor-widget-text-editor"><p>etl testing, BI Testing, Python</p></div>
        <a class="elementor-button" href="https://afourtech.com/lead-sdet-enterprise-analytics-testing/"><span>Apply Now</span></a>
      </div>
      <div class="elementor-column">
        <h2 class="elementor-heading-title">Sr. Python Developer</h2>
        <h2 class="elementor-heading-title">4-8 Years</h2>
        <div class="elementor-widget-text-editor"><p>Python development</p></div>
        <a class="elementor-button" href="https://afourtech.com/sr-python-developer/"><span>Apply Now</span></a>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/afourtechnologies/script.js')
  } catch {
    assert.fail('Expected AFour Technologies scraper module at ../../scraper/afourtechnologies/script.js')
  }
}

test('AFour Technologies helpers stay pinned to the verified careers page from Saturday, July 18, 2026', async () => {
  const afour = await loadModule()

  assert.equal(afour.SOURCE, 'afourtechnologies')
  assert.equal(afour.COMPANY, 'AFour Technologies')
  assert.equal(afour.CAREERS_URL, 'https://afourtech.com/careers-3/')
  assert.equal(afour.VERIFIED_ON, '2026-08-01')
  assert.equal(afour.hasOfficialCareersSignal(careersPageHtml), true)

  const jobs = afour.extractJobs(careersPageHtml)
  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Cobol Developer',
    experience: '4-8 Years',
    description: 'Cobol, db2, java, file handling, string handling, deployment',
    location: 'India',
    sourceUrl: 'https://afourtech.com/cobol-developer/',
    applyUrl: 'https://afourtech.com/cobol-developer/',
  })
})

test('AFour Technologies returns public jobs from the verified first-party careers page', async () => {
  const afour = await loadModule()
  const requestedUrls = []

  const jobs = await afour.createAFourTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === afour.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected AFour Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [afour.CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].company, 'AFour Technologies')
  assert.equal(jobs[0].source, 'afourtechnologies')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('AFour Technologies fails closed when the verified careers page loses its public job cards', async () => {
  const afour = await loadModule()

  await assert.rejects(
    afour.createAFourTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Join us</p></body></html>',
    }),
    /verified AFour Technologies careers surface/i,
  )
})
