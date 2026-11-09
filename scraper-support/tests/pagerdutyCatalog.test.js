import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pagerduty/catalog.js')
  } catch {
    assert.fail('Expected PagerDuty catalog module at ../../scraper/pagerduty/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pagerduty/script.js')
  } catch {
    assert.fail('Expected PagerDuty scraper module at ../../scraper/pagerduty/script.js')
  }
}

test('getScraperCatalog includes PagerDuty as a verified first-party script provider', async () => {
  const { PAGERDUTY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'pagerduty')

  assert.equal(defaultCatalog, PAGERDUTY_CATALOG)
  assert.ok(provider, 'Expected PagerDuty provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PagerDuty')
  assert.equal(provider.officialBrandName, 'PagerDuty')
  assert.equal(provider.companyCareerPage, 'https://careers.pagerduty.com/jobs/search')
  assert.equal(provider.companyDomain, 'careers.pagerduty.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-open-roles-page-current-empty-india-slice')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-open-roles-page+inline-role-table+return-empty-when-no-india-locations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /pagerduty[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pagerduty[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.pagerduty\.com\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /\b18 role rows\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India locations/i)
})

test('PagerDuty scraper parses the verified first-party role table and returns an empty India slice', async () => {
  const pagerDuty = await loadScriptModule()
  const html = `
    <html>
      <head><title>PagerDuty Open Roles</title></head>
      <body>
        <h1>We're Hiring!</h1>
        <section>
          <h4>Category</h4>
          <div>Customer Success (4 items)</div>
          <div>IT (1 items)</div>
          <div>Product Development (2 items)</div>
          <div>Sales (11 items)</div>
          <h4>Country</h4>
          <div>Canada (1 items)</div>
          <div>Chile (1 items)</div>
          <div>Singapore (1 items)</div>
          <div>United Kingdom (1 items)</div>
          <div>United States (14 items)</div>
        </section>
        <p>Search by job title, location, department, category, etc.</p>
        <table>
          <thead>
            <tr><th>Title</th><th>Category</th><th>Location</th><th>Remote</th></tr>
          </thead>
          <tbody>
            <tr><td>Strategic Customer Success Manager</td><td>Customer Success</td><td>Singapore</td><td>Remote</td></tr>
            <tr><td>Sales Strategy and Operations Manager</td><td>Sales</td><td>San Francisco, California, United States</td><td></td></tr>
            <tr><td>Senior Principal Customer Success Manager</td><td>Customer Success</td><td>Los Angeles, California, United States</td><td>Remote</td></tr>
            <tr><td>Senior Solutions Consultant</td><td>Sales</td><td>San Francisco, California, United States</td><td></td></tr>
            <tr><td>Enterprise Account Executive, London</td><td>Sales</td><td>London, England, United Kingdom</td><td></td></tr>
            <tr><td>Account Manager (US)</td><td>Sales</td><td>United States</td><td>Remote</td></tr>
            <tr><td>Account Executive (US)</td><td>Sales</td><td>United States</td><td>Remote</td></tr>
            <tr><td>Territory Executive (US)</td><td>Sales</td><td>United States</td><td>Remote</td></tr>
            <tr><td>Federal Account Executive, FSI</td><td>Sales</td><td>Washington, District of Columbia, United States</td><td>Remote</td></tr>
            <tr><td>Enterprise Account Executive, Chicago</td><td>Sales</td><td>United States</td><td>Remote</td></tr>
            <tr><td>Account Manager- DC</td><td>Customer Success</td><td>United States</td><td>Remote</td></tr>
            <tr><td>Enterprise Account Executive (New York)</td><td>Sales</td><td>New York, United States</td><td>Remote</td></tr>
            <tr><td>Account Manager - New York</td><td>Customer Success</td><td>New York, United States</td><td>Remote</td></tr>
            <tr><td>Senior Product Manager</td><td>Product Development</td><td>Toronto, Ontario, Canada</td><td></td></tr>
            <tr><td>Senior Product Manager</td><td>Product Development</td><td>Atlanta, Georgia, United States</td><td></td></tr>
            <tr><td>Salesforce Developer</td><td>IT</td><td>Santiago, Santiago Metropolitan Region, Chile</td><td></td></tr>
            <tr><td>Business Development Representative - SF</td><td>Sales</td><td>San Francisco, California, United States</td><td></td></tr>
            <tr><td>Business Development Representative - ATL</td><td>Sales</td><td>Atlanta, Georgia, United States</td><td></td></tr>
          </tbody>
        </table>
        <p>Displaying all 18 entries</p>
      </body>
    </html>
  `

  assert.equal(pagerDuty.hasVerifiedCareersPageSignal(html), true)

  const roles = pagerDuty.extractRoleSummaries(html)
  assert.equal(roles.length, 18)
  assert.deepEqual(roles[0], {
    title: 'Strategic Customer Success Manager',
    department: 'Customer Success',
    location: 'Singapore',
    remote: true,
  })
  assert.deepEqual(roles.at(-1), {
    title: 'Business Development Representative - ATL',
    department: 'Sales',
    location: 'Atlanta, Georgia, United States',
    remote: false,
  })
  assert.equal(pagerDuty.hasIndiaRole(roles), false)

  const jobs = await pagerDuty.createPagerDutyScraper().run({
    fetchText: async (url) => {
      assert.equal(url, 'https://careers.pagerduty.com/jobs/search')
      return html
    },
  })

  assert.deepEqual(jobs, [])
})

test('PagerDuty backlog row matches directly from the local provider metadata without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PagerDuty\n',
    catalog: getScraperCatalog(),
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PagerDuty', 'pagerduty', 'PagerDuty']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'pagerduty')

  assert.ok(scraper, 'Expected buildScrapers() to return the PagerDuty scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pagerduty')
  assert.match(scraper.dryRunFile, /pagerduty[\\/]jobs\.json$/i)
})
