import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>We are Hiring!</h1>
      <h2>Current Openings</h2>
      <p>You may submit your CV here and we will consider the same as and when suitable opportunities arise.</p>
      <p>For further queries you may contact: recruitment@tilindia.com</p>
      <a href="/careers/custom-job">Submit CV</a>
    </main>
  </body>
</html>
`

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>We are Hiring!</h1>
      <article>
        <h2>Assistant Manager - Projects</h2>
        <a href="/careers/jobs/assistant-manager-projects">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/til/script.js')
  } catch {
    assert.fail('Expected TIL scraper module at ../../scraper/til/script.js')
  }
}

test('TIL sentinel helpers stay pinned to the verified first-party resume-intake page', async () => {
  const til = await loadModule()

  assert.equal(til.SOURCE, 'til')
  assert.equal(til.COMPANY, 'TIL')
  assert.equal(til.OFFICIAL_BRAND_NAME, 'Tractors India Limited')
  assert.equal(til.CAREERS_PAGE_URL, 'https://www.tilindia.in/careers/vacancies')
  assert.equal(til.VERIFIED_ON, '2026-07-17')
  assert.equal(til.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(til.hasOfficialCareersSignal(DRIFTED_CAREERS_HTML), false)
})

test('TIL returns [] only while the verified careers page stays a resume-intake sentinel', async () => {
  const til = await loadModule()
  const requestedUrls = []

  const jobs = await til.createTilScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === til.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML

      throw new Error(`Unexpected TIL URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [til.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('TIL fails closed when the verified resume-intake page drifts into a different jobs surface', async () => {
  const til = await loadModule()

  await assert.rejects(
    til.createTilScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    til.createTilScraper().run({
      fetchText: async () => DRIFTED_CAREERS_HTML,
    }),
    /verified careers page/i,
  )
})
