import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/avglogistics/test-data/current-public-20261103.json.gz',import.meta.url))))
const currentCorporateHTML=()=>currentPublicFixture().responses[0].body
import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Avg Logistics || Green Logistics || Transforming Supply Chains with Tomorrow’s Tech. </title>
  </head>
  <body>
    <header>
      <nav>
        <a href="https://avglogistics.com/about">About AVG</a>
        <a href="https://avglogistics.com/careers">Career at AVG</a>
        <a href="https://avglogistics.com/contact">Contact</a>
      </nav>
    </header>
    <main>
      <h1>Transforming Supply Chains with Tomorrow’s Tech.</h1>
      <p>AVG Logistics Limited is the Gateway to Multimodal &amp; Green Logistics Solutions.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Avg Logistics || Green Logistics || Transforming Supply Chains with Tomorrow’s Tech. </title>
  </head>
  <body>
    <main>
      <section>
        <h2>Careers</h2>
        <li>Careers</li>
        <h4>Join Us</h4>
        <h2>Explore your Future <br> at <span> AVG</span></h2>
        <p>
          Joining AVG Logistics means embarking on a rewarding career in the dynamic logistics
          industry.
        </p>
        <p>Opportunity to work in diverse roles which are challenging and interesting.</p>
      </section>
      <div class="container">
        <div class="footer-one--two__cta-inner">
          <div class="text-box">
            <h2>Easily apply to multiple jobs with one click !</h2>
          </div>
        </div>
      </div>
      <div class="container py-5">
        <div class="row g-4">
          <!-- Six job cards -->
        </div>
      </div>
      <footer>
        <a href="mailto:info@avglogistics.com">info@avglogistics.com</a>
        <a href="mailto:support@avglogistics.com">support@avglogistics.com</a>
      </footer>
    </main>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow:
Sitemap: https://www.avglogistics.com/sitemap.xml
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://avglogistics.com/</loc></url>
  <url><loc>https://avglogistics.com/careers</loc></url>
  <url><loc>https://avglogistics.com/contact</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Page Not Found</title>
  </head>
  <body>
    <h1>404 Page Not Found</h1>
    <p>The page you are looking for could not be found.</p>
  </body>
</html>
`

const operationalPortalHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>AVG Logistics Limited.</title>
</head>
<body>
  <form method="post" action="./" id="form1">
    <input name="txtUser" type="text" id="txtUser" placeholder="Enter username" />
    <input name="txtPass" type="password" id="txtPass" placeholder="Enter password" />
    <input name="txtCaptch" type="text" id="txtCaptch" placeholder="Enter Captcha" />
    <img id="Image2" src="Captcha.aspx" height="55" width="186" />
    <input type="submit" name="btnLogin" value="Login" id="btnLogin" />
    <a href="ParcelTrack.aspx" target="_blank"> Track Your Parcel</a>
  </form>
</body>
</html>
`

const operationalPortal404Html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
  <title>404 - File or directory not found.</title>
</head>
<body>
  <div id="header"><h1>Server Error</h1></div>
  <div id="content">
    <h2>404 - File or directory not found.</h2>
    <h3>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</h3>
  </div>
</body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AVG Logistics Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Operations Manager"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <div class="job-card">
        <a href="https://avglogistics.com/jobs/operations-manager">View Details</a>
        <a href="https://avglogistics.com/jobs/operations-manager/apply">Apply Now</a>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/avglogistics/script.js')
  } catch {
    assert.fail('Expected AVG Logistics scraper module at ../../scraper/avglogistics/script.js')
  }
}

test('AVG legacy observation helpers preserve surface identities without granting native empty authority', async () => {
  const avgLogistics = await loadModule()

  assert.equal(avgLogistics.SOURCE, 'avglogistics')
  assert.equal(avgLogistics.COMPANY, 'AVG Logistics')
  assert.equal(avgLogistics.OFFICIAL_BRAND_NAME, 'AVG Logistics Limited')
  assert.equal(avgLogistics.VERIFIED_AT, null)
  assert.equal(avgLogistics.HOMEPAGE_URL, 'https://avglogistics.com/')
  assert.equal(avgLogistics.CAREERS_URL, 'https://avglogistics.com/careers')
  assert.equal(avgLogistics.ROBOTS_TXT_URL, 'https://avglogistics.com/robots.txt')
  assert.equal(avgLogistics.SITEMAP_URL, 'https://www.avglogistics.com/sitemap.xml')
  assert.deepEqual(avgLogistics.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://avglogistics.com/jobs',
    'https://avglogistics.com/job',
    'https://avglogistics.com/current-openings',
    'https://avglogistics.com/openings',
    'https://avglogistics.com/work-with-us',
    'https://avglogistics.com/join-us',
  ])
  assert.equal(avgLogistics.OPERATIONS_PORTAL_URL, 'https://avglogistics.in/')
  assert.equal(avgLogistics.OPERATIONS_PORTAL_CAREERS_URL, 'https://avglogistics.in/careers')
  assert.match(avgLogistics.VERIFIED_SURFACE_SUMMARY, /native vacancy model.*unknown/i)

  assert.equal(avgLogistics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(avgLogistics.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(avgLogistics.hasVerifiedEmptyJobsSection(careersHtml), false)
  assert.equal(avgLogistics.hasUnqualifiedEmptyJobsSection(careersHtml), true)
  assert.equal(avgLogistics.pageExposesPublicJobListings(careersHtml), false)
  assert.equal(avgLogistics.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(avgLogistics.hasExpectedRobotsTxtSignal(robotsTxt), true)
  assert.deepEqual(avgLogistics.extractSitemapUrls(sitemapXml), [
    'https://avglogistics.com/',
    'https://avglogistics.com/careers',
    'https://avglogistics.com/contact',
  ])
  assert.equal(avgLogistics.hasExpectedSitemapSignal(sitemapXml), true)
  assert.equal(avgLogistics.hasOperationalPortalSignal(operationalPortalHtml), true)
  assert.equal(
    avgLogistics.hasVerified404Route(
      {
        status: 404,
        url: 'https://avglogistics.com/jobs',
        html: notFoundHtml,
      },
      'https://avglogistics.com/jobs',
    ),
    true,
  )
  assert.equal(
    avgLogistics.hasOperationalPortal404(
      {
        status: 404,
        url: 'https://avglogistics.in/careers',
        html: operationalPortal404Html,
      },
      'https://avglogistics.in/careers',
    ),
    true,
  )
})

test("AVG current configured panel records unknown totals without guessed routes or private operational prerequisites", async () => {
 const avg=await loadModule(),calls=[];let audit
 const jobs=await avg.run({fetchPage:async url=>{calls.push(url);assert.equal(url,avg.CAREERS_URL);return{url,status:200,html:currentCorporateHTML()}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[avg.CAREERS_URL,avg.CAREERS_URL]);assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.advertisedJobRow.observedElementCount,0);assert.equal(audit.advertisedJobRow.nativeVacancyCount,null)
})

test("AVG current source holds wrong employer, newly public native vacancies and closing panel changes", async () => {
 const avg=await loadModule(),original=currentCorporateHTML(),withJob=original.replace('<!-- Six job cards -->','<article class="job-card"><h2>Operations Manager</h2><a href="/jobs/operations-manager">View Details</a></article>');assert.notEqual(withJob,original)
 for(const html of[original.replaceAll('AVG','OtherBrand').replaceAll('Avg','OtherBrand'),withJob])await assert.rejects(avg.run({fetchPage:async url=>({url,status:200,html})}),/binding changed|vacancy.*collector/)
 let reads=0;await assert.rejects(avg.run({fetchPage:async url=>({url,status:200,html:++reads===1?original:withJob})}),/vacancy.*collector|closing.*changed/)
})
