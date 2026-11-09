import assert from 'node:assert/strict'
import test from 'node:test'

const loadTalentBattleModule = async () => {
  try {
    return await import('../../scraper/talentbattle/script.js')
  } catch {
    assert.fail('Expected Talent Battle scraper module at ../../scraper/talentbattle/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Talent Battle | One-Stop Platform for Placement Preparation and Upskilling</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/Jobs">Apply to jobs</a>
      <a href="/blogs">Free Resources</a>
    </nav>
    <main>
      <h1>Preparing for Placement?</h1>
      <p>Our Complete Placement Preparation Masterclass is here to help you.</p>
      <section>
        <h2>Get Off-Campus Updates</h2>
        <p>Join our WhatsApp community and Instagram Pages.</p>
      </section>
    </main>
    <footer>One stop platform for your Placement Preparation.</footer>
  </body>
</html>
`

const placementBoardShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Posting</title>
  </head>
  <body>
    <nav>
      <a href="/Jobs">Apply to jobs</a>
    </nav>
    <main>
      <h1>Jobs</h1>
      <div>Filter Jobs</div>
      <div>View as</div>
      <div>Domain</div>
      <div>Companies</div>
      <div>Status</div>
    </main>
    <footer>One stop platform for your Placement Preparation.</footer>
  </body>
</html>
`

const nextNotFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404: This page could not be found</title>
  </head>
  <body>
    <h1>404</h1>
    <h2>This page could not be found.</h2>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"errorStatus":404}},"page":"/[...slug]","query":{"slug":["careers"]}}
    </script>
  </body>
</html>
`

test('Talent Battle scraper validates the official homepage, placement-board shell, and current missing careers routes', async () => {
  const talentBattle = await loadTalentBattleModule()

  assert.equal(talentBattle.SOURCE, 'talentbattle')
  assert.equal(talentBattle.COMPANY, 'Talent Battle')
  assert.equal(talentBattle.HOME_URL, 'https://talentbattle.in/')
  assert.equal(talentBattle.JOBS_URL, 'https://talentbattle.in/Jobs')
  assert.equal(talentBattle.CAREERS_URL, 'https://talentbattle.in/careers')
  assert.equal(talentBattle.CAREER_URL, 'https://talentbattle.in/career')
  assert.equal(talentBattle.JOIN_US_URL, 'https://talentbattle.in/join-us')
  assert.equal(talentBattle.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(talentBattle.hasPlacementBoardShellSignal(placementBoardShellHtml), true)
  assert.equal(talentBattle.isNextNotFoundPage(nextNotFoundHtml), true)
  assert.equal(talentBattle.hasTalentBattleHiringSignal(placementBoardShellHtml), false)
  assert.equal(
    talentBattle.hasOfficialHomepageSignal('<html><body><h1>Talent Battle</h1></body></html>'),
    false,
  )
  assert.equal(
    talentBattle.hasPlacementBoardShellSignal('<html><body><h1>Jobs</h1></body></html>'),
    false,
  )
})

test('Talent Battle scraper returns no jobs when only the placement board shell exists and company careers routes remain missing', async () => {
  const talentBattle = await loadTalentBattleModule()
  const requestedUrls = []

  const jobs = await talentBattle.createTalentBattleScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === talentBattle.HOME_URL) return officialHomepageHtml
      if (url === talentBattle.JOBS_URL) return placementBoardShellHtml
      if (
        url === talentBattle.CAREERS_URL
        || url === talentBattle.CAREER_URL
        || url === talentBattle.JOIN_US_URL
      ) {
        return nextNotFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    talentBattle.HOME_URL,
    talentBattle.JOBS_URL,
    talentBattle.CAREERS_URL,
    talentBattle.CAREER_URL,
    talentBattle.JOIN_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Talent Battle scraper fails closed when the placement-board shell changes or a first-party careers route appears', async () => {
  const talentBattle = await loadTalentBattleModule()

  await assert.rejects(
    talentBattle.createTalentBattleScraper().run({
      fetchText: async (url) => {
        if (url === talentBattle.HOME_URL) return officialHomepageHtml
        if (url === talentBattle.JOBS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        if (
          url === talentBattle.CAREERS_URL
          || url === talentBattle.CAREER_URL
          || url === talentBattle.JOIN_US_URL
        ) {
          return nextNotFoundHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Talent Battle placement jobs shell changed/i,
  )

  await assert.rejects(
    talentBattle.createTalentBattleScraper().run({
      fetchText: async (url) => {
        if (url === talentBattle.HOME_URL) return officialHomepageHtml
        if (url === talentBattle.JOBS_URL) return placementBoardShellHtml
        if (url === talentBattle.CAREERS_URL) {
          return `
            <html>
              <body>
                <main>
                  <h1>Careers at Talent Battle</h1>
                  <p>Join Talent Battle as a Trainer</p>
                </main>
              </body>
            </html>
          `
        }
        if (url === talentBattle.CAREER_URL || url === talentBattle.JOIN_US_URL) {
          return nextNotFoundHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Talent Battle now exposes a first-party careers route/i,
  )
})
