import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Page</title>
  </head>
  <body>
    <h1>Pristyn Care Careers</h1>
    <p>Be a part of something great</p>
    <div class="feturedJobsContainer">
      <h1>Featured <span>Positions</span></h1>
      <div class="featuredPositionsJobsContainer"></div>
    </div>
    <div class="viewMoreButton">
      <a href="https://pristyncare.skillate.com/" target="_blank">
        <button class="viewMoreBtn">VIEW ALL JOBS</button>
      </a>
    </div>
  </body>
</html>
`

const inlineFeaturedJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Page</title>
  </head>
  <body>
    <h1>Pristyn Care Careers</h1>
    <div class="feturedJobsContainer">
      <h1>Featured <span>Positions</span></h1>
      <div class="featuredPositionsJobsContainer">
        <article>
          <h2>Talent Acquisition Associate</h2>
          <a href="https://pristyncare.skillate.com/jobs/talent-acquisition-associate">View Job</a>
        </article>
      </div>
    </div>
    <div class="viewMoreButton">
      <a href="https://pristyncare.skillate.com/" target="_blank">
        <button class="viewMoreBtn">VIEW ALL JOBS</button>
      </a>
    </div>
  </body>
</html>
`

const reachableSkillateHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job openings at Pristyn Care</title>
  </head>
  <body>
    <main>
      <h1>Job openings at Pristyn Care</h1>
      <div>Department</div>
      <div>Location</div>
      <article>
        <h2>Operations Manager</h2>
        <a href="/jobs/operations-manager">View Job</a>
      </article>
      <footer>powered-by-skillate</footer>
    </main>
  </body>
</html>
`

const loadPristynCareModule = async () => {
  try {
    return await import('../../scraper/pristyncare/script.js')
  } catch {
    assert.fail('Expected Pristyn Care scraper module at ../../scraper/pristyncare/script.js')
  }
}

test('Pristyn Care sentinel pins the verified official careers shell and unreachable Skillate handoff', async () => {
  const pristynCare = await loadPristynCareModule()

  assert.equal(pristynCare.SOURCE, 'pristyncare')
  assert.equal(pristynCare.COMPANY, 'Pristyn Care')
  assert.equal(pristynCare.VERIFIED_AT, '2026-07-17')
  assert.equal(pristynCare.CAREERS_URL, 'https://www.pristyncare.com/company/careers/')
  assert.equal(pristynCare.SKILLATE_HANDOFF_URL, 'https://pristyncare.skillate.com/')
  assert.equal(
    pristynCare.extractSkillateHandoffUrl(officialCareersPageHtml),
    'https://pristyncare.skillate.com/',
  )
  assert.equal(pristynCare.hasOfficialPristynCareersSignal(officialCareersPageHtml), true)
  assert.equal(pristynCare.hasInlineFeaturedJobs(officialCareersPageHtml), false)
  assert.equal(pristynCare.hasInlineFeaturedJobs(inlineFeaturedJobsHtml), true)
  assert.equal(
    pristynCare.isUnreachableSkillateHandoff({
      error: 'curl: (28) Failed to connect to pristyncare.skillate.com port 443 after 21181 ms: Could not connect to server',
    }),
    true,
  )
  assert.equal(
    pristynCare.isUnreachableSkillateHandoff({
      status: 200,
      url: 'https://pristyncare.skillate.com/',
      html: reachableSkillateHtml,
    }),
    false,
  )
})

test('Pristyn Care sentinel returns [] only while the official careers shell stays empty and the Skillate handoff remains unreachable', async () => {
  const pristynCare = await loadPristynCareModule()
  const requestedUrls = []

  const jobs = await pristynCare.createPristynCareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pristynCare.CAREERS_URL) {
        return { status: 200, url, html: officialCareersPageHtml }
      }

      if (url === pristynCare.SKILLATE_HANDOFF_URL) {
        return {
          error: 'TypeError: fetch failed: could not connect to server',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pristynCare.CAREERS_URL,
    pristynCare.SKILLATE_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Pristyn Care sentinel fails closed when the careers shell changes or the Skillate handoff becomes reachable', async () => {
  const pristynCare = await loadPristynCareModule()

  await assert.rejects(
    pristynCare.createPristynCareScraper().run({
      fetchPage: async (url) => {
        if (url === pristynCare.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers page changed materially/i,
  )

  await assert.rejects(
    pristynCare.createPristynCareScraper().run({
      fetchPage: async (url) => {
        if (url === pristynCare.CAREERS_URL) {
          return { status: 200, url, html: inlineFeaturedJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers page changed materially or now exposes inline featured jobs/i,
  )

  await assert.rejects(
    pristynCare.createPristynCareScraper().run({
      fetchPage: async (url) => {
        if (url === pristynCare.CAREERS_URL) {
          return { status: 200, url, html: officialCareersPageHtml }
        }

        return {
          status: 200,
          url,
          html: reachableSkillateHtml,
        }
      },
    }),
    /skillate handoff changed materially or now exposes a reachable public jobs surface/i,
  )
})
