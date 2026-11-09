import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kapiva - Buy Modern Ayurvedic Products Online for Complete Nutrition</title>
  </head>
  <body>
    <section>
      <p>Verify pincode for accurate delivery</p>
      <p>Kapiva is a company of Adret Retail Private Limited</p>
      <p>1800-274-2575</p>
      <p>info@kapiva.in</p>
      <a href="/about-us/">ABOUT US</a>
      <a href="/contact-us/">CONTACT US</a>
    </section>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Ayurveda Products for Healthy Life | Kapiva |</title>
  </head>
  <body>
    <section>
      <h1>ABOUT US</h1>
      <p>Kapiva tri-dosha synergy is an ever growing family of Ayurvedic experts, nutritionist, food scientists and curious minds like you.</p>
      <p>Your simple guide to everyday Ayurveda</p>
    </section>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Kapiva | Get in Touch With Us</title>
  </head>
  <body>
    <section>
      <h1>CONTACT US</h1>
      <p>For openings and collaboration:</p>
      <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="5c3f3d2e39392e2f1c373d2c352a3d723532">[email&#160;protected]</a>
      <p>For bulk orders and business:</p>
      <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="394a58555c4a79525849504f58175057">[email&#160;protected]</a>
    </section>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/careers/senior-brand-manager">Current Openings</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Senior Brand Manager" }
    </script>
  </body>
</html>
`

const loadKapivaModule = async () => {
  try {
    return await import('../../scraper/kapiva/script.js')
  } catch {
    assert.fail('Expected Kapiva scraper module at ../../scraper/kapiva/script.js')
  }
}

test('Kapiva pins the verified homepage, about page, and contact-page sentinel surfaces', async () => {
  const kapiva = await loadKapivaModule()

  assert.equal(kapiva.SOURCE, 'kapiva')
  assert.equal(kapiva.COMPANY_NAME, 'Kapiva')
  assert.equal(kapiva.OFFICIAL_BRAND_NAME, 'Kapiva')
  assert.equal(kapiva.HOMEPAGE_URL, 'https://kapiva.in/')
  assert.equal(kapiva.ABOUT_PAGE_URL, 'https://kapiva.in/about-us/')
  assert.equal(kapiva.CONTACT_PAGE_URL, 'https://kapiva.in/contact-us/')
  assert.equal(kapiva.VERIFIED_ON, '2026-10-08')
  assert.equal(kapiva.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(kapiva.hasVerifiedAboutPageSignal(aboutHtml), true)
  assert.equal(kapiva.hasVerifiedContactPageSignal(contactHtml), true)
  assert.equal(kapiva.hasPublicJobSignals(homepageHtml), false)
  assert.equal(kapiva.hasPublicJobSignals(aboutHtml), false)
  assert.equal(kapiva.hasPublicJobSignals(contactHtml), false)
  assert.equal(kapiva.hasPublicJobSignals(publicJobsHtml), true)
})

test('Kapiva returns [] only while the verified official surfaces remain non-listing commerce and contact pages', async () => {
  const kapiva = await loadKapivaModule()
  const requestedUrls = []

  const jobs = await kapiva.createKapivaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === kapiva.HOMEPAGE_URL) return homepageHtml
      if (url === kapiva.ABOUT_PAGE_URL) return aboutHtml
      if (url === kapiva.CONTACT_PAGE_URL) return contactHtml
      throw new Error(`Unexpected Kapiva URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://kapiva.in/',
    'https://kapiva.in/about-us/',
    'https://kapiva.in/contact-us/',
  ])
  assert.deepEqual(jobs, [])
})

test('Kapiva fails closed when the verified pages drift or a public jobs surface appears', async () => {
  const kapiva = await loadKapivaModule()

  await assert.rejects(
    kapiva.createKapivaScraper().run({
      fetchText: async (url) => {
        if (url === kapiva.HOMEPAGE_URL) {
          return homepageHtml.replace('Kapiva is a company of Adret Retail Private Limited', 'Kapiva wellness storefront')
        }
        if (url === kapiva.ABOUT_PAGE_URL) return aboutHtml
        if (url === kapiva.CONTACT_PAGE_URL) return contactHtml
        throw new Error(`Unexpected Kapiva URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    kapiva.createKapivaScraper().run({
      fetchText: async (url) => {
        if (url === kapiva.HOMEPAGE_URL) return homepageHtml
        if (url === kapiva.ABOUT_PAGE_URL) return aboutHtml
        if (url === kapiva.CONTACT_PAGE_URL) return publicJobsHtml
        throw new Error(`Unexpected Kapiva URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})


test('Kapiva accepts its current verified science-backed about page while retaining the non-listing contact route', async () => {
  const kapiva = await loadKapivaModule()
  const { readFile } = await import('node:fs/promises')
  const currentAbout = await readFile(new URL('./fixtures/kapiva/about-current.html', import.meta.url), 'utf8')
  const jobs = await kapiva.run({
    fetchText: async (url) => url === kapiva.HOMEPAGE_URL ? homepageHtml
      : url === kapiva.ABOUT_PAGE_URL ? currentAbout : contactHtml,
  })
  assert.deepEqual(jobs, [])
  assert.equal(kapiva.hasVerifiedAboutPageSignal(currentAbout.replace('https://kapiva.in/about-us/', 'https://unrelated.example/about-us/')), false)
  assert.equal(kapiva.hasVerifiedAboutPageSignal(currentAbout.replace('Science-backed Ayurveda. And we can prove it.', 'Unrelated product copy')), false)
  assert.equal(kapiva.hasVerifiedAboutPageSignal(currentAbout.replace('Kapiva is a company of Adret Retail Private Limited', 'Unrelated company')), false)
})
