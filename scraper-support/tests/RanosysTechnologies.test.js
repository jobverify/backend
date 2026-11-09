import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/ranosys/provider.js')
  } catch {
    assert.fail('Expected Ranosys Technologies provider module at ../../scraper/ranosys/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ranosys/script.js')
  } catch {
    assert.fail('Expected Ranosys Technologies scraper module at ../../scraper/ranosys/script.js')
  }
}

const landingHtml = `
  <html>
    <head>
      <title>Careers at Ranosys | IT Software Jobs in US, India (Jaipur), Singapore</title>
    </head>
    <body>
      <h2>Ranosys - Your next career destination</h2>
      <a class="elementor-button" href="/global/about-us/career/current-openings/">CURRENT OPENINGS</a>
      <a class="elementor-button" href="/global/about-us/career/recruitment-drives/">RECRUITMENT DRIVES</a>
    </body>
  </html>
`

const openingsHtml = `
  <html>
    <head>
      <title>Current Openings in Singapore, UK, USA &amp; UAE</title>
      <link rel="canonical" href="https://www.ranosys.com/global/about-us/career/current-openings/" />
    </head>
    <body>
      <div class="job-search-wrapper"><input type="text" placeholder="See all open positions" id="job-search"></div>
      <div class="current-opening-section">
        <table>
          <tbody>
            <tr data-title="Software Engineer - Salesforce">
              <td class="views-field views-field-title is-active">
                <a href="https://www.ranosys.com/global/about-us/career/current-openings/sfdc-se-jobs">Software Engineer - Salesforce </a>
              </td>
              <td class="views-field views-field-field-job-experience">1 - 3 years</td>
              <td class="views-field views-field-field-job-location-new-1">Jaipur</td>
              <td class="views-field views-field-nothing"><a href="https://www.ranosys.com/global/about-us/career/current-openings/sfdc-se-jobs" class="apply-btn">More Details</a></td>
            </tr>
            <tr data-title="Software Engineer - SFCC">
              <td class="views-field views-field-title is-active">
                <a href="https://www.ranosys.com/global/about-us/career/current-openings/sfcc-developer-jobs">Software Engineer - SFCC </a>
              </td>
              <td class="views-field views-field-field-job-experience">1 - 3 years</td>
              <td class="views-field views-field-field-job-location-new-1">Jaipur, Remote</td>
              <td class="views-field views-field-nothing"><a href="https://www.ranosys.com/global/about-us/career/current-openings/sfcc-developer-jobs" class="apply-btn">More Details</a></td>
            </tr>
            <tr data-title="QA Engineer - Salesforce">
              <td class="views-field views-field-title is-active">
                <a href="https://www.ranosys.com/global/about-us/career/current-openings/sf-quality-analyst-job">QA Engineer - Salesforce </a>
              </td>
              <td class="views-field views-field-field-job-experience">1 - 3 years</td>
              <td class="views-field views-field-field-job-location-new-1">Jaipur</td>
              <td class="views-field views-field-nothing"><a href="https://www.ranosys.com/global/about-us/career/current-openings/sf-quality-analyst-job" class="apply-btn">More Details</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
  </html>
`

test('Ranosys Technologies exports local provider metadata for the verified first-party current openings page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'ranosys',
    companyName: 'Ranosys Technologies',
    officialBrandName: 'Ranosys',
    adapter: 'script',
    modulePath: '../../scraper/ranosys/script.js',
    homepageUrl: 'https://www.ranosys.com/index.php/career/',
    companyCareerPage: 'https://www.ranosys.com/global/about-us/career/current-openings/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-current-openings-table',
    extractionStrategy: 'verified-first-party-career-landing+verified-global-current-openings-table',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'ranosys.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.ranosys.com/index.php/career/ is the live first-party Ranosys career landing page and that its Current Openings CTA leads to the first-party table at https://www.ranosys.com/global/about-us/career/current-openings/, which lists India openings in Jaipur such as Software Engineer - Salesforce and QA Engineer - Salesforce.',
    dryRunFile: 'ranosys/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Ranosys Technologies parses the first-party current openings table', async () => {
  const ranosys = await loadScriptModule()

  assert.equal(ranosys.hasOfficialCareerLandingSignal(landingHtml), true)
  assert.equal(ranosys.hasOfficialCurrentOpeningsSignal(openingsHtml), true)

  const jobs = await ranosys.run({
    fetchText: async (url) => {
      if (url === ranosys.LANDING_URL) return landingHtml
      if (url === ranosys.CAREERS_URL) return openingsHtml
      throw new Error(`Unexpected Ranosys URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Software Engineer - Salesforce', 'Software Engineer - SFCC', 'QA Engineer - Salesforce'],
  )
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[0].city, 'Jaipur')
  assert.equal(jobs[0].country, 'India')
})
