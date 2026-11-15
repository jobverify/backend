import assert from 'node:assert/strict'
import test from 'node:test'
import {replayNative, originalBody} from '../../scraper/dripcapital/fixtures/nativeReplay20261114.js'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Trade Finance Simplified | Drip Capital</title>
    <link rel="canonical" href="https://www.dripcapital.com/">
    <meta
      name="description"
      content="Drip Capital is a Trade Finance company providing collateral-free post-shipment finance to Exporters and Importers with instant approvals and minimal documentation."
    >
  </head>
  <body>
    <main>
      <h1>Trade Finance Simplified</h1>
      <p>Drip Capital is a Trade Finance company providing collateral-free post-shipment finance to Exporters and Importers with instant approvals and minimal documentation.</p>
    </main>
  </body>
</html>
`

const legacyCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">Careers shell</div>
    </div>
  </body>
</html>
`

const indiaCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">India careers shell</div>
    </div>
  </body>
</html>
`

const usCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Join Drip Capital</title>
    <meta name="description" content="Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.">
    <link rel="canonical" href="https://www.dripcapital.com/en-us/careers/">
    <meta property="og:title" content="Careers | Join Drip Capital">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/state.js">
    <link rel="preload" as="script" href="https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js">
  </head>
  <body>
    <div id="__nuxt">
      <div class="shell">US careers shell</div>
    </div>
  </body>
</html>
`

const emptyLegacyPayload = '__NUXT_JSONP__("/careers", {data:[{}],fetch:{},mutations:[]});'
const emptyIndiaPayload = '__NUXT_JSONP__("/en-in/careers", {data:[{}],fetch:{},mutations:[]});'
const emptyUsPayload = '__NUXT_JSONP__("/en-us/careers", {data:[{}],fetch:{},mutations:[]});'

const robotsTxt = `
User-agent: *
Allow: /
Sitemap: https://www.dripcapital.com/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.dripcapital.com/</loc></url>
  <url><loc>https://www.dripcapital.com/en-in/careers/</loc></url>
  <url><loc>https://www.dripcapital.com/about/</loc></url>
</urlset>
`

const sitemapWithPublicJobsXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.dripcapital.com/en-in/careers/</loc></url>
  <url><loc>https://www.dripcapital.com/en-us/careers/software-engineer/</loc></url>
  <url><loc>https://www.dripcapital.com/jobs/data-analyst/</loc></url>
</urlset>
`

const jobs404Html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Current Openings</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/dripcapital/software-engineer">Apply now</a>
  </body>
</html>
`

const loadDripCapitalModule = async () => {
  try {
    return await import('../../scraper/dripcapital/script.js')
  } catch {
    assert.fail('Expected Drip Capital scraper module at ../../scraper/dripcapital/script.js')
  }
}

test('Historical Drip pure surface validators remain available alongside accurate current provider identity', async () => {
  const dripCapital = await loadDripCapitalModule()

  assert.equal(dripCapital.SOURCE, 'dripcapital')
  assert.equal(dripCapital.COMPANY, 'Drip Capital')
  assert.equal(dripCapital.OFFICIAL_BRAND_NAME, 'Drip Capital')
  assert.equal(dripCapital.VERIFIED_ON, '2026-11-14')
  assert.equal(dripCapital.HOMEPAGE_URL, 'https://www.dripcapital.com/')
  assert.equal(dripCapital.CAREERS_PAGE_URL, 'https://www.dripcapital.com/en-in/careers/')
  assert.equal(dripCapital.LEGACY_CAREERS_URL, 'https://www.dripcapital.com/careers/')
  assert.equal(dripCapital.US_CAREERS_URL, 'https://www.dripcapital.com/en-us/careers/')
  assert.equal(
    dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js',
  )
  assert.equal(
    dripCapital.INDIA_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js',
  )
  assert.equal(
    dripCapital.US_CAREERS_PAYLOAD_URL,
    'https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js',
  )
  assert.equal(dripCapital.JOBS_URL, 'https://www.dripcapital.com/jobs')
  assert.equal(dripCapital.ROBOTS_TXT_URL, 'https://www.dripcapital.com/robots.txt')
  assert.equal(dripCapital.SITEMAP_URL, 'https://www.dripcapital.com/sitemap.xml')

  assert.equal(dripCapital.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    dripCapital.hasCareersShellSignal(legacyCareersHtml, {
      routeUrl: dripCapital.LEGACY_CAREERS_URL,
      payloadUrl: dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
      requireTitle: false,
      requireDescription: false,
    }),
    true,
  )
  assert.equal(
    dripCapital.hasCareersShellSignal(indiaCareersHtml, {
      routeUrl: dripCapital.CAREERS_PAGE_URL,
      payloadUrl: dripCapital.INDIA_CAREERS_PAYLOAD_URL,
      requireTitle: false,
      requireDescription: false,
    }),
    true,
  )
  assert.equal(
    dripCapital.hasCareersShellSignal(usCareersHtml, {
      routeUrl: dripCapital.US_CAREERS_URL,
      payloadUrl: dripCapital.US_CAREERS_PAYLOAD_URL,
      expectedTitle: 'Careers | Join Drip Capital',
      expectedDescription:
        'Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.',
      requireTitle: true,
      requireDescription: true,
    }),
    true,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(legacyCareersHtml),
    dripCapital.LEGACY_CAREERS_PAYLOAD_URL,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(indiaCareersHtml),
    dripCapital.INDIA_CAREERS_PAYLOAD_URL,
  )
  assert.equal(
    dripCapital.extractPayloadUrl(usCareersHtml),
    dripCapital.US_CAREERS_PAYLOAD_URL,
  )
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyLegacyPayload, '/careers'), true)
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyIndiaPayload, '/en-in/careers'), true)
  assert.equal(dripCapital.isVerifiedEmptyPayload(emptyUsPayload, '/en-us/careers'), true)
  assert.equal(dripCapital.hasRobotsSitemapSignal(robotsTxt), true)
  assert.deepEqual(dripCapital.extractCareerLikeUrlsFromSitemap(sitemapXml), [
    'https://www.dripcapital.com/en-in/careers/',
  ])
  assert.deepEqual(dripCapital.extractCareerLikeUrlsFromSitemap(sitemapWithPublicJobsXml), [
    'https://www.dripcapital.com/en-in/careers/',
    'https://www.dripcapital.com/en-us/careers/software-engineer/',
    'https://www.dripcapital.com/jobs/data-analyst/',
  ])
  assert.equal(
    dripCapital.isVerifiedJobs404Route({
      status: 404,
      url: dripCapital.JOBS_URL,
      html: jobs404Html,
    }),
    true,
  )
  assert.equal(dripCapital.hasPublicJobsSignal(legacyCareersHtml), false)
  assert.equal(dripCapital.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Drip factory now returns current own-employer India native text with explicit application and company holds', async () => {
  const dripCapital = await loadDripCapitalModule()
  const replay = replayNative()
  const jobs = await dripCapital.createDripCapitalScraper().run({fetchImpl: replay.fetchImpl})
  assert.equal(jobs.length, 4)
  assert.equal(replay.reads.length, 14)
  assert.ok(jobs.every(job => job.country === 'India' && job.companyDomain === 'dripcapital.com' && job.atsPlatform === 'trakstar-hire'))
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceDescriptionHTML.includes('jobdesciption') && job.datePosted === null))
  assert.ok(jobs.every(job => !job.sourceScopeComplete && !job.lifecycleCleanupAllowed && !job.sourceApplicationQualificationComplete && !job.sourceRenderedCriteriaComplete))
  assert.equal(jobs.nativeCollectionEvidence.openingCards.length, 5)
  assert.equal(jobs.nativeCollectionEvidence.explicitOutOfCountryRecords.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.closingRecords.length, 4)
})

test('Drip factory rejects current authority/country/criteria/closing drift and never certifies a historical shell as zero', async () => {
  const dripCapital = await loadDripCapitalModule()
  for (const [requestIndex, before, after] of [
    [0, 'https://dripcapital.recruiterbox.com/#content', 'https://other.recruiterbox.com/#content'],
    [2, 'View 5\n', 'View 0\n'],
    [3, 'meta-job-location-country">India', 'meta-job-location-country">United States'],
    [3, '<div class="jobdesciption">', '<div class="jobdesciption" hidden>'],
    [3, '<div class="jobdesciption">', '<div class="jobdesciption">This role has been filled.'],
    [7, '<div class="jobdesciption">', '<div class="jobdesciption">Changed closing qualification'],
  ]) {
    const replay = replayNative({mutate: reply => {
      if (reply.requestIndex !== requestIndex) return undefined
      const html = reply.raw.toString()
      assert.ok(html.includes(before))
      return Buffer.from(html.replace(before, after))
    }})
    await assert.rejects(dripCapital.createDripCapitalScraper().run({fetchImpl: replay.fetchImpl}), /coverage gap/)
  }
  await assert.rejects(dripCapital.createDripCapitalScraper().run({fetchPage: async url => ({url, status: 200, html: originalBody(0).toString()})}), /complete original manual HTTP Response/)
})
