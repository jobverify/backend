import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Moonfrog Labs – Leading game design for delightful experiences!</title>
    <meta name="description" content="Moonfrog Labs creates world-class mobile games." />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/careers/">Careers</a>
    </nav>
    <main>
      <h1>Leading game design for delightful experiences!</h1>
      <p>Moonfrog Labs creates world-class mobile games for players around the world.</p>
    </main>
  </body>
</html>
`

const CAREERS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Careers – Moonfrog Labs</title>
    <meta
      name="description"
      content="Join the Moonfrog Labs team! We're passionate about making world-class mobile games."
    />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>
        Moonfrog Labs is driven by a passion for making the most enjoyable and superior games for
        their players around the world.
      </p>
      <p>
        If you would like to be part of our growth and build great games, please connect via
        <a href="https://www.linkedin.com/company/moonfrog-labs/">LinkedIn</a>
        or email using the links below.
      </p>
      <a href="mailto:hr@moonfroglabs.com">hr@moonfroglabs.com</a>
      <h2>Currently Open Positions</h2>
      <p>No Open Positions Currently</p>
    </main>
  </body>
</html>
`

const PRIVACY_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Recruitment Privacy Policy – Moonfrog Labs</title>
  </head>
  <body>
    <main>
      <h1>PRIVACY POLICY – RECRUITMENT</h1>
      <p>
        The controller of your personal data will be Moonfrog Labs Private Limited.
      </p>
      <p>Candidate means you as an individual who has applied for a position with Stillfront.</p>
    </main>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Moonfrog Labs – Leading game design for delightful experiences!</title>
  </head>
  <body>
    <main>
      <h1>Page Not Found</h1>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Moonfrog Labs Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Game Designer"}
    </script>
  </head>
  <body>
    <h1>Open Roles</h1>
    <a href="https://jobs.example.com/game-designer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/moonfroglabs/script.js')
  } catch {
    assert.fail('Expected Moonfrog Labs scraper module at ../../scraper/moonfroglabs/script.js')
  }
}

test('Moonfrog Labs sentinel helpers stay pinned to the verified homepage, no-openings careers page, and adjacent missing routes', async () => {
  const moonfrogLabs = await loadModule()

  assert.equal(moonfrogLabs.SOURCE, 'moonfroglabs')
  assert.equal(moonfrogLabs.COMPANY, 'Moonfrog Labs')
  assert.equal(moonfrogLabs.OFFICIAL_BRAND_NAME, 'Moonfrog Labs Private Limited')
  assert.equal(moonfrogLabs.VERIFIED_ON, '2026-08-03')
  assert.equal(moonfrogLabs.HOMEPAGE_URL, 'https://moonfroglabs.com/')
  assert.equal(moonfrogLabs.CAREERS_URL, 'https://moonfroglabs.com/careers/')
  assert.equal(
    moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL,
    'https://moonfroglabs.com/recruitment-privacy-policy/',
  )
  assert.equal(moonfrogLabs.APPLICATION_EMAIL, 'hr@moonfroglabs.com')
  assert.equal(moonfrogLabs.APPLICATION_URL, 'mailto:hr@moonfroglabs.com')
  assert.deepEqual(moonfrogLabs.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://moonfroglabs.com/jobs/',
    'https://moonfroglabs.com/open-positions/',
  ])
  assert.match(moonfrogLabs.VERIFIED_SURFACE_SUMMARY, /No Open Positions Currently/i)
  assert.match(moonfrogLabs.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(moonfrogLabs.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(moonfrogLabs.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(moonfrogLabs.hasRecruitmentPrivacyPolicySignal(PRIVACY_HTML), true)
  assert.equal(moonfrogLabs.pageExposesPublicJobListings(CAREERS_HTML), false)
  assert.equal(moonfrogLabs.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    moonfrogLabs.isVerifiedMissingCareerRoute({
      status: 404,
      url: moonfrogLabs.NO_PUBLIC_CAREER_ROUTE_URLS[0],
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
})

test('Moonfrog Labs returns [] only while the verified careers page still explicitly says there are no open positions', async () => {
  const moonfrogLabs = await loadModule()
  const requestedUrls = []

  const jobs = await moonfrogLabs.createMoonfrogLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === moonfrogLabs.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === moonfrogLabs.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (url === moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL) {
        return { status: 200, url, html: PRIVACY_HTML }
      }

      if (moonfrogLabs.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      throw new Error(`Unexpected Moonfrog Labs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    moonfrogLabs.HOMEPAGE_URL,
    moonfrogLabs.CAREERS_URL,
    moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL,
    ...moonfrogLabs.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Moonfrog Labs fails closed when the verified homepage, careers page, privacy policy, or missing-route state drifts', async () => {
  const moonfrogLabs = await loadModule()

  await assert.rejects(
    moonfrogLabs.createMoonfrogLabsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body>Unexpected</body></html>',
      }),
    }),
    /verified Moonfrog Labs homepage/i,
  )

  await assert.rejects(
    moonfrogLabs.createMoonfrogLabsScraper().run({
      fetchPage: async (url) => {
        if (url === moonfrogLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === moonfrogLabs.CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL) {
          return { status: 200, url, html: PRIVACY_HTML }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /careers page now appears to expose public job listings|verified Moonfrog Labs careers page/i,
  )

  await assert.rejects(
    moonfrogLabs.createMoonfrogLabsScraper().run({
      fetchPage: async (url) => {
        if (url === moonfrogLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === moonfrogLabs.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL) {
          return { status: 200, url, html: '<html><body>Unexpected policy</body></html>' }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /recruitment privacy policy/i,
  )

  await assert.rejects(
    moonfrogLabs.createMoonfrogLabsScraper().run({
      fetchPage: async (url) => {
        if (url === moonfrogLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === moonfrogLabs.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === moonfrogLabs.RECRUITMENT_PRIVACY_POLICY_URL) {
          return { status: 200, url, html: PRIVACY_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
