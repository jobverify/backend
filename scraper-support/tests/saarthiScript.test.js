import assert from 'node:assert/strict'
import test from 'node:test'

const ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Saarthi - AI Career Coach for Freshers</title>
  </head>
  <body>
    <nav>
      <a href="/explore">Explore</a>
      <a href="/students">Students</a>
      <a href="/employers">Employers</a>
      <a href="/colleges">Colleges</a>
      <a href="/jobs">Jobs</a>
      <a href="/drives">Drives</a>
      <a href="/blog">Blog</a>
    </nav>
    <h1>About Us</h1>
    <h2>Saarthi — AI Career Coach for Early Talent</h2>
    <p>We built Saarthi because finding your first job is unnecessarily painful.</p>
    <p>Saarthi tracks 15,000+ companies every day and pulls together every fresher job, walk-in drive, and off-campus opportunity we can find.</p>
    <p>India's fresher job app — connecting students to fresher jobs, internships, off campus drives, and hybrid opportunities across India.</p>
    <footer>
      <a href="/contact">Contact Us</a>
      <a href="/campus-ambassador">Become Campus Ambassador</a>
      <p>© Copyright 2026, All Rights Reserved by SAARTHI</p>
    </footer>
  </body>
</html>
`

const HOMEPAGE_MARKETPLACE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Saarthi — Best App for Fresher Jobs & Internships in India</title>
  </head>
  <body>
    <h1>Land Your First Fresher Job or Internship in India</h1>
    <p>Saarthi brings every fresher job in India, internship, off campus drive, and hybrid opportunity to one place.</p>
    <p>10,000+ students have already found fresher jobs and internships using Saarthi.</p>
    <p>10,000+ verified jobs · IT & Non-IT roles · Remote + Hybrid + On-site · Off campus drives · Pan India</p>
    <h2>Latest Jobs</h2>
    <article><h3>SLB Data Scientist</h3><p>SLB · Pune</p></article>
    <article><h3>Intern Masters Software Eng</h3><p>Honeywell International · Patancheru</p></article>
    <article><h3>Kerendia Task Force</h3><p>Bayer · Mumbai</p></article>
    <h2>Latest Drives</h2>
    <article><h3>American Chase Off Campus Drive 2026 – Associate System Engineer</h3></article>
    <article><h3>NielsenIQ Off Campus Drive 2026 – Data Operations Analyst</h3></article>
    <article><h3>IndiaMART Off Campus Drive 2026: Associate Engineer</h3></article>
    <p>No Fake Listings. No Ghost Jobs. Ever.</p>
    <p>Every job, internship, and off campus drive on Saarthi is manually verified.</p>
    <p>From Fortune 500 MNCs to fast-growing Indian startups — these companies are actively hiring freshers.</p>
  </body>
</html>
`

const COMPANY_HIRING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Saarthi</title>
  </head>
  <body>
    <h1>Join Saarthi</h1>
    <h2>Current Openings</h2>
    <article>
      <h3>Founding Growth Associate</h3>
      <p>Work at Saarthi and help build the future of fresher hiring.</p>
    </article>
  </body>
</html>
`

const CURRENT_ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Saarthi - AI Career Coach for Freshers</title>
  </head>
  <body>
    <nav>
      <a href="/explore">Explore</a>
      <a href="/students">Students</a>
      <a href="/employers">Employers</a>
      <a href="/colleges">Colleges</a>
      <a href="/jobs">Jobs</a>
      <a href="/drives">Drives</a>
      <a href="/blog">Blog</a>
    </nav>
    <h1>About Us</h1>
    <h2>🎯 Saarthi — AI Career Coach for Early Talent</h2>
    <p>We built Saarthi because finding your first job is unnecessarily painful.</p>
    <p>Saarthi tracks 15,000+ companies every day and pulls together every fresher job, walk-in drive, and off-campus opportunity we can find, including the ones that never make it to LinkedIn or Naukri.</p>
    <p>We put deadlines on everything so you don’t find out about a drive the day after it closed.</p>
    <footer>
      <a href="/campus-ambassador">Become Campus Ambassador</a>
    </footer>
  </body>
</html>
`

const CURRENT_MARKETPLACE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Saarthi — Best App for Fresher Jobs &amp; Internships in India</title>
  </head>
  <body>
    <h1>Land Your First Fresher Job or Internship in India — Without Stress</h1>
    <p>Saarthi brings every fresher job in India, internship, off campus drive, and hybrid opportunity to one place — for IT and non-IT graduates from the 2024, 2025 &amp; 2026 batch.</p>
    <p>10,000+ students have already found fresher jobs and internships using Saarthi.</p>
    <p>10,000+ verified jobs · IT &amp; Non-IT roles · Remote + Hybrid + On-site · Off campus drives · Pan India</p>
    <h2>The Struggle is Real</h2>
    <h2>No Fake Listings. No Ghost Jobs. Ever.</h2>
    <h3>Remote Internships</h3>
    <h3>Off Campus Drives</h3>
    <h3>Walk-in Interviews</h3>
    <h3>IT Fresher Jobs</h3>
    <h2>AI Resume Builder That Beats ATS</h2>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/saarthi/script.js')
  } catch {
    assert.fail('Expected Saarthi scraper module at ../../scraper/saarthi/script.js')
  }
}

test('Saarthi sentinel helpers stay pinned to the verified official about page and third-party marketplace surface', async () => {
  const saarthi = await loadScriptModule()

  assert.equal(saarthi.SOURCE, 'saarthi')
  assert.equal(saarthi.COMPANY, 'Saarthi')
  assert.equal(saarthi.OFFICIAL_BRAND_NAME, 'Saarthi')
  assert.equal(saarthi.VERIFIED_ON, '2026-07-17')
  assert.equal(saarthi.HOMEPAGE_URL, 'https://www.joinsaarthi.com/')
  assert.equal(saarthi.ABOUT_URL, 'https://joinsaarthi.com/about')
  assert.equal(saarthi.PUBLIC_MARKETPLACE_URL, 'https://www.joinsaarthi.com/')
  assert.equal(saarthi.hasOfficialAboutPageSignal(ABOUT_PAGE_HTML), true)
  assert.equal(saarthi.hasOfficialMarketplaceSignal(HOMEPAGE_MARKETPLACE_HTML), true)
  assert.equal(saarthi.hasThirdPartyMarketplaceSignal(HOMEPAGE_MARKETPLACE_HTML), true)
  assert.equal(saarthi.hasExactCompanyHiringSignal(ABOUT_PAGE_HTML), false)
  assert.equal(saarthi.hasExactCompanyHiringSignal(HOMEPAGE_MARKETPLACE_HTML), false)
  assert.equal(saarthi.hasExactCompanyHiringSignal(COMPANY_HIRING_HTML), true)
})

test('Saarthi accepts the current about-page messaging and marketplace positioning', async () => {
  const saarthi = await loadScriptModule()

  assert.equal(saarthi.hasOfficialAboutPageSignal(CURRENT_ABOUT_PAGE_HTML), true)
  assert.equal(saarthi.hasOfficialMarketplaceSignal(CURRENT_MARKETPLACE_HTML), true)
  assert.equal(saarthi.hasThirdPartyMarketplaceSignal(CURRENT_MARKETPLACE_HTML), true)
})

test('Saarthi returns [] only while the exact-name first-party surface remains a third-party fresher-jobs marketplace', async () => {
  const saarthi = await loadScriptModule()
  const requestedUrls = []

  const jobs = await saarthi.createSaarthiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === saarthi.ABOUT_URL) return ABOUT_PAGE_HTML
      if (url === saarthi.PUBLIC_MARKETPLACE_URL) return HOMEPAGE_MARKETPLACE_HTML
      throw new Error(`Unexpected Saarthi URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    saarthi.ABOUT_URL,
    saarthi.PUBLIC_MARKETPLACE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Saarthi fails closed when the verified official surface drifts or starts exposing Saarthi hiring directly', async () => {
  const saarthi = await loadScriptModule()

  await assert.rejects(
    saarthi.createSaarthiScraper().run({
      fetchText: async (url) => {
        if (url === saarthi.ABOUT_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        return HOMEPAGE_MARKETPLACE_HTML
      },
    }),
    /verified official about page/i,
  )

  await assert.rejects(
    saarthi.createSaarthiScraper().run({
      fetchText: async (url) => {
        if (url === saarthi.ABOUT_URL) return ABOUT_PAGE_HTML
        return '<html><body><h1>Unexpected marketplace</h1></body></html>'
      },
    }),
    /verified marketplace surface/i,
  )

  await assert.rejects(
    saarthi.createSaarthiScraper().run({
      fetchText: async () => COMPANY_HIRING_HTML,
    }),
    /surface now appears to expose Saarthi jobs/i,
  )
})
