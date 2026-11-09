import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Dynamic Digital Marketing &amp; Web Development Team</title>
  </head>
  <body>
    <h1>Career</h1>
    <p>Open Job Positions</p>
    <h2>Your Career Starts Here</h2>
    <div class="career-page-card">
      <h3 class="card-title"><a href="/career/hr-executive-details">Human Resource Executive</a></h3>
      <span class="card-status">Total Openings 1</span>
      <p class="card-meta-item">Lucknow</p>
      <p class="card-meta-item">Subject to Interview</p>
      <p class="card-disc">We're looking for a dynamic Human Resource Executive to join our team and contribute to a positive work environment.</p>
      <a href="/career/hr-executive-details">Download Details PDF</a>
      <a href="/career/hr-executive-apply">Apply Now</a>
    </div>
    <div class="career-page-card">
      <h3 class="card-title"><a href="/career/business-development-manager-details">Business Development Manager</a></h3>
      <span class="card-status">Total Openings 1</span>
      <p class="card-meta-item">Lucknow</p>
      <p class="card-meta-item">Subject to Interview</p>
      <p class="card-disc">We're looking for a professional with a good understanding of the market and a track record of sales success.</p>
      <a href="/career/business-development-manager-details">Download Details PDF</a>
      <a href="/career/business-development-manager-apply">Apply Now</a>
    </div>
    <div class="career-page-card">
      <h3 class="card-title"><a href="/career/seo-executive-details">SEO Executive</a></h3>
      <span class="card-status">Total Openings 2</span>
      <p class="card-meta-item">Lucknow</p>
      <p class="card-meta-item">Subject to Interview</p>
      <p class="card-disc">We are looking for an SEO Executive with strong on-page and off-page optimization fundamentals.</p>
      <a href="/career/seo-executive-details">Download Details PDF</a>
      <a href="/career/seo-executive-apply">Apply Now</a>
    </div>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/logelite/provider.js')
  } catch {
    assert.fail('Expected Logelite provider module at ../../scraper/logelite/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/logelite/script.js')
  } catch {
    assert.fail('Expected Logelite scraper module at ../../scraper/logelite/script.js')
  }
}

test('Logelite exports local provider metadata for the verified first-party career page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'logelite',
    companyName: 'Logelite',
    officialBrandName: 'Logelite',
    adapter: 'script',
    modulePath: '../../scraper/logelite/script.js',
    homepageUrl: 'https://logelite.com/',
    companyCareerPage: 'https://logelite.com/career/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-page-job-cards',
    extractionStrategy: 'paired-current-native-role-pages+complete-declared-pdf-descriptions+literal-own-pdf-country',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'logelite.com',
    verifiedOn: '2026-11-06',
    verifiedSurfaceSummary:
      'Current official careers cards and own role pages declare six complete native two-page PDF descriptions. Literal own PDF location labels, full criteria, employment and experience labels, original bytes and paired closing models are retained. Applications, complete company scope and cleanup remain unverified.',
    dryRunFile: 'logelite/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Logelite old city-only card fixtures and body-only reads cannot authorize native India extraction', async () => {
  const logelite = await loadScriptModule()

  assert.equal(logelite.hasOfficialCareersSignal(careersHtml), false)

  await assert.rejects(logelite.run({
    fetchText: async () => careersHtml,
    now: () => '2026-08-03T00:00:00.000Z',
  }), /HTTP response metadata required/)
})
