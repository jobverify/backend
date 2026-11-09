import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head><title>Get info about the latest career opportunities at Azuga | Azuga</title></head>
    <body>
      <h1>Careers @ Azuga</h1>
      <h3>Take a look at our open positions.</h3>
      <p>No items found.</p>
      <a href="https://www.bebridgestone.com/en_us/careers.html">Careers</a>
    </body>
  </html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/azugatelematics/provider.js')
  } catch {
    assert.fail('Expected Azuga Telematics provider module at ../../scraper/azugatelematics/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/azugatelematics/script.js')
  } catch {
    assert.fail('Expected Azuga Telematics scraper module at ../../scraper/azugatelematics/script.js')
  }
}

test('Azuga Telematics exports a fail-closed local provider for the official careers page with no openings', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.equal(providerModule.provider.source, 'azugatelematics')
  assert.equal(providerModule.provider.companyName, 'Azuga Telematics')
  assert.equal(providerModule.provider.adapter, 'script')
  assert.equal(providerModule.provider.companyCareerPage, 'https://www.azuga.com/careers')
  assert.equal(providerModule.provider.atsPlatform, 'official-company-site-no-open-roles')
  assert.equal(providerModule.provider.countryFilter, 'India')
  assert.equal(providerModule.provider.verifiedOn, '2026-08-01')
  assert.match(providerModule.provider.verifiedSurfaceSummary, /No items found\./i)
  assert.match(providerModule.provider.verifiedSurfaceSummary, /bebridgestone\.com/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Azuga Telematics sentinel accepts the verified no-openings careers page and returns no jobs', async () => {
  const azuga = await loadScriptModule()

  assert.equal(azuga.hasVerifiedAzugaCareersSignal(careersHtml), true)
  assert.equal(azuga.hasPublicAzugaJobSignal(careersHtml), false)

  const jobs = await azuga.createAzugaTelematicsScraper().run({
    fetchPage: async () => ({
      status: 200,
      url: 'https://www.azuga.com/careers',
      html: careersHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})
