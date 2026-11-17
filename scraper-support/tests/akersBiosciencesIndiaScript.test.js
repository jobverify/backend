import assert from 'node:assert/strict'
import test from 'node:test'

const parkedDomainHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>AkersBiosciences.com is for sale | HugeDomains</title>
  </head>
  <body>
    <h1>AkersBiosciences.com is for sale</h1>
    <p>HugeDomains helps you secure premium domains.</p>
    <a href="https://www.hugedomains.com/domain_profile.cfm?d=akersbiosciences.com">Buy now</a>
  </body>
</html>
`

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Akers Bio | Biotechnology Research, Life Sciences & Innovation</title></head>
  <body>
    <nav>About Products Technology and R&amp;D Investor Center News Contact Us</nav>
    <main>
      <h1>Akers Bio</h1>
      <p>Biotechnology Research, Life Sciences &amp; Innovation</p>
      <p>Akers Biosciences, Inc.</p>
    </main>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <head><title>Contact Us - Akers Biosciences, Inc.</title></head>
  <body>
    <nav>About Products Technology and R&amp;D Investor Center</nav>
    <main><h1>Contact Us</h1><p>Akers Biosciences, Inc.</p></main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>http://www.akersbio.com</loc></url>
  <url><loc>http://www.akersbio.com/about/company-overview</loc></url>
  <url><loc>http://www.akersbio.com/products</loc></url>
  <url><loc>http://www.akersbio.com/contact-us</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html>
  <head><title>404 Not Found</title></head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
    <address>Apache/2.4.58 (Ubuntu) Server at www.akersbio.com Port 80</address>
  </body>
</html>
`

const loadAkersModule = async () => {
  try {
    return await import('../../scraper/akersbiosciencesindia/script.js')
  } catch {
    assert.fail('Expected Akers Biosciences India scraper module at ../../scraper/akersbiosciencesindia/script.js')
  }
}

test('Akers Biosciences India sentinel pins the parked exact-name domain, live official host, and missing jobs routes', async () => {
  const akers = await loadAkersModule()

  assert.equal(akers.SOURCE, 'akersbiosciencesindia')
  assert.equal(akers.COMPANY, 'Akers Biosciences India')
  assert.equal(akers.OFFICIAL_BRAND_NAME, 'Akers Biosciences')
  assert.equal(akers.PARKED_EXACT_NAME_URL, 'https://akersbiosciences.com/')
  assert.deepEqual(akers.PARKED_ROUTE_URLS, [
    'https://akersbiosciences.com/',
    'https://akersbiosciences.com/careers',
    'https://akersbiosciences.com/jobs',
  ])
  assert.equal(akers.OFFICIAL_HOST_URL, 'https://akersbio.com/')
  assert.deepEqual(akers.OFFICIAL_SURFACE_URLS, [
    'https://akersbio.com/',
    'https://akersbio.com/sitemap.xml',
    'https://akersbio.com/contact-us',
  ])
  assert.deepEqual(akers.MISSING_JOB_ROUTE_URLS, [
    'https://akersbio.com/careers',
    'https://akersbio.com/jobs',
    'https://akersbio.com/openings',
  ])

  assert.match(akers.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(akers.hasVerifiedParkedSurface(parkedDomainHtml), true)
  assert.equal(akers.hasPublicJobsSignal(parkedDomainHtml), false)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/', html: officialHomepageHtml }), true)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/contact-us', html: contactPageHtml }), true)
  assert.equal(akers.hasVerifiedOfficialSurface({ status: 200, url: 'https://www.akersbio.com/sitemap.xml', html: sitemapXml }), true)
  assert.equal(akers.isMissingJobRoute({ status: 404, url: 'https://www.akersbio.com/careers', html: missingRouteHtml }), true)
  assert.equal(
    akers.hasPublicJobsSignal('<html><body><h1>Current Openings</h1><a href="https://jobs.lever.co/akers">Apply now</a></body></html>'),
    true,
  )
})


test('Akers current runtime refuses metadata-free historical callbacks before I/O', async () => {
 const akers=await loadAkersModule();let calls=0
 await assert.rejects(akers.run({fetchPage:async()=>{calls++;return{status:200,html:parkedDomainHtml}}}),/metadata|unsupported/i);assert.equal(calls,0)
})
test('Akers current configured-source transport failure remains exact with no HTTP downgrade or parked fallback',async()=>{
 const akers=await loadAkersModule(),reason=Object.assign(new Error('fetch failed'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}}),urls=[]
 await assert.rejects(akers.run({requestIntervalMs:0,fetchImpl:async url=>{urls.push(url);throw reason}}),error=>error===reason);assert.deepEqual(urls,['https://akersbio.com/'])
})
test('Akers newly accessible but unreviewed configured publisher cannot become company zero',async()=>{
 const akers=await loadAkersModule();let calls=0
 await assert.rejects(akers.run({requestIntervalMs:0,fetchImpl:async url=>{calls++;const r=new Response(officialHomepageHtml,{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),/newly accessible|not been verified/i);assert.equal(calls,1)
})
