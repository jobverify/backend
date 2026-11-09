import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const currentOpeningsHtml = readFileSync(
  new URL('./fixtures/uptiqai/current-openings.html', import.meta.url),
  'utf8',
)

const loadUptiqAiModule = async () => {
  try {
    return await import('../../scraper/uptiqai/script.js')
  } catch {
    assert.fail('Expected Uptiq.ai scraper module at ../../scraper/uptiqai/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Uptiq | Join AI in Financial Services</title>
  </head>
  <body>
    <main>
      <h1>Careers at Uptiq</h1>
      <h2>Build the Future of AI in Financial Services</h2>
      <p>We're hiring across multiple functions in USA & India.</p>
      <h2>Open Roles - USA & India</h2>
      <ul>
        <li>AI/ML Engineers</li>
        <li>Full Stack Developers</li>
        <li>Backend Engineers</li>
      </ul>
      <section>
        <h3>To Apply</h3>
        <p>Send your resume and portfolio (if applicable) to:</p>
        <a href="mailto:careers@uptiq.ai">careers@uptiq.ai</a>
      </section>
    </main>
  </body>
</html>
`

test('Uptiq.ai validates the verified apply-by-email careers surface before returning no listings', async () => {
  const uptiq = await loadUptiqAiModule()

  assert.equal(uptiq.CAREERS_URL, 'https://www.uptiq.ai/careers')
  assert.equal(uptiq.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(uptiq.hasPublicJobBoardSignal(careersHtml), false)
  assert.deepEqual(uptiq.extractSearchResults(careersHtml), [])
})

test('Uptiq.ai returns an empty set when the official careers page only exposes a resume handoff', async () => {
  const uptiq = await loadUptiqAiModule()
  const requestedUrls = []

  const jobs = await uptiq.createUptiqAiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === uptiq.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Uptiq.ai fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [uptiq.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Uptiq.ai extracts the current role cards when the verified CTA says View Role/Apply', async () => {
  const uptiq = await loadUptiqAiModule()
  const liveRoleLabelHtml = currentOpeningsHtml.replaceAll('View job/Apply', 'View Role/Apply')

  assert.notEqual(liveRoleLabelHtml, currentOpeningsHtml)
  const jobs = uptiq.extractSearchResults(liveRoleLabelHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(({ title, country }) => [title, country]), [
    ['Site Reliability Engineer', 'India'],
    ['Technical Support Engineer', 'India'],
    ['SBA Loan Specialist — Senior Financial Analyst', 'India'],
  ])
})
