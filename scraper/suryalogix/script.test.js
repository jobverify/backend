import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SuryaLogix scraper module at ./script.js')
  }
}

const readFixture = (name) =>
  fs.readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

test('SuryaLogix pins the verified first-party homepage and resume-submission careers surface', async () => {
  const suryalogix = await loadModule()

  assert.equal(suryalogix.SOURCE, 'suryalogix')
  assert.equal(suryalogix.COMPANY, 'SuryaLogix')
  assert.equal(suryalogix.HOMEPAGE_URL, 'https://suryalogix.com/')
  assert.equal(suryalogix.CAREERS_URL, 'https://suryalogix.com/career-opportunities/')
  assert.equal(suryalogix.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(suryalogix.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(suryalogix.hasApplicationFormSurface(careersHtml), true)
  assert.equal(suryalogix.hasUnexpectedPublicJobsSignal(careersHtml), false)
  assert.equal(
    suryalogix.hasUnexpectedPublicJobsSignal(
      careersHtml.replace('</body>', '<script>const route = "/jobs/preview"</script></body>'),
    ),
    false,
  )
  assert.equal(
    suryalogix.hasUnexpectedPublicJobsSignal(
      `${careersHtml}<section><h2>Current Openings</h2><a href="/jobs/firmware-engineer">View Details</a></section>`,
    ),
    true,
  )
})

test('SuryaLogix rejects a generic application form without a complete job inventory', async () => {
  const suryalogix = await loadModule()
  await assert.rejects(suryalogix.run({
    fetchPage: async url => ({ status: 200, url, html: url === suryalogix.HOMEPAGE_URL ? homepageHtml : careersHtml }),
  }), /complete job inventory/i)
})

test('SuryaLogix extracts current inline first-party openings instead of treating them as an empty sentinel', async () => {
  const suryalogix = await loadModule()
  const currentOpening = `
    <section class="elementor-section elementor-inner-section">
      <h2 class="elementor-heading-title">Embedded Hardware Engineer</h2>
      <span class="elementor-icon-list-text">Pune, Maharashtra <i></i> Experience: 2–4 Years</span>
      <span class="elementor-icon-list-text"><b>Expertise</b> - Embedded Hardware Design, Microcontrollers, Circuit Debugging</span>
      <span class="elementor-icon-list-text">Openings: 1</span>
      <a href="#form">Apply Now</a>
    </section>
  `
  const jobs = suryalogix.extractPublicOpenings(currentOpening)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Embedded Hardware Engineer')
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Embedded Hardware Design',
    'Microcontrollers',
    'Circuit Debugging',
  ])
})

test('SuryaLogix fails closed when the homepage, careers copy, or non-listing contract drifts', async () => {
  const suryalogix = await loadModule()

  await assert.rejects(
    suryalogix.createSuryaLogixScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === suryalogix.HOMEPAGE_URL
          ? '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'
          : careersHtml,
      }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    suryalogix.createSuryaLogixScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === suryalogix.HOMEPAGE_URL
          ? homepageHtml
          : careersHtml.replace('Application Form', 'Talent Community'),
      }),
    }),
    /official careers page|application form/i,
  )

  await assert.rejects(
    suryalogix.createSuryaLogixScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === suryalogix.HOMEPAGE_URL
          ? homepageHtml
          : `${careersHtml}<section><h2>Open Positions</h2><a href="https://jobs.lever.co/suryalogix">Apply</a></section>`,
      }),
    }),
    /public jobs|non-listing|handoff|incomplete/i,
  )
})
