import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Airbase, a Paylocity Company | Airbase by Paylocity</title>
    <meta name="description" content="Paylocity, a leader in cloud-based HR and payroll software solutions, has completed its acquisition of Airbase Inc.">
  </head>
  <body>
    <a href="https://www.paylocity.com/">Careers</a>
    <img alt="" src="img/airbase-paylocity-wht-1.svg">
    <p>Paylocity for Finance combines our advanced spend management capabilities with Paylocity's robust HCM platform.</p>
    <p>What does this mean for Airbase clients?</p>
    <p>© Airbase Inc. 2025.</p>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Airbase, a Paylocity Company | Airbase by Paylocity</title>
  </head>
  <body>
    <a href="https://www.paylocity.com/">Paylocity</a>
    <p>Paylocity for Finance combines our advanced spend management capabilities with Paylocity&rsquo;s robust HCM platform.</p>
    <p>What does this mean for Airbase clients?</p>
    <p>Airbase Inc.</p>
  </body>
</html>
`

const genericPaylocityCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Paylocity | Paylocity</title>
    <meta name="description" content="Sure, we build great products, but we also want Paylocity to be a great place to work. Join us as we help clients solve problems and shape the future of work.">
    <link rel="canonical" href="//www.paylocity.com/company/careers/">
  </head>
  <body>
    <h1>Careers</h1>
    <p>Sure, we build great products, but we also want Paylocity to be a great place to work.</p>
    <p>Join us as we help clients solve problems and shape the future of work.</p>
    <a href="//www.paylocity.com/company/careers/protect-yourself/">Protect yourself.</a>
  </body>
</html>
`

const paylocityJsShellHtml = `
<!doctype html>
<html lang="en">
  <head></head>
  <body>
    <p>For the best experience, we recommend enabling JavaScript in your browser.</p>
  </body>
</html>
`

const notFoundHtml = `
  <html>
    <head><title>404 Not Found</title></head>
    <body><h1>Not Found</h1></body>
  </html>
`

const loadAirbaseModule = async () => {
  try {
    return await import('../../scraper/airbase/script.js')
  } catch {
    assert.fail('Expected Airbase scraper module at ../../scraper/airbase/script.js')
  }
}

test('Airbase scraper constants stay pinned to the verified acquisition homepage, Paylocity careers redirect, and historical missing routes', async () => {
  const airbase = await loadAirbaseModule()

  assert.equal(airbase.SOURCE, 'airbase')
  assert.equal(airbase.COMPANY, 'Airbase')
  assert.equal(airbase.HOMEPAGE_URL, 'https://www.airbase.com/')
  assert.equal(airbase.CAREERS_ROUTE_URL, 'https://www.airbase.com/careers')
  assert.equal(airbase.PARENT_CAREERS_URL, 'https://www.paylocity.com/company/careers/')
  assert.deepEqual(airbase.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://www.airbase.com/career',
    'https://www.airbase.com/jobs',
    'https://www.airbase.com/join-us',
    'https://www.airbase.com/work-with-us',
    'https://www.airbase.com/openings',
    'https://www.airbase.com/current-openings',
  ])
  assert.equal(airbase.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(airbase.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(airbase.hasGenericParentCareersSignal(genericPaylocityCareersHtml), true)
  assert.equal(airbase.hasGenericParentCareersSignal(paylocityJsShellHtml), false)
  assert.equal(airbase.isMissingCareerRoute({ status: 404, url: airbase.NO_PUBLIC_CAREER_ROUTE_URLS[0] }), true)
})

test('Airbase rejects a JavaScript-only parent response as evidence of no public jobs', async () => {
  const airbase = await loadAirbaseModule()
  await assert.rejects(airbase.createAirbaseScraper().run({fetchPage: async url =>
    url === airbase.HOMEPAGE_URL ? {status:200,url,html:currentHomepageHtml} :
    {status:200,url:airbase.PARENT_CAREERS_URL,html:paylocityJsShellHtml}
  }), /response redirected|corporate careers parent handoff/)
})

test('Airbase rejects missing or conflicting current corporate identity before requesting native roles', async () => {
  const airbase = await loadAirbaseModule()
  await assert.rejects(airbase.createAirbaseScraper().run({fetchPage: async url =>
    ({status:200,url,html:'<html><title>Unexpected</title></html>'})
  }), /current Airbase acquisition homepage/i)
})
