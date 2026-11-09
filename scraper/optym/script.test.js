import assert from 'node:assert/strict'
import test from 'node:test'

const loadOptymModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Optym scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Transportation Optimization Software | Optym</title>
    </head>
    <body>
      <main>
        <h1>The best move, out of billions.</h1>
        <p>We help transportation companies across road and rail make better decisions about their freight.</p>
        <section>
          <div>56,000+</div>
          <p>drivers routed daily</p>
          <p>Roadrunner</p>
        </section>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Optym | Join Our Team</title>
      <meta
        name="description"
        content="Build your career in logistics technology. Explore open roles and see how you can help optimize global transportation at Optym."
      />
    </head>
    <body>
      <main>
        <h1>Let&apos;s grow</h1>
        <h2>together.</h2>
        <p>
          Optym is where amazing people (like you) do their best work.
        </p>
        <a href="#open-roles">See open roles</a>
        <section>
          <h2>What Optymers say about working here:</h2>
          <p>Wins are celebrated</p>
          <p>Leadership is accessible</p>
        </section>
        <section>
          <p>250+</p>
          <p>Optymers around the world</p>
        </section>
      </main>
    </body>
  </html>
`

const publicJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Optym | Join Our Team</title>
      <meta
        name="description"
        content="Build your career in logistics technology. Explore open roles and see how you can help optimize global transportation at Optym."
      />
    </head>
    <body>
      <main>
        <h1>Let&apos;s grow</h1>
        <h2>together.</h2>
        <p>
          Optym is where amazing people (like you) do their best work.
        </p>
        <a href="#open-roles">See open roles</a>
        <section>
          <h2>What Optymers say about working here:</h2>
          <p>Wins are celebrated</p>
        </section>
        <section>
          <p>250+</p>
          <p>Optymers around the world</p>
        </section>
        <article class="job-listing">
          <h2>Software Engineer</h2>
          <a href="/careers/software-engineer">Apply now</a>
        </article>
      </main>
    </body>
  </html>
`

test('recognizes the verified Optym homepage and careers shell without public job listings', async () => {
  const optym = await loadOptymModule()

  assert.equal(optym.HOMEPAGE_URL, 'https://www.optym.com/')
  assert.equal(optym.CAREERS_URL, 'https://www.optym.com/careers')
  assert.equal(optym.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(optym.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(optym.pageExposesPublicJobListings(careersHtml), false)
  assert.equal(optym.pageExposesPublicJobListings(publicJobsHtml), true)
})

test('run returns no jobs only when the verified Optym careers page remains a first-party shell with no public listings', async () => {
  const optym = await loadOptymModule()
  const requestedUrls = []

  const jobs = await optym.createOptymScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === optym.HOMEPAGE_URL) return homepageHtml
      if (url === optym.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected Optym fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.optym.com/',
    'https://www.optym.com/careers',
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Optym public surface changes or starts exposing jobs', async () => {
  const optym = await loadOptymModule()

  await assert.rejects(
    optym.createOptymScraper().run({
      fetchText: async (url) => {
        if (url === optym.HOMEPAGE_URL) {
          return '<html><head><title>Home</title></head><body>Welcome</body></html>'
        }

        return careersHtml
      },
    }),
    /Optym homepage no longer matches the verified official public site/i,
  )

  await assert.rejects(
    optym.createOptymScraper().run({
      fetchText: async (url) => {
        if (url === optym.HOMEPAGE_URL) return homepageHtml
        return '<html><body><main><h1>Careers</h1><p>Coming soon</p></main></body></html>'
      },
    }),
    /Optym careers page no longer matches the verified official public site shape/i,
  )

  await assert.rejects(
    optym.createOptymScraper().run({
      fetchText: async (url) => {
        if (url === optym.HOMEPAGE_URL) return homepageHtml
        return publicJobsHtml
      },
    }),
    /Optym careers page now appears to expose public job listings/i,
  )
})
