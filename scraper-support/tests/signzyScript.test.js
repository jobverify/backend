import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Signzy</title>
  </head>
  <body>
    <main>
      <p>Careers</p>
      <h1>We Are Hiring</h1>
      <a href="/carrers">View All Positions</a>
      <script src="/_next/static/chunks/app/(frontend)/careers/page-72211fa823d4c88b.js"></script>
      <section>
        <h2>Life At Signzy</h2>
        <p>We sustain with a belief of collaborative team efforts and Team Spirit.</p>
      </section>
      <footer>© 2026 Signzy Technologies Private Limited. The content available on the website is protected by copyright laws. All rights reserved.</footer>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/signzy/script.js')
  } catch {
    assert.fail('Expected Signzy scraper module at ../../scraper/signzy/script.js')
  }
}

test('Signzy helpers stay pinned to the verified official careers page and broken jobs CTA loopback', async () => {
  const signzy = await loadModule()

  assert.equal(signzy.SOURCE, 'signzy')
  assert.equal(signzy.COMPANY_NAME, 'Signzy')
  assert.equal(signzy.OFFICIAL_BRAND_NAME, 'Signzy Technologies Private Limited')
  assert.equal(signzy.VERIFIED_ON, '2026-07-19')
  assert.equal(signzy.CAREERS_URL, 'https://www.signzy.com/careers')
  assert.equal(signzy.BROKEN_JOBS_CTA_URL, 'https://www.signzy.com/carrers')
  assert.equal(signzy.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(signzy.hasBrokenJobsCtaSignal(careersHtml), true)
  assert.equal(signzy.hasNoTrustworthyPublicJobsSignal(careersHtml), true)
  assert.equal(
    signzy.hasBrokenJobsCtaSignal(
      careersHtml.replace('href="/carrers"', 'href="/careers/product-manager"'),
    ),
    false,
  )
  assert.equal(
    signzy.hasNoTrustworthyPublicJobsSignal(
      `${careersHtml}<script src="/_next/static/chunks/app/(frontend)/jobs/page.js"></script>`,
    ),
    true,
  )
  assert.equal(
    signzy.hasNoTrustworthyPublicJobsSignal(
      `${careersHtml}<a href="https://jobs.lever.co/signzy/backend-engineer">Backend Engineer</a>`,
    ),
    false,
  )
})

test('Signzy run validates the official careers page and returns an honest empty list while the broken CTA still blocks a trustworthy public board', async () => {
  const signzy = await loadModule()
  const requestedUrls = []

  const jobs = await signzy.createSignzyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [signzy.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Signzy fails closed when the verified careers shell drifts or the broken CTA is replaced by a trustworthy public jobs path', async () => {
  const signzy = await loadModule()

  await assert.rejects(
    signzy.createSignzyScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified signzy careers page/i,
  )

  await assert.rejects(
    signzy.createSignzyScraper().run({
      fetchText: async () => careersHtml.replace('href="/carrers"', 'href="/careers/product-manager"'),
    }),
    /broken jobs cta/i,
  )

  await assert.rejects(
    signzy.createSignzyScraper().run({
      fetchText: async () => `${careersHtml}<a href="https://jobs.lever.co/signzy/backend-engineer">Backend Engineer</a>`,
    }),
    /trustworthy public jobs/i,
  )
})
