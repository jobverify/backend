import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Buy Gold & Lab Grown Diamond Jewellery | Silver Jewellery - GIVA</title>
  </head>
  <body>
    <section>
      <h2>Quick links</h2>
      <a href="/pages/careers">Join Us</a>
    </section>
    <section>
      <h2>Contact us</h2>
      <p>Indiejewel Fashions Private Limited</p>
      <p>Third Floor, Magnum Vista, Raghuvanahalli, Bangalore 560062</p>
    </section>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Buy Gold &amp; Lab Grown Diamond Jewellery | Silver Jewellery &ndash; GIVA</title>
  </head>
  <body>
    <section>
      <h2>Quick links</h2>
      <a href="/pages/careers">Join Us</a>
    </section>
    <section>
      <h2>Contact us</h2>
      <p>Indiejewel Fashions Private Limited</p>
      <p>Third Floor, Magnum Vista, Raghuvanahalli, Bangalore 560062</p>
    </section>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at GIVA | Explore Job Opportunities & Join Our Team - GIVA</title>
  </head>
  <body>
    <section>
      <h2>Why GIVA?</h2>
      <p>Hear from the #GemsofGIVA</p>
      <p>Indiejewel Fashions Private Limited</p>
      <a href="/pages/about-us">About Us</a>
    </section>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at GIVA | Explore Job Opportunities &amp; Join Our Team &ndash; GIVA</title>
  </head>
  <body>
    <section>
      <h2>Why GIVA?</h2>
      <p>Hear from the #GemsofGIVA</p>
      <p>Indiejewel Fashions Private Limited</p>
      <a href="/pages/about-us">About Us</a>
    </section>
  </body>
</html>
`

const loadGivaModule = async () => {
  try {
    return await import('../../scraper/giva/script.js')
  } catch {
    assert.fail('Expected GIVA scraper module at ../../scraper/giva/script.js')
  }
}

test('GIVA sentinel constants stay pinned to the verified homepage and careers shell contract', async () => {
  const giva = await loadGivaModule()

  assert.equal(giva.SOURCE, 'giva')
  assert.equal(giva.COMPANY, 'GIVA')
  assert.equal(giva.OFFICIAL_BRAND_NAME, 'GIVA Jewellery')
  assert.equal(giva.HOMEPAGE_URL, 'https://www.giva.co/')
  assert.equal(giva.CAREERS_URL, 'https://www.giva.co/pages/careers')
  assert.equal(giva.COMPANY_DOMAIN, 'giva.co')
  assert.equal(giva.ATS_PLATFORM, 'official-company-site-no-public-careers')
  assert.equal(giva.COUNTRY_FILTER, 'India')
  assert.equal(giva.VERIFIED_ON, '2026-07-16')
  assert.match(giva.VERIFIED_SURFACE_SUMMARY, /Join Us/i)
  assert.equal(giva.hasVerifiedGivaHomepageSignals(homepageHtml), true)
  assert.equal(giva.hasVerifiedGivaHomepageSignals(currentHomepageHtml), true)
  assert.equal(giva.hasVerifiedGivaCareersSignals(careersHtml), true)
  assert.equal(giva.hasVerifiedGivaCareersSignals(currentCareersHtml), true)
  assert.equal(giva.hasPublicGivaJobSignals(careersHtml), false)
  assert.equal(
    giva.hasPublicGivaJobSignals(
      careersHtml.replace(
        '</section>',
        '<a href="/pages/careers/senior-buyer">Apply Now</a></section>',
      ),
    ),
    true,
  )
})

test('GIVA returns [] only while the verified careers page stays a non-listing shell', async () => {
  const giva = await loadGivaModule()
  const requestedUrls = []

  const jobs = await giva.createGivaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === giva.HOMEPAGE_URL) return homepageHtml
      if (url === giva.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected GIVA URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    giva.HOMEPAGE_URL,
    giva.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('GIVA fails closed when the homepage or careers shell drifts into a public jobs surface', async () => {
  const giva = await loadGivaModule()

  await assert.rejects(
    giva.createGivaScraper().run({
      fetchText: async (url) => {
        if (url === giva.HOMEPAGE_URL) return homepageHtml.replace('Join Us', 'Careers soon')
        if (url === giva.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected GIVA URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    giva.createGivaScraper().run({
      fetchText: async (url) => {
        if (url === giva.HOMEPAGE_URL) return homepageHtml
        if (url === giva.CAREERS_URL) {
          return careersHtml.replace(
            '</section>',
            '<a href="/pages/careers/senior-buyer">Apply Now</a></section>',
          )
        }
        throw new Error(`Unexpected GIVA URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
