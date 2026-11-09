import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Baserow</title>
    <link rel="canonical" href="https://baserow.io/jobs" />
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Join us as we build the world's best open source no-code platform.</p>
      <ul>
        <li>Work on open source</li>
        <li>Fast-growing startup</li>
        <li>Remote-only</li>
        <li>Best idea wins</li>
      </ul>
      <section aria-label="Open roles" class="job-listing__jobs">
        <article>
          <h2><a href="/jobs/product-specialist-baserow">Product Specialist - Baserow</a></h2>
          <div class="job-listing__job-info"><strong>Remote - Europe or Americas</strong></div>
          <a href="/jobs/product-specialist-baserow">Apply</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const OFFICIAL_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Product Specialist - Baserow | Baserow</title>
  </head>
  <body>
    <main>
      <h1>Product Specialist - Baserow</h1>
      <p>Remote - Europe or Americas</p>
      <p>You are based in Europe.</p>
      <p>Send your resume to jobs@baserow.io</p>
    </main>
  </body>
</html>
`

const INDIA_ROLE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Baserow</title>
    <link rel="canonical" href="https://baserow.io/jobs" />
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Join us as we build the world's best open source no-code platform.</p>
      <ul>
        <li>Work on open source</li>
        <li>Fast-growing startup</li>
        <li>Remote-only</li>
        <li>Best idea wins</li>
      </ul>
      <section aria-label="Open roles" class="job-listing__jobs">
        <article>
          <h2><a href="/jobs/product-specialist-baserow">Product Specialist - Baserow</a></h2>
          <div class="job-listing__job-info"><strong>Remote - India</strong></div>
          <a href="/jobs/product-specialist-baserow">Apply</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const loadBaserowModule = async () => {
  try {
    return await import('../../scraper/baserow/script.js')
  } catch {
    assert.fail('Expected Baserow scraper module at ../../scraper/baserow/script.js')
  }
}

test('Baserow pins the verified first-party jobs page and extracts same-domain detail links', async () => {
  const baserow = await loadBaserowModule()

  assert.equal(baserow.SOURCE, 'baserow')
  assert.equal(baserow.COMPANY, 'Baserow')
  assert.equal(baserow.OFFICIAL_BRAND_NAME, 'Baserow')
  assert.equal(baserow.VERIFIED_ON, '2026-07-25')
  assert.equal(baserow.CAREERS_PAGE_URL, 'https://baserow.io/jobs')
  assert.equal(baserow.hasVerifiedCareersPageSignal(OFFICIAL_JOBS_HTML), true)
  assert.deepEqual(baserow.extractRoleSummaries(OFFICIAL_JOBS_HTML), [
    {
      title: 'Product Specialist - Baserow',
      location: 'Remote - Europe or Americas',
      url: 'https://baserow.io/jobs/product-specialist-baserow',
    },
  ])
})

test('Baserow returns an honest empty array when the verified first-party jobs page exposes no India locations', async () => {
  const baserow = await loadBaserowModule()
  const requestedUrls = []

  const jobs = await baserow.createBaserowScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === baserow.CAREERS_PAGE_URL) return OFFICIAL_JOBS_HTML
      if (url === 'https://baserow.io/jobs/product-specialist-baserow') return OFFICIAL_DETAIL_HTML
      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    baserow.CAREERS_PAGE_URL,
    'https://baserow.io/jobs/product-specialist-baserow',
  ])
  assert.deepEqual(jobs, [])
})

test('Baserow fails closed when the verified jobs surface drifts or starts exposing India roles', async () => {
  const baserow = await loadBaserowModule()

  await assert.rejects(
    baserow.createBaserowScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified baserow jobs page/i,
  )

  await assert.rejects(
    baserow.createBaserowScraper().run({
      fetchText: async (url) => {
        if (url === baserow.CAREERS_PAGE_URL) return INDIA_ROLE_HTML
        return OFFICIAL_DETAIL_HTML
      },
    }),
    /verified baserow india slice changed materially/i,
  )
})
