import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const loadPowerToSolutionsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialSearchRss = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0">
  <channel>
    <title>Bing: "Power to Solutions"</title>
    <link>http://www.bing.com:80/search?q=%22Power+to+Solutions%22</link>
    <description>Search results</description>
    <item>
      <title>Sign in | Microsoft Power BI</title>
      <link>https://app.powerbi.com/home</link>
      <description>Sign in to Microsoft Power BI for intuitive data visualization, detailed analytics, and interactive dashboards. Unlock your data's full potential.</description>
      <pubDate>Sat, 11 Jul 2026 23:14:00 GMT</pubDate>
    </item>
    <item>
      <title>Power (physics) - Wikipedia</title>
      <link>https://en.wikipedia.org/wiki/Power_(physics)</link>
      <description>Power is the rate with respect to time at which work is done or, more generally, the rate of change of total mechanical energy.</description>
      <pubDate>Sat, 11 Jul 2026 21:55:00 GMT</pubDate>
    </item>
    <item>
      <title>National Power Portal | India</title>
      <link>https://npp.gov.in/</link>
      <description>NPP is a unified system for Indian Power Sector.</description>
      <pubDate>Sun, 12 Jul 2026 19:59:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`

const careersSearchRss = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0">
  <channel>
    <title>Bing: "Power to Solutions" careers</title>
    <link>http://www.bing.com:80/search?q=%22Power+to+Solutions%22+careers</link>
    <description>Search results</description>
    <item>
      <title>Sign in | Microsoft Power BI</title>
      <link>https://app.powerbi.com/home</link>
      <description>Sign in to Microsoft Power BI for intuitive data visualization, detailed analytics, and interactive dashboards. Unlock your data's full potential.</description>
      <pubDate>Sat, 11 Jul 2026 23:14:00 GMT</pubDate>
    </item>
    <item>
      <title>Power (physics) - Wikipedia</title>
      <link>https://en.wikipedia.org/wiki/Power_(physics)</link>
      <description>Power is the rate with respect to time at which work is done or, more generally, the rate of change of total mechanical energy.</description>
      <pubDate>Sat, 11 Jul 2026 21:55:00 GMT</pubDate>
    </item>
    <item>
      <title>National Power Portal | India</title>
      <link>https://npp.gov.in/</link>
      <description>NPP is a unified system for Indian Power Sector.</description>
      <pubDate>Sun, 12 Jul 2026 19:59:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`

const companyAppearsSearchRss = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0">
  <channel>
    <title>Bing: "Power to Solutions"</title>
    <link>http://www.bing.com:80/search?q=%22Power+to+Solutions%22</link>
    <description>Search results</description>
    <item>
      <title>Power to Solutions | Careers</title>
      <link>https://www.powertosolutions.example/careers</link>
      <description>Join Power to Solutions and explore current openings.</description>
      <pubDate>Sun, 13 Jul 2026 04:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`

const domainChecks = [
  {
    url: 'https://powertosolutions.com/',
    ok: false,
    status: null,
    finalUrl: null,
    error: 'getaddrinfo ENOTFOUND powertosolutions.com',
  },
  {
    url: 'https://powertosolutions.in/',
    ok: false,
    status: null,
    finalUrl: null,
    error: 'getaddrinfo ENOTFOUND powertosolutions.in',
  },
  {
    url: 'https://powertosolutions.co.in/',
    ok: false,
    status: null,
    finalUrl: null,
    error: 'getaddrinfo ENOTFOUND powertosolutions.co.in',
  },
  {
    url: 'https://power2solutions.com/',
    ok: false,
    status: null,
    finalUrl: null,
    error: 'getaddrinfo ENOTFOUND power2solutions.com',
  },
]

const resolvableDomainChecks = [
  {
    url: 'https://powertosolutions.com/',
    ok: true,
    status: 200,
    finalUrl: 'https://powertosolutions.com/',
    error: null,
  },
]

test('Power to Solutions sentinel locks the verified no-surface evidence from 2026-07-13', async () => {
  const powerToSolutions = await loadPowerToSolutionsModule()
  assert.ok(powerToSolutions, 'Expected Power to Solutions scraper module at ./script.js')

  assert.equal(powerToSolutions.SOURCE, 'powertosolutions')
  assert.equal(powerToSolutions.COMPANY, 'Power to Solutions')
  assert.deepEqual(powerToSolutions.CANDIDATE_DOMAIN_URLS, [
    'https://powertosolutions.com/',
    'https://powertosolutions.in/',
    'https://powertosolutions.co.in/',
    'https://power2solutions.com/',
  ])
  assert.equal(powerToSolutions.SEARCH_SURFACES.company, 'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22')
  assert.equal(powerToSolutions.SEARCH_SURFACES.careers, 'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22+careers')
  assert.equal(powerToSolutions.hasResolvableOfficialDomain(domainChecks), false)
  assert.equal(powerToSolutions.hasResolvableOfficialDomain(resolvableDomainChecks), true)
  assert.equal(powerToSolutions.hasCompanySurfaceSignal(officialSearchRss), false)
  assert.equal(powerToSolutions.hasCompanySurfaceSignal(careersSearchRss), false)
  assert.equal(powerToSolutions.hasCompanySurfaceSignal(companyAppearsSearchRss), true)
})

test('run returns an empty list only while Power to Solutions still has no trustworthy public first-party surface', async () => {
  const powerToSolutions = await loadPowerToSolutionsModule()
  assert.ok(powerToSolutions, 'Expected Power to Solutions scraper module at ./script.js')

  const requests = []
  const jobs = await powerToSolutions.createPowerToSolutionsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    verifyDomain: async (url) => {
      requests.push(url)
      return domainChecks.find((entry) => entry.url === url)
    },
    fetchSearchFeed: async (url) => {
      requests.push(url)
      if (url === powerToSolutions.SEARCH_SURFACES.company) {
        return officialSearchRss
      }
      if (url === powerToSolutions.SEARCH_SURFACES.careers) {
        return careersSearchRss
      }
      throw new Error(`Unexpected search feed URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    ...powerToSolutions.CANDIDATE_DOMAIN_URLS,
    powerToSolutions.SEARCH_SURFACES.company,
    powerToSolutions.SEARCH_SURFACES.careers,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(
    readInventoryEvidence(jobs)?.reason,
    'power-to-solutions-no-resolvable-first-party-or-careers-surface',
  )
})

test('run fails closed when a likely first-party domain resolves or search starts surfacing the company', async () => {
  const powerToSolutions = await loadPowerToSolutionsModule()
  assert.ok(powerToSolutions, 'Expected Power to Solutions scraper module at ./script.js')

  await assert.rejects(
    powerToSolutions.createPowerToSolutionsScraper().run({
      verifyDomain: async (url) =>
        resolvableDomainChecks.find((entry) => entry.url === url)
        || domainChecks.find((entry) => entry.url === url),
      fetchSearchFeed: async () => officialSearchRss,
    }),
    /candidate first-party domain now resolves/i,
  )

  await assert.rejects(
    powerToSolutions.createPowerToSolutionsScraper().run({
      verifyDomain: async (url) => domainChecks.find((entry) => entry.url === url),
      fetchSearchFeed: async (url) => {
        if (url === powerToSolutions.SEARCH_SURFACES.company) {
          return companyAppearsSearchRss
        }
        return careersSearchRss
      },
    }),
    /public company surface changed/i,
  )

  await assert.rejects(
    powerToSolutions.createPowerToSolutionsScraper().run({
      verifyDomain: async (url) => domainChecks.find((entry) => entry.url === url),
      fetchSearchFeed: async (url) => {
        if (url === powerToSolutions.SEARCH_SURFACES.company) {
          return officialSearchRss
        }
        return '<html><body>not rss</body></html>'
      },
    }),
    /careers search feed no longer matches/i,
  )
})
