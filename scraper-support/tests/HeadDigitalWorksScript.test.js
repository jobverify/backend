import assert from 'node:assert/strict'
import test from 'node:test'

const loadHeadDigitalWorksModule = async () => {
  try {
    return await import('../../scraper/headdigitalworks/script.js')
  } catch {
    assert.fail('Expected Head Digital Works scraper module at ../../scraper/headdigitalworks/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join our Team - Head Digital Works</title>
    <meta
      name="description"
      content="Join The Team Explore Opportunities Can’t find your perfect fit? Follow Head Digital Works on Linkedin to track..."
    />
  </head>
  <body>
    <main>
      <h1>Life at HDW</h1>
      <h2>Explore Opportunites</h2>
      <h3>Can't find your perfect fit?</h3>
      <p>Follow Head Digital Works on Linkedin to track any new opportunities, as they come.</p>
    </main>
  </body>
</html>
`

const missingLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not found - 404 error</title>
  </head>
  <body>
    <h2>Sorry, we couldn't find anything here</h2>
    <p>The job posting you're looking for might have closed, or it has been removed. (404 error).</p>
  </body>
</html>
`

const emptyLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>No job postings currently open. Check back later!</h2>
  </body>
</html>
`

const publicLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="https://jobs.lever.co/hdworks/senior-platform-engineer">Senior Platform Engineer</a>
    <a href="https://jobs.lever.co/hdworks/data-scientist">Data Scientist</a>
  </body>
</html>
`

test('Head Digital Works sentinel pins the verified first-party careers shell and missing Lever handoff', async () => {
  const headDigitalWorks = await loadHeadDigitalWorksModule()

  assert.equal(headDigitalWorks.SOURCE, 'headdigitalworks')
  assert.equal(headDigitalWorks.COMPANY, 'Head Digital Works')
  assert.equal(headDigitalWorks.OFFICIAL_BRAND_NAME, 'Head Digital Works')
  assert.equal(headDigitalWorks.CAREERS_URL, 'https://hdworks.in/join-our-team/')
  assert.equal(headDigitalWorks.LEVER_BOARD_URL, 'https://jobs.lever.co/hdworks')
  assert.equal(
    headDigitalWorks.LEVER_POSTINGS_API_URL,
    'https://api.lever.co/v0/postings/hdworks?mode=json',
  )
  assert.equal(headDigitalWorks.VERIFIED_ON, '2026-07-16')
  assert.equal(headDigitalWorks.hasVerifiedCareersSignal(officialCareersHtml), true)
  assert.equal(headDigitalWorks.hasMissingLeverBoardSignal(missingLeverBoardHtml), true)
  assert.equal(headDigitalWorks.hasMissingLeverBoardSignal(emptyLeverBoardHtml), true)
  assert.equal(headDigitalWorks.hasMissingLeverBoardSignal(publicLeverBoardHtml), false)
})

test('Head Digital Works returns [] only while the verified stale careers shell still points at a missing public jobs handoff', async () => {
  const headDigitalWorks = await loadHeadDigitalWorksModule()
  const requested = []

  const jobs = await headDigitalWorks.createHeadDigitalWorksScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === headDigitalWorks.CAREERS_URL) return officialCareersHtml
      if (url === headDigitalWorks.LEVER_BOARD_URL) return missingLeverBoardHtml
      throw new Error(`Unexpected Head Digital Works text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      throw new Error(`HTTP 404 for ${url}`)
    },
  })

  assert.deepEqual(requested, [
    { type: 'text', url: headDigitalWorks.CAREERS_URL },
    { type: 'text', url: headDigitalWorks.LEVER_BOARD_URL },
    {
      type: 'json',
      url: 'https://api.lever.co/v0/postings/hdworks?mode=json',
      options: { method: 'GET' },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Head Digital Works fails closed when the official page or external handoff starts exposing public jobs again', async () => {
  const headDigitalWorks = await loadHeadDigitalWorksModule()

  await assert.rejects(
    headDigitalWorks.createHeadDigitalWorksScraper().run({
      fetchText: async (url) => {
        if (url === headDigitalWorks.CAREERS_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }

        throw new Error(`Unexpected Head Digital Works text fixture URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /careers page no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    headDigitalWorks.createHeadDigitalWorksScraper().run({
      fetchText: async (url) => {
        if (url === headDigitalWorks.CAREERS_URL) return officialCareersHtml
        if (url === headDigitalWorks.LEVER_BOARD_URL) return publicLeverBoardHtml
        throw new Error(`Unexpected Head Digital Works text fixture URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /lever board no longer matches the verified missing-or-empty state/i,
  )

  await assert.rejects(
    headDigitalWorks.createHeadDigitalWorksScraper().run({
      fetchText: async (url) => {
        if (url === headDigitalWorks.CAREERS_URL) return officialCareersHtml
        if (url === headDigitalWorks.LEVER_BOARD_URL) return missingLeverBoardHtml
        throw new Error(`Unexpected Head Digital Works text fixture URL: ${url}`)
      },
      fetchJson: async () => [{ id: 'live-role', text: 'Senior Platform Engineer' }],
    }),
    /lever postings api no longer matches the verified missing-board state/i,
  )
})
