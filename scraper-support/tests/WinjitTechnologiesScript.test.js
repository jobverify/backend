import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<html><title>You are being redirected...</title>
<noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
<script>var sucuri_cloudproxy_js='1';</script>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/winjittechnologies/script.js')
  } catch {
    assert.fail('Expected Winjit Technologies scraper module at ../../scraper/winjittechnologies/script.js')
  }
}

test('Winjit Technologies validator stays pinned to the verified Sucuri interstitial from Friday, July 17, 2026', async () => {
  const winjit = await loadModule()
  assert.equal(winjit.hasVerifiedSucuriSignal(homepageHtml), true)
})

test('Winjit Technologies run validates the blocked surface and stays fail-closed', async () => {
  const winjit = await loadModule()
  const jobs = await winjit.createWinjitTechnologiesScraper().run({
    fetchText: async () => homepageHtml,
  })

  assert.deepEqual(jobs, [])
})
