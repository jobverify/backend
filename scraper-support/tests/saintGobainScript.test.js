import assert from 'node:assert/strict'
import test from 'node:test'

const loadSaintGobainModule = async () => {
  try {
    return await import('../../scraper/saintgobain/script.js')
  } catch {
    assert.fail('Expected Saint-Gobain scraper module at ../../scraper/saintgobain/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities at Saint-Gobain Glass | Saint-Gobain Glass</title>
  </head>
  <body>
    <main>
      <a href="https://apply.in.saint-gobain-glass.com/">View Jobs</a>
      <h1>Careers at Saint-Gobain</h1>
      <p>Saint-Gobain is the worldwide leader in light and sustainable construction, improving daily life through high-performance solutions.</p>
      <section>
        <h2>Why Saint-Gobain?</h2>
      </section>
    </main>
  </body>
</html>
`

const browserVerificationBlockHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <h1>Just a moment...</h1>
      <p>We're checking your browser before allowing access.</p>
      <p>Ray ID: abc123</p>
    </main>
    <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
  </body>
</html>
`

const loginOnlyPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Login</title>
  </head>
  <body class="login">
    <form class="login-form">
      <h3>SG Careers</h3>
      <a href="javascript:;" id="forget-password">Forgot your password ?</a>
      <button type="submit">Login</button>
      <span>Click here to <a id="register-btn" href="javascript:;">Registration</a></span>
    </form>
  </body>
</html>
`

const publicPortalJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/job/123">Apply now</a>
    </main>
  </body>
</html>
`

test('Saint-Gobain scraper validates the official India careers surface, verified handoff, and login-only apply portal', async () => {
  const saintGobain = await loadSaintGobainModule()

  assert.equal(saintGobain.CAREERS_URL, 'https://in.saint-gobain-glass.com/careers')
  assert.equal(saintGobain.APPLY_PORTAL_URL, 'https://apply.in.saint-gobain-glass.com/')
  assert.equal(saintGobain.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(saintGobain.hasVerifiedPortalHandoff(officialCareersHtml), true)
  assert.equal(saintGobain.hasFirstPartyJobsSignal(officialCareersHtml), false)
  assert.equal(saintGobain.hasLoginOnlyPortalSignal(loginOnlyPortalHtml), true)
  assert.equal(saintGobain.hasPublicPortalJobsSignal(loginOnlyPortalHtml), false)
})

test('Saint-Gobain scraper returns no jobs while the official India careers page still hands off to the login-only portal', async () => {
  const saintGobain = await loadSaintGobainModule()
  const requestedUrls = []

  const jobs = await saintGobain.createSaintGobainScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === saintGobain.CAREERS_URL) return officialCareersHtml
      if (url === saintGobain.APPLY_PORTAL_URL) return loginOnlyPortalHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [saintGobain.CAREERS_URL, saintGobain.APPLY_PORTAL_URL])
  assert.deepEqual(jobs, [])
})

test('Saint-Gobain scraper returns no jobs when the official India careers page is temporarily challenge-gated but the apply portal remains login-only', async () => {
  const saintGobain = await loadSaintGobainModule()

  assert.equal(saintGobain.hasBrowserVerificationBlockSignal(browserVerificationBlockHtml), true)

  const jobs = await saintGobain.createSaintGobainScraper().run({
    fetchPage: async (url) => {
      if (url === saintGobain.CAREERS_URL) {
        return {
          status: 403,
          url,
          html: browserVerificationBlockHtml,
        }
      }

      if (url === saintGobain.APPLY_PORTAL_URL) {
        return {
          status: 200,
          url,
          html: loginOnlyPortalHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Saint-Gobain scraper fails closed when the official India careers handoff changes or the portal becomes public', async () => {
  const saintGobain = await loadSaintGobainModule()

  await assert.rejects(
    saintGobain.createSaintGobainScraper().run({
      fetchPage: async (url) => {
        if (url === saintGobain.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(
              'https://apply.in.saint-gobain-glass.com/',
              'https://example.com/jobs',
            ),
          }
        }

        return {
          status: 200,
          url,
          html: loginOnlyPortalHtml,
        }
      },
    }),
    /careers handoff changed/i,
  )

  await assert.rejects(
    saintGobain.createSaintGobainScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === saintGobain.APPLY_PORTAL_URL ? publicPortalJobsHtml : officialCareersHtml,
      }),
    }),
    /public guest-visible jobs/i,
  )
})
