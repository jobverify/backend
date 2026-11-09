import assert from 'node:assert/strict'
import test from 'node:test'

const loadEduversityModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Home - Edu-versity</title>
    </head>
    <body>
      <h1>Start Your Upskilling Journey</h1>
      <p>Explore from our wide range of specialised programs and kickstart your career.</p>
      <section>
        <h2>Why Choose Us?</h2>
        <ul>
          <li>Edu-Learn</li>
          <li>Edu-Mentorship</li>
          <li>Edu-Skills</li>
          <li>Edu-Career</li>
        </ul>
      </section>
      <a href="http://edu-versity.in/join-our-community/">Join our community</a>
      <footer>
        <a href="https://www.linkedin.com/company/edu-versity">Linkedin</a>
        <a href="mailto:admin@edu-versity.in">admin@edu-versity.in</a>
        <p>24th Main Rd, ITI Layout, Sector 2, HSR layout, Bengaluru, Karnataka, 560102</p>
      </footer>
    </body>
  </html>
`

const communityHtml = `
  <html>
    <head>
      <title>Join Our Community - Edu-versity</title>
    </head>
    <body>
      <main>
        <h1>Join Our Community</h1>
        <p>We will keep you posted about programs, events, and learning opportunities.</p>
        <form>
          <label>Full Name</label>
          <label>Email Address</label>
          <label>Phone Number</label>
          <button type="submit">Join Community</button>
        </form>
      </main>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <head>
      <title>Join Our Community - Edu-versity</title>
    </head>
    <body>
      <main>
        <h1>Join Our Community</h1>
        <section>
          <h2>Current Openings</h2>
          <article class="job-card">
            <h3>Business Development Associate</h3>
            <p>Location: Bengaluru, India</p>
            <a href="/apply/business-development-associate">Apply now</a>
          </article>
        </section>
      </main>
    </body>
  </html>
`

test('official page helpers recognize Edu-versity site and community signup form', async () => {
  const eduversity = await loadEduversityModule()
  assert.ok(eduversity)

  assert.equal(eduversity.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(eduversity.hasContactSignal(homepageHtml), true)
  assert.equal(eduversity.hasPinnedCommunityLinkSignal(homepageHtml), true)
  assert.equal(eduversity.hasCommunityFormSignal(communityHtml), true)
  assert.equal(eduversity.hasPublicJobsSignal(communityHtml), false)
})

test('run returns no jobs when Edu-versity only exposes a community form', async () => {
  const eduversity = await loadEduversityModule()
  assert.ok(eduversity)

  const requestedUrls = []
  const jobs = await eduversity.createEduversityScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === eduversity.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === eduversity.COMMUNITY_URL) {
        return communityHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eduversity.HOMEPAGE_URL,
    eduversity.COMMUNITY_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Edu-versity starts exposing public job listings', async () => {
  const eduversity = await loadEduversityModule()
  assert.ok(eduversity)

  await assert.rejects(
    eduversity.createEduversityScraper().run({
      fetchText: async (url) => {
        if (url === eduversity.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === eduversity.COMMUNITY_URL) {
          return publicJobsHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Edu-versity site now exposes public job listings; scraper needs an update/,
  )
})

test('run returns no jobs when the pinned Edu-versity community handoff has become a branded 404', async () => {
  const eduversity = await loadEduversityModule()
  assert.ok(eduversity)

  const jobs = await eduversity.createEduversityScraper().run({
    fetchText: async (url) => {
      if (url === eduversity.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === eduversity.COMMUNITY_URL) {
        const error = new Error(`HTTP 404 for ${url}`)
        error.status = 404
        throw error
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('run returns no jobs when the branded 404 is wrapped by retry metadata', async () => {
  const eduversity = await loadEduversityModule()
  assert.ok(eduversity)

  const jobs = await eduversity.createEduversityScraper().run({
    fetchText: async (url) => {
      if (url === eduversity.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === eduversity.COMMUNITY_URL) {
        const http404 = new Error(`HTTP 404 for ${url}`)
        http404.status = 404

        const retryError = new Error(`[eduversity] All 3 attempts failed. Last error: HTTP 404 for ${url}`)
        retryError.cause = http404
        throw retryError
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
