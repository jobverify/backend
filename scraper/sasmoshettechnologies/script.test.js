import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const joinTeamHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Join our team - SASMOS</title>
    </head>
    <body>
      <main>
        <h1>Join Our Team</h1>
        <h2>People of SASMOS</h2>
        <h2>Professionals</h2>
        <h2>Student &amp; Graduates</h2>
        <a href="https://sasmos.com/join-our-team/open-positions/">Open Positions</a>
        <a href="https://sasmos.com/join-our-team/share-your-profile/">Share your profile</a>
        <a href="mailto:careers@sasmos.com">Explore Career</a>
      </main>
    </body>
  </html>
`

const openPositionsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Open Positions - SASMOS</title>
    </head>
    <body>
      <h1>Open Positions</h1>
      <div id="page-wrap" class="container">
        <div id="content" class="sixteen columns">
        </div>
      </div>
    </body>
  </html>
`

const shareProfileHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Share your profile - SASMOS</title>
    </head>
    <body>
      <h1>Share your profile</h1>
      <div id="page-wrap" class="container">
        <div id="content" class="sixteen columns">
        </div>
      </div>
    </body>
  </html>
`

test('SASMOS HET TECHNOLOGIES scraper recognizes the verified official join-team and empty subpages', async () => {
  const sasmos = await loadModule()
  assert.ok(sasmos, 'Expected SASMOS HET TECHNOLOGIES scraper module at ./script.js')

  assert.equal(sasmos.JOIN_TEAM_URL, 'https://sasmos.com/join-our-team/')
  assert.equal(sasmos.OPEN_POSITIONS_URL, 'https://sasmos.com/join-our-team/open-positions/')
  assert.equal(sasmos.SHARE_PROFILE_URL, 'https://sasmos.com/join-our-team/share-your-profile/')
  assert.equal(sasmos.CAREERS_EMAIL, 'careers@sasmos.com')
  assert.equal(sasmos.hasOfficialJoinTeamSignal(joinTeamHtml), true)
  assert.deepEqual(
    sasmos.extractVerifiedJoinTeamLinks(joinTeamHtml),
    {
      openPositionsUrl: sasmos.OPEN_POSITIONS_URL,
      shareProfileUrl: sasmos.SHARE_PROFILE_URL,
      careersEmail: sasmos.CAREERS_EMAIL,
    },
  )
  assert.equal(sasmos.hasVerifiedEmptySubpageSignal(openPositionsHtml, 'Open Positions'), true)
  assert.equal(sasmos.hasVerifiedEmptySubpageSignal(shareProfileHtml, 'Share your profile'), true)
  assert.equal(
    sasmos.pageExposesPublicJobListings(`
      <html>
        <body>
          <div id="content" class="sixteen columns">
            <article>
              <h2>Wire Harness Engineer</h2>
              <a href="/join-our-team/open-positions/wire-harness-engineer">Apply Now</a>
            </article>
          </div>
        </body>
      </html>
    `),
    true,
  )
})

test('SASMOS HET TECHNOLOGIES scraper returns no jobs while the official public careers surfaces remain empty', async () => {
  const sasmos = await loadModule()
  assert.ok(sasmos, 'Expected SASMOS HET TECHNOLOGIES scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await sasmos.createSasmosHetTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sasmos.JOIN_TEAM_URL) return joinTeamHtml
      if (url === sasmos.OPEN_POSITIONS_URL) return openPositionsHtml
      if (url === sasmos.SHARE_PROFILE_URL) return shareProfileHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sasmos.JOIN_TEAM_URL,
    sasmos.OPEN_POSITIONS_URL,
    sasmos.SHARE_PROFILE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SASMOS HET TECHNOLOGIES scraper fails closed when the verified public careers surfaces change', async () => {
  const sasmos = await loadModule()
  assert.ok(sasmos, 'Expected SASMOS HET TECHNOLOGIES scraper module at ./script.js')

  await assert.rejects(
    sasmos.createSasmosHetTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sasmos.JOIN_TEAM_URL) {
          return joinTeamHtml.replace('mailto:careers@sasmos.com', 'mailto:hiring@sasmos.com')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official join-team surface/i,
  )

  await assert.rejects(
    sasmos.createSasmosHetTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sasmos.JOIN_TEAM_URL) return joinTeamHtml
        if (url === sasmos.OPEN_POSITIONS_URL) {
          return `
            <html>
              <head><title>Open Positions - SASMOS</title></head>
              <body>
                <div id="content" class="sixteen columns">
                  <article>
                    <h2>Wire Harness Engineer</h2>
                    <a href="/join-our-team/open-positions/wire-harness-engineer">Apply Now</a>
                  </article>
                </div>
              </body>
            </html>
          `
        }
        if (url === sasmos.SHARE_PROFILE_URL) return shareProfileHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings/i,
  )
})
