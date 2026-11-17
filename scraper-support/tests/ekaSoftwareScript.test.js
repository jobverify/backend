import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Quoreka | CTRM &amp; ETRM Software for Commodity Trading &amp; Operations</title>
  </head>
  <body>
    <nav>
      <a href="https://quoreka.com/agriculture">Agriculture</a>
      <a href="https://quoreka.com/careers">Careers</a>
      <a href="https://quoreka.com/contact">Contact</a>
    </nav>
    <main>
      <h1>Commodity trading and supply chain control from field to market</h1>
      <p>Discover how we support critical industries with tailored solutions for complex trading, logistics, and supply chain challenges.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Quoreka</title>
    <meta name="description" content="Join Quoreka to be a part of a customer-centric organization committed to innovative and value-driven commodity futures trading software." />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Our Vision</h2>
      <p>With our best in class products, our mission is to be the epicentre of trade by providing solutions for the commodities trade lifecycle.</p>
      <h2>Our Values</h2>
      <p>Join us at Quoreka and help create something extraordinary.</p>
      <h2>Career Benefits</h2>
      <p>Quoreka is a cutting-edge organisation searching for talented people to join our team and take charge of their careers.</p>
    </main>
  </body>
</html>
`

const publicJobsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Quoreka</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Product Manager"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://quoreka.com/careers/senior-product-manager">Senior Product Manager</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://quoreka.com/</loc></url>
  <url><loc>https://quoreka.com/about-us</loc></url>
  <url><loc>https://quoreka.com/careers</loc></url>
  <url><loc>https://quoreka.com/contact</loc></url>
</urlset>
`

const driftedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://quoreka.com/</loc></url>
  <url><loc>https://quoreka.com/careers</loc></url>
  <url><loc>https://quoreka.com/careers/senior-product-manager</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404</title>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
    </main>
  </body>
</html>
`

const loadEkaSoftwareModule = async () => {
  try {
    return await import('../../scraper/ekasoftware/script.js')
  } catch {
    assert.fail('Expected Eka Software scraper module at ../../scraper/ekasoftware/script.js')
  }
}

test('Eka Software scraper constants stay pinned to the verified Quoreka homepage, careers shell, sitemap, and missing job routes', async () => {
  const ekaSoftware = await loadEkaSoftwareModule()

  assert.equal(ekaSoftware.SOURCE, 'ekasoftware')
  assert.equal(ekaSoftware.COMPANY, 'Eka Software')
  assert.equal(ekaSoftware.OFFICIAL_BRAND_NAME, 'Quoreka')
  assert.equal(ekaSoftware.VERIFIED_ON, '2026-07-15')
  assert.equal(ekaSoftware.HOMEPAGE_URL, 'https://quoreka.com/')
  assert.equal(ekaSoftware.CAREERS_PAGE_URL, 'https://quoreka.com/careers')
  assert.equal(ekaSoftware.SITEMAP_URL, 'https://quoreka.com/sitemap.xml')
  assert.deepEqual(ekaSoftware.SITEMAP_CAREER_ROUTE_URLS, ['https://quoreka.com/careers'])
  assert.deepEqual(ekaSoftware.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://quoreka.com/jobs',
    'https://quoreka.com/careers/jobs',
    'https://quoreka.com/openings',
    'https://quoreka.com/join-us',
    'https://quoreka.com/work-with-us',
    'https://quoreka.com/current-openings',
  ])
  assert.match(ekaSoftware.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(ekaSoftware.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    ekaSoftware.extractHomepageCareerUrl(homepageHtml),
    'https://quoreka.com/careers',
  )
  assert.equal(ekaSoftware.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(ekaSoftware.hasExpectedCareerRouteSet(sitemapXml), true)
  assert.equal(ekaSoftware.hasExpectedCareerRouteSet(driftedSitemapXml), false)
  assert.deepEqual(ekaSoftware.extractPublicJobLinks(careersHtml), [])
  assert.deepEqual(ekaSoftware.extractPublicJobLinks(publicJobsCareersHtml), [
    'https://quoreka.com/careers/senior-product-manager',
  ])
  assert.equal(
    ekaSoftware.isVerifiedMissingPublicJobRoute({
      status: 404,
      url: ekaSoftware.NO_PUBLIC_JOB_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Eka legacy body-only sentinel cannot certify current recruitment inventory',async()=>{
 const m=await loadEkaSoftwareModule();let calls=0
 await assert.rejects(m.createEkaSoftwareScraper().run({fetchPage:async url=>{calls++;return {status:url===m.HOMEPAGE_URL||url===m.CAREERS_PAGE_URL||url===m.SITEMAP_URL?200:404,url,html:url===m.HOMEPAGE_URL?homepageHtml:url===m.CAREERS_PAGE_URL?careersHtml:url===m.SITEMAP_URL?sitemapXml:missingRouteHtml}}}),/original HTTP metadata|body-only/i)
 assert.equal(calls,0)
})
test('dated Eka pure sentinel helpers still distinguish a public role and missing route without publishing a company zero',async()=>{
 const m=await loadEkaSoftwareModule();assert.equal(m.hasPublicJobListingSignal(publicJobsCareersHtml),true)
 assert.equal(m.hasOfficialCareersSignal(publicJobsCareersHtml),false)
 assert.equal(m.isVerifiedMissingPublicJobRoute({status:200,url:m.NO_PUBLIC_JOB_ROUTE_URLS[0],html:publicJobsCareersHtml},m.NO_PUBLIC_JOB_ROUTE_URLS[0]),false)
})
