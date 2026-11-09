import assert from 'node:assert/strict'
import test from 'node:test'

const buildVerifiedChallengeHtml = (url) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <span id="challenge-error-text">Enable JavaScript and cookies to continue</span>
    <script>
      window._cf_chl_opt = {
        cZone: 'www.orioninnovation.com',
        cUPMDTk: '${url}',
      }
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
  </body>
</html>
`

const officialCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at Orion - Orion Innovation</title>
  </head>
  <body>
    <main>
      <h1>Where people grow and innovation thrives</h1>
      <p>Explore open roles today.</p>
      <a href="https://www.orioninnovation.com/careers/job/">Explore Opportunities</a>
    </main>
  </body>
</html>
`

const officialOpenJobsPublicHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job - Orion Innovation</title>
  </head>
  <body>
    <main>
      <h1>Open Jobs</h1>
      <p>79 Open Positions</p>
      <a href="https://www.orioninnovation.com/careers/job/?gh_jid=4697474006">Open Jobs</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/orioninnovation/script.js')
  } catch {
    assert.fail('Expected Orion Innovation scraper module at ../../scraper/orioninnovation/script.js')
  }
}

test('Orion Innovation helpers stay pinned to the verified blocked Cloudflare careers surfaces', async () => {
  const orion = await loadModule()

  assert.equal(orion.SOURCE, 'orioninnovation')
  assert.equal(orion.COMPANY, 'Orion Innovation')
  assert.equal(orion.CAREERS_PAGE_URL, 'https://www.orioninnovation.com/careers/life-at-orion/')
  assert.equal(orion.OPEN_JOBS_URL, 'https://www.orioninnovation.com/careers/job/')
  assert.equal(orion.VERIFIED_ON, '2026-08-14')
  assert.equal(
    orion.hasVerifiedCloudflareChallengeSignal(
      buildVerifiedChallengeHtml('https://www.orioninnovation.com/careers/life-at-orion/'),
    ),
    true,
  )
  assert.equal(
    orion.exposesStructuredPublicJobs(
      buildVerifiedChallengeHtml('https://www.orioninnovation.com/careers/life-at-orion/'),
    ),
    false,
  )
  assert.equal(
    orion.exposesStructuredPublicJobs(
      `${buildVerifiedChallengeHtml('https://www.orioninnovation.com/careers/job/')}<a href="https://www.orioninnovation.com/careers/job/?gh_jid=4697474006">Open Jobs</a>`,
    ),
    true,
  )
})

test('Orion Innovation returns an honest empty list while both verified careers routes remain Cloudflare-gated', async () => {
  const orion = await loadModule()
  const requestedUrls = []

  const jobs = await orion.createOrionInnovationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        finalUrl: url,
        html: buildVerifiedChallengeHtml(url),
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    orion.CAREERS_PAGE_URL,
    orion.OPEN_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Orion Innovation fails closed when the verified blocked surfaces drift or begin exposing public jobs', async () => {
  const orion = await loadModule()

  await assert.rejects(
    orion.createOrionInnovationScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
        errorKind: null,
      }),
    }),
    /verified official public surface/i,
  )

  await assert.rejects(
    orion.createOrionInnovationScraper().run({
      fetchPage: async (url) => (
        url === orion.CAREERS_PAGE_URL
          ? {
              status: 200,
              url,
              finalUrl: url,
              html: officialCareersPageHtml,
              errorKind: null,
            }
          : {
              status: 200,
              url,
              finalUrl: url,
              html: officialOpenJobsPublicHtml,
              errorKind: null,
            }
      ),
    }),
    /public jobs but parsing returned no jobs/i,
  )
})
