import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/vdart/provider.js')
  } catch {
    assert.fail('Expected VDart provider module at ../../scraper/vdart/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/vdart/script.js')
  } catch {
    assert.fail('Expected VDart scraper module at ../../scraper/vdart/script.js')
  }
}

test('VDart exports a fail-closed provider contract for the verified blocked jobs.net surface', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'vdart',
    companyName: 'VDart',
    officialBrandName: 'VDart',
    adapter: 'script',
    modulePath: '../../scraper/vdart/script.js',
    homepageUrl: 'https://www.vdart.com/',
    companyCareerPage: 'https://vdart.jobs.net/',
    atsPlatform: 'official-company-careers-blocked',
    countryFilter: 'India',
    paginationStrategy: 'jobsnet-cloudflare-blocked-root-and-jobs-route-validation',
    extractionStrategy: 'verified-jobsnet-cloudflare-block-page+verified-403-blocked-surface+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'vdart.jobs.net',
    verifiedOn: '2026-08-04',
    verifiedSurfaceSummary:
      'Verified on Tuesday, August 4, 2026 that both https://vdart.jobs.net/ and its /jobs route now resolve to the same Cloudflare block page with live HTTP 403 responses, so this provider remains fail-closed until a trustworthy fetchable public jobs listing is confirmed.',
    dryRunFile: 'vdart/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('VDart run validates the blocked shell contract and stays fail-closed', async () => {
  const vdart = await loadScriptModule()

  const shellResponse = {
    status: 403,
    html: `
      <html>
        <head><title>Attention Required! | Cloudflare</title></head>
        <body>
          <div id="cf-wrapper"></div>
          <p>Please enable cookies.</p>
          <p>Sorry, you have been blocked</p>
          <p>You are unable to access jobs.net</p>
        </body>
      </html>
    `,
  }

  assert.equal(vdart.hasExpectedShellSignals(shellResponse.html), true)
  assert.equal(vdart.isBlockedJobsSurface({ status: 403 }), true)

  const jobs = await vdart.run({
    fetchPage: async (url) => {
      if (url === vdart.CAREERS_URL) return shellResponse
      if (url === `${vdart.CAREERS_URL}jobs`) return { status: 403, html: '' }
      throw new Error(`Unexpected VDart URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('VDart default fetch is bounded by a timeout signal', async () => {
  const vdart = await loadScriptModule()
  let capturedInit = null

  const page = await vdart.defaultFetchPage(vdart.CAREERS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        status: 200,
        url,
        text: async () => '<html><body>VDart shell</body></html>',
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, vdart.CAREERS_URL)
  assert.equal(page.html, '<html><body>VDart shell</body></html>')
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})
