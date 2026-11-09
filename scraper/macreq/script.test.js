import assert from 'node:assert/strict'
import test from 'node:test'

const loadMacreqModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Macreq Manufacturing</title>
  </head>
  <body>
    <main>
      <h1>Macreq Manufacturing</h1>
      <a href="https://macreq.com/about-us/">About Us</a>
      <a href="https://macreq.com/contact-us/">Contact Us</a>
      <a href="https://macreq.com/careers/">Careers</a>
      <a href="mailto:support@macreq.com">support@macreq.com</a>
      <a href="tel:+914223500608">+91 422 3500608</a>
      <a href="https://www.linkedin.com/company/macreq-manufacturing-services-pvt-ltd">LinkedIn</a>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>About Us &#8211; Macreq Manufacturing</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Macreq Manufacturing helps customers and vendors work together more efficiently.</p>
      <a href="https://macreq.com/contact-us/">Contact Us</a>
      <a href="mailto:support@macreq.com">support@macreq.com</a>
      <a href="https://www.linkedin.com/company/macreq-manufacturing-services-pvt-ltd">LinkedIn</a>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us &#8211; Macreq Manufacturing</title>
  </head>
  <body>
    <main>
      <h1>Contact Company</h1>
      <a href="mailto:support@macreq.com">support@macreq.com</a>
      <a href="tel:+914223500608">+91 422 3500608</a>
      <a href="tel:+919600949900">+91 96009 49900</a>
      <a href="https://maps.app.goo.gl/5q5h7iiybXQhgEEs5">Coimbatore</a>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Privacy Policy &#8211; Macreq Manufacturing</title>
  </head>
  <body>
    <main>
      <h1>Privacy Policy</h1>
      <p>Macreq Manufacturing respects your privacy.</p>
      <a href="mailto:support@macreq.com">support@macreq.com</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers &#8211; Macreq Manufacturing</title>
    <link rel="canonical" href="https://macreq.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Join the Macreq Revolution!</h2>
      <p>At Macreq, we are more than just a manufacturing marketplace.</p>
      <h2>Open Positions Across All Departments!</h2>
      <h2>Apply Now!</h2>
      <p>Ready to embark on a transformative journey with Macreq? Fill out the form below and take the first step towards a rewarding career.</p>
      <form action="/careers/#wpcf7-f15147-p7462-o1" method="post" enctype="multipart/form-data">
        <input type="text" name="ctc_name" />
        <input type="tel" name="ctc_tel" />
        <input type="email" name="ctc_email" />
        <textarea name="ctc_message"></textarea>
        <input type="file" name="your-cv" accept=".docx,.pdf,.jpeg" />
        <button type="submit">SUBMIT</button>
      </form>
      <a href="mailto:support@macreq.com">support@macreq.com</a>
    </main>
  </body>
</html>
`

const publicJobsCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers &#8211; Macreq Manufacturing</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Current Openings</h2>
      <a href="/careers/senior-buyer/">Senior Buyer</a>
      <a href="/careers/qa-engineer/">QA Engineer</a>
    </main>
  </body>
</html>
`

const pageSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://macreq.com/</loc></url>
  <url><loc>https://macreq.com/contact-us/</loc></url>
  <url><loc>https://macreq.com/about-us/</loc></url>
  <url><loc>https://macreq.com/careers/</loc></url>
  <url><loc>https://macreq.com/privacy-policy/</loc></url>
</urlset>
`

const careerAliasPage = {
  status: 200,
  url: 'https://macreq.com/careers/',
  html: careersHtml,
}

const missingCareerRoutePage = {
  status: 404,
  url: 'https://macreq.com/jobs/',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head><title>404 Not Found</title></head>
      <body><h1>404 Not Found</h1></body>
    </html>
  `,
}

test('Macreq sentinel recognizes the verified first-party pages, career alias, page sitemap, and apply-only zero-jobs careers surface', async () => {
  const macreq = await loadMacreqModule()
  assert.ok(macreq, 'Expected scraper module at ./script.js')

  assert.equal(macreq.SOURCE, 'macreq')
  assert.equal(macreq.COMPANY, 'Macreq Manufacturing Services Private Ltd')
  assert.equal(macreq.HOMEPAGE_URL, 'https://macreq.com/')
  assert.equal(macreq.ABOUT_URL, 'https://macreq.com/about-us/')
  assert.equal(macreq.CONTACT_URL, 'https://macreq.com/contact-us/')
  assert.equal(macreq.PRIVACY_URL, 'https://macreq.com/privacy-policy/')
  assert.equal(macreq.CAREERS_URL, 'https://macreq.com/careers/')
  assert.equal(macreq.CAREER_ALIAS_URL, 'https://macreq.com/career/')
  assert.equal(macreq.PAGE_SITEMAP_URL, 'https://macreq.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(macreq.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://macreq.com/jobs/',
    'https://macreq.com/job/',
    'https://macreq.com/join-us/',
    'https://macreq.com/work-with-us/',
  ])
  assert.equal(macreq.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(macreq.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(macreq.hasOfficialContactSignal(contactHtml), true)
  assert.equal(macreq.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(macreq.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(macreq.hasZeroJobsApplyOnlySignal(careersHtml), true)
  assert.equal(macreq.hasVerifiedCareerAlias(careerAliasPage), true)
  assert.equal(macreq.pageSitemapHasExpectedCoreUrls(pageSitemapXml), true)
  assert.equal(macreq.pageSitemapHasUnexpectedCareerLikeUrl(pageSitemapXml), false)
  assert.equal(macreq.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('Macreq sentinel returns no jobs while the official careers page remains apply-only and the verified routes stay stable', async () => {
  const macreq = await loadMacreqModule()
  assert.ok(macreq, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await macreq.createMacreqScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === macreq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === macreq.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === macreq.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === macreq.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
      if (url === macreq.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === macreq.CAREER_ALIAS_URL) return careerAliasPage
      if (url === macreq.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (macreq.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    macreq.HOMEPAGE_URL,
    macreq.ABOUT_URL,
    macreq.CONTACT_URL,
    macreq.PRIVACY_URL,
    macreq.CAREERS_URL,
    macreq.CAREER_ALIAS_URL,
    macreq.PAGE_SITEMAP_URL,
    ...macreq.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Macreq sentinel fails closed when public jobs appear or the verified route contract drifts', async () => {
  const macreq = await loadMacreqModule()
  assert.ok(macreq, 'Expected scraper module at ./script.js')

  await assert.rejects(
    macreq.createMacreqScraper().run({
      fetchPage: async (url) => {
        if (url === macreq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === macreq.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === macreq.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === macreq.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === macreq.CAREERS_URL) return { status: 200, url, html: publicJobsCareersHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page|public job/i,
  )

  await assert.rejects(
    macreq.createMacreqScraper().run({
      fetchPage: async (url) => {
        if (url === macreq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === macreq.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === macreq.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === macreq.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === macreq.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === macreq.CAREER_ALIAS_URL) return { status: 404, url, html: missingCareerRoutePage.html }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career alias/i,
  )

  await assert.rejects(
    macreq.createMacreqScraper().run({
      fetchPage: async (url) => {
        if (url === macreq.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === macreq.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === macreq.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === macreq.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === macreq.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === macreq.CAREER_ALIAS_URL) return careerAliasPage
        if (url === macreq.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace('</urlset>', '<url><loc>https://macreq.com/jobs/</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )
})
