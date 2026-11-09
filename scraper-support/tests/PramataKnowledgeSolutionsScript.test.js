import assert from 'node:assert/strict'
import test from 'node:test'

const buildVerifiedChallengeHtml = (url) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <noscript>
      <meta http-equiv="refresh" content="0;url=${url}?ki-cf-botcl=1" />
    </noscript>
  </head>
  <body>
    <h1>Checking you before accessing www.pramata.com.</h1>
    <div class="spinner"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pramataknowledgesolutions/script.js')
  } catch {
    assert.fail('Expected Pramata Knowledge Solutions scraper module at ../../scraper/pramataknowledgesolutions/script.js')
  }
}

test('Pramata Knowledge Solutions recognizes the current Cloudflare challenge on its verified blocked careers surfaces', async () => {
  const pramata = await loadModule()

  assert.equal(pramata.SOURCE, 'pramataknowledgesolutions')
  assert.equal(pramata.COMPANY_NAME, 'Pramata Knowledge Solutions')
  assert.equal(pramata.OFFICIAL_BRAND_NAME, 'Pramata')
  assert.equal(pramata.CAREERS_URL, 'https://www.pramata.com/careers/')
  assert.equal(pramata.SAMPLE_ROLE_URL, 'https://www.pramata.com/careers/legal-solution-consultant/')
  assert.equal(pramata.VERIFIED_ON, '2026-08-14')
  assert.equal(
    pramata.hasVerifiedCloudflareChallengeSignal(
      buildVerifiedChallengeHtml('https://www.pramata.com/careers/'),
    ),
    true,
  )
  assert.equal(pramata.exposesStructuredPublicJobs(buildVerifiedChallengeHtml('https://www.pramata.com/careers/')), false)
  assert.equal(
    pramata.exposesStructuredPublicJobs(
      `${buildVerifiedChallengeHtml('https://www.pramata.com/careers/')}<article class="job-card"><h2>Solution Architect - Contract AI</h2></article>`,
    ),
    true,
  )
})

test('Pramata Knowledge Solutions returns an honest empty list while the verified careers and sample-role routes are Cloudflare-gated', async () => {
  const pramata = await loadModule()
  const requestedUrls = []

  const jobs = await pramata.createPramataKnowledgeSolutionsScraper().run({
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
    pramata.CAREERS_URL,
    pramata.SAMPLE_ROLE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Pramata Knowledge Solutions fails closed when the verified blocked surfaces drift or begin exposing public jobs', async () => {
  const pramata = await loadModule()

  await assert.rejects(
    pramata.createPramataKnowledgeSolutionsScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
        errorKind: null,
      }),
    }),
    /verified pramata knowledge solutions careers surfaces/i,
  )

  await assert.rejects(
    pramata.createPramataKnowledgeSolutionsScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: url === pramata.SAMPLE_ROLE_URL
          ? `${buildVerifiedChallengeHtml(url)}<article class="job-card"><h2>Solution Architect - Contract AI</h2></article>`
          : buildVerifiedChallengeHtml(url),
        errorKind: null,
      }),
    }),
    /scraper-visible public jobs/i,
  )
})
