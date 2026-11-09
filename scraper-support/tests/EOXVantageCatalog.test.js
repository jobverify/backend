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
        cZone: 'eoxvantage.com',
        cUPMDTk: '${url}',
      }
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/eoxvantage/provider.js')
  } catch {
    assert.fail('Expected EOX Vantage provider module at ../../scraper/eoxvantage/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/eoxvantage/script.js')
  } catch {
    assert.fail('Expected EOX Vantage scraper module at ../../scraper/eoxvantage/script.js')
  }
}

test('EOX Vantage exports local provider metadata for the verified Friday, August 14, 2026 blocked first-party surfaces', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'eoxvantage',
    companyName: 'EOX Vantage',
    officialBrandName: 'EOX Vantage',
    adapter: 'script',
    modulePath: '../../scraper/eoxvantage/script.js',
    homepageUrl: 'https://eoxvantage.com/',
    companyCareerPage: 'https://eoxvantage.com/careers/',
    atsPlatform: 'official-company-site-blocked-no-public-careers',
    countryFilter: 'India',
    paginationStrategy: 'verified-homepage-and-careers-routes-blocked',
    extractionStrategy: 'verified-cloudflare-403-homepage+careers-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'eoxvantage.com',
    verifiedOn: '2026-08-14',
    verifiedSurfaceSummary:
      'Verified on Friday, August 14, 2026 that both https://eoxvantage.com/ and https://eoxvantage.com/careers/ returned the same Cloudflare HTTP 403 "Just a moment..." challenge with no scraper-visible public careers content. There is no trustworthy public EOX Vantage jobs surface in this environment on the verified date.',
    dryRunFile: 'eoxvantage/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.VERIFIED_AT, providerModule.provider.verifiedOn)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('EOX Vantage recognizes the verified Cloudflare block and returns an honest empty list while both first-party routes remain gated', async () => {
  const eox = await loadScriptModule()
  const requestedUrls = []

  assert.equal(
    eox.hasVerifiedCloudflareChallengeSignal(buildVerifiedChallengeHtml('https://eoxvantage.com/careers/')),
    true,
  )
  assert.equal(
    eox.exposesStructuredPublicJobs(buildVerifiedChallengeHtml('https://eoxvantage.com/careers/')),
    false,
  )

  const jobs = await eox.run({
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
    eox.HOMEPAGE_URL,
    eox.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('EOX Vantage fails closed when the verified blocked routes drift or begin exposing public jobs', async () => {
  const eox = await loadScriptModule()

  await assert.rejects(
    eox.run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
        errorKind: null,
      }),
    }),
    /verified eox vantage first-party careers surfaces changed materially/i,
  )

  await assert.rejects(
    eox.run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        finalUrl: url,
        html: url === eox.CAREERS_URL
          ? `${buildVerifiedChallengeHtml(url)}<a href="https://eoxvantage.com/current-openings/">Apply to a Current Opening</a>`
          : buildVerifiedChallengeHtml(url),
        errorKind: null,
      }),
    }),
    /scraper-visible public jobs/i,
  )
})
