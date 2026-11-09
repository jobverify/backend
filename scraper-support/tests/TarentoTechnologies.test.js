import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tarento | Join the T-Crew & Make an Impact</title>
  </head>
  <body>
    <main>
      <h1>JOIN THE T-CREW</h1>
      <h2>open positions</h2>
      <h3>Mobile Interaction Design</h3>
      <p>Design a note taking application for mobile platform.</p>
      <h3>Design a Clock Application</h3>
      <p>Design a clock application for mobile platform.</p>
      <h3>Careers at Tarento</h3>
      <p>If you truly feel you'd be a great fit, don't wait for an open role - reach out to us directly.</p>
      <a href="mailto:careers@tarento.com">careers@tarento.com</a>
      <a href="mailto:bgvcheck@tarento.com">bgvcheck@tarento.com</a>
    </main>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/tarentotechnologies/provider.js')
  } catch {
    assert.fail('Expected Tarento Technologies provider module at ../../scraper/tarentotechnologies/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tarentotechnologies/script.js')
  } catch {
    assert.fail('Expected Tarento Technologies scraper module at ../../scraper/tarentotechnologies/script.js')
  }
}

test('Tarento Technologies exports the verified fail-closed careers contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'tarentotechnologies',
    companyName: 'Tarento Technologies',
    officialBrandName: 'Tarento',
    adapter: 'script',
    modulePath: '../../scraper/tarentotechnologies/script.js',
    homepageUrl: 'https://www.tarento.com/',
    companyCareerPage: 'https://www.tarento.com/careers/',
    atsPlatform: 'official-careers-challenge-page-no-structured-public-jobs',
    countryFilter: 'India',
    paginationStrategy: 'single-first-party-careers-page-validation',
    extractionStrategy: 'verified-first-party-careers-challenge-copy+mailto-contact-only+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'tarento.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.tarento.com/careers/ remained Tarento\'s first-party careers page, surfaced the Mobile Interaction Design and Design a Clock Application challenge cards, and directed candidates to careers@tarento.com instead of publishing structured public job cards or role-detail pages. Because the live surface is challenge-and-contact driven rather than a trustworthy public openings feed, this provider remains fail-closed.',
    dryRunFile: 'tarentotechnologies/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Tarento Technologies returns [] while the first-party page remains challenge and email based', async () => {
  const tarento = await loadScriptModule()

  assert.equal(tarento.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(tarento.extractChallengeTitles(careersHtml), [
    'Mobile Interaction Design',
    'Design a Clock Application',
  ])

  const jobs = await tarento.run({
    fetchText: async (url) => {
      assert.equal(url, tarento.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    tarento.run({
      fetchText: async () => `
        ${careersHtml}
        <article class="job-card"><a href="https://www.tarento.com/careers/data-engineer/">Data Engineer</a></article>
      `,
    }),
    /public jobs surface/i,
  )
})
