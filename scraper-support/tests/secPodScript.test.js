import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head="">SecPod Careers | Join the Preventive Cybersecurity Team | SecPod</title>
  </head>
  <body>
    <h1>Shape the Future of Preventive Cybersecurity with SecPod</h1>
    <p>We are building a world where cyberattacks are prevented before they happen.</p>
    <section>
      <h2>Technology &amp; Innovation</h2>
      <h3>AI-assisted security analysis</h3>
      <h3>Autonomous remediation</h3>
      <h3>Exposure intelligence</h3>
      <h3>Endpoint security at scale</h3>
    </section>
    <section>
      <h2>TEAMS AT SECPOD</h2>
      <h3>Engineering</h3>
      <h3>Security Research</h3>
      <h3>Product</h3>
      <h3>Marketing</h3>
      <h3>Sales</h3>
      <h3>Customer Success</h3>
    </section>
    <section>
      <h2>Current Job Openings</h2>
    </section>
  </body>
</html>
`

const CAREERS_PAGE_WITH_PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>SecPod Careers | Join the Preventive Cybersecurity Team | SecPod</title>
  </head>
  <body>
    <h1>Shape the Future of Preventive Cybersecurity with SecPod</h1>
    <section>
      <h2>Current Job Openings</h2>
      <article class="job-card">
        <h3>Security Research Engineer</h3>
        <a href="https://www.secpod.com/careers/security-research-engineer">Apply now</a>
      </article>
    </section>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/secpod/script.js')
  } catch {
    assert.fail('Expected SecPod scraper module at ../../scraper/secpod/script.js')
  }
}

test('SecPod sentinel helpers stay pinned to the verified official careers page and empty current openings section', async () => {
  const secpod = await loadScriptModule()

  assert.equal(secpod.SOURCE, 'secpod')
  assert.equal(secpod.COMPANY, 'SecPod')
  assert.equal(secpod.OFFICIAL_BRAND_NAME, 'SecPod')
  assert.equal(secpod.VERIFIED_ON, '2026-07-17')
  assert.equal(secpod.HOMEPAGE_URL, 'https://www.secpod.com/')
  assert.equal(secpod.CAREERS_URL, 'https://www.secpod.com/careers')
  assert.equal(secpod.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.equal(secpod.hasPublicJobsSignal(CAREERS_PAGE_HTML), false)
  assert.equal(secpod.hasPublicJobsSignal(CAREERS_PAGE_WITH_PUBLIC_JOBS_HTML), true)
})

test('SecPod returns [] only while the official careers page stays live and exposes no trustworthy public jobs surface', async () => {
  const secpod = await loadScriptModule()
  const requestedUrls = []

  const jobs = await secpod.createSecPodScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === secpod.CAREERS_URL) return CAREERS_PAGE_HTML
      throw new Error(`Unexpected SecPod URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [secpod.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('SecPod fails closed when the verified careers page drifts or starts exposing public jobs', async () => {
  const secpod = await loadScriptModule()

  await assert.rejects(
    secpod.createSecPodScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    secpod.createSecPodScraper().run({
      fetchText: async () => CAREERS_PAGE_WITH_PUBLIC_JOBS_HTML,
    }),
    /surface now appears to expose public jobs/i,
  )
})
