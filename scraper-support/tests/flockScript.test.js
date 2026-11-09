import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Team Messenger & Online Collaboration Platform - Flock</title>
  </head>
  <body>
    <main>
      <h1>Your new home for collaboration.</h1>
      <a href="http://careers.flock.com/">Careers</a>
      <a href="https://web.flock.com/">Sign in</a>
    </main>
  </body>
</html>
`

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Flock Careers</title>
  </head>
  <body>
    <main>
      <h1>We're changing how teams communicate and work together</h1>
      <h2>Join the Team</h2>
      <div>All teams</div>
      <div>All locations</div>
      <button type="button">Search Jobs</button>
      <p>Don't see an opportunity that matches your skills?</p>
      <p>You can reach out to us at work@flock.com. We're always on the lookout for great ideas and talent.</p>
      <h2>Why join Flock?</h2>
      <h2>Our Culture</h2>
      <h2>Benefits and Perks</h2>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Flock Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Product Designer"}
    </script>
  </head>
  <body>
    <main>
      <h2>Join the Team</h2>
      <article class="job-card">
        <h3>Senior Product Designer</h3>
        <p>Mumbai, India</p>
        <a href="https://careers.flock.com/jobs/senior-product-designer">View job</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/flock/script.js')
  } catch {
    assert.fail('Expected Flock scraper module at ../../scraper/flock/script.js')
  }
}

test('Flock helpers stay pinned to the verified homepage and no-public-jobs careers shell', async () => {
  const flock = await loadModule()

  assert.equal(flock.COMPANY, 'Flock')
  assert.equal(flock.SOURCE, 'flock')
  assert.equal(flock.HOMEPAGE_URL, 'https://www.flock.com/')
  assert.equal(flock.CAREERS_URL, 'https://careers.flock.com/')
  assert.equal(flock.VERIFIED_ON, '2026-08-02')
  assert.match(flock.VERIFIED_SURFACE_SUMMARY, /work@flock\.com/i)
  assert.equal(
    flock.extractHomepageCareersUrl(homepageHtml),
    'https://careers.flock.com/',
  )
  assert.equal(flock.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(flock.hasOfficialCareersPageSignal(careersShellHtml), true)
  assert.equal(flock.hasNoPublicJobsShellSignal(careersShellHtml), true)
  assert.equal(flock.hasPublicJobListingSignal(careersShellHtml), false)
  assert.equal(flock.hasPublicJobListingSignal(publicJobsHtml), true)
})

test('Flock returns no jobs while the verified careers site remains a no-public-jobs shell', async () => {
  const flock = await loadModule()
  const requestedUrls = []

  const jobs = await flock.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === flock.HOMEPAGE_URL) {
        return {
          status: 200,
          url: flock.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === flock.CAREERS_URL) {
        return {
          status: 200,
          url: flock.CAREERS_URL,
          html: careersShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    flock.HOMEPAGE_URL,
    flock.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Flock fails closed when the homepage link or careers shell contract drifts', async () => {
  const flock = await loadModule()

  await assert.rejects(
    flock.run({
      fetchPage: async (url) => {
        if (url === flock.HOMEPAGE_URL) {
          return {
            status: 200,
            url: flock.HOMEPAGE_URL,
            html: '<html><body><a href="/pricing">Pricing</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage changed materially|verified official homepage/i,
  )

  await assert.rejects(
    flock.run({
      fetchPage: async (url) => {
        if (url === flock.HOMEPAGE_URL) {
          return {
            status: 200,
            url: flock.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === flock.CAREERS_URL) {
          return {
            status: 200,
            url: flock.CAREERS_URL,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page changed materially|public jobs surface/i,
  )
})
