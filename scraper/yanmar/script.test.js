import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>YANMAR</h1>
        <p>Our Philosophy</p>
        <p>YANMAR GREEN CHALLENGE 2050</p>
        <a href="https://www.yanmar.com/global/about/">About Us</a>
        <a href="https://www.yanmar.com/global/career/jobs/">Search Jobs</a>
      </main>
      <footer>Copyright © YANMAR HOLDINGS CO., LTD. All rights reserved.</footer>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>About Us</h1>
        <h2>Engineering a Better Society</h2>
        <p>Our brand statement, “A SUSTAINABLE FUTURE,” encapsulates our goal of realizing a sustainable society where people coexist with nature.</p>
        <p>Group Companies (Worldwide)</p>
      </main>
      <footer>Copyright © YANMAR HOLDINGS CO., LTD. All rights reserved.</footer>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Career</h1>
        <p>Discover a world of career possibilities at Yanmar Group.</p>
        <p>Message from CHRO</p>
        <a href="https://www.yanmar.com/global/career/jobs/">Search Jobs</a>
      </main>
      <footer>Copyright © YANMAR HOLDINGS CO., LTD. All rights reserved.</footer>
    </body>
  </html>
`

const jobsHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Search Jobs</h1>
        <p>Find Your Career Opportunity</p>
        <nav>
          <a href="https://www.yanmar.com/global/career/">Career</a>
          <a href="https://www.yanmar.com/global/career/jobs/">Search Jobs</a>
        </nav>
      </main>
      <footer>Copyright © YANMAR HOLDINGS CO., LTD. All rights reserved.</footer>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Dealer Locator</h2>
        <p>For products, parts, service and more, please contact your nearest YANMAR dealer.</p>
        <h2>FAQ</h2>
        <h2>Contact Form</h2>
        <p>Fields marked Required must be filled in. Then click "Confirm" to register your inquiry.</p>
        <p>Company Company Name</p>
        <p>Phone Required OK</p>
      </main>
      <footer>Copyright © YANMAR HOLDINGS CO., LTD. All rights reserved.</footer>
    </body>
  </html>
`

test('YANMAR sentinel validates the verified homepage, about, career, jobs, and contact pages without a public jobs surface', async () => {
  const yanmar = await loadModule()
  assert.ok(yanmar, 'YANMAR scraper module should load')

  assert.equal(yanmar.SOURCE, 'yanmar')
  assert.equal(yanmar.COMPANY, 'YANMAR')
  assert.equal(yanmar.HOMEPAGE_URL, 'https://www.yanmar.com/global/')
  assert.equal(yanmar.ABOUT_URL, 'https://www.yanmar.com/global/about/')
  assert.equal(yanmar.CAREERS_URL, 'https://www.yanmar.com/global/career/')
  assert.equal(yanmar.JOBS_URL, 'https://www.yanmar.com/global/career/jobs/')
  assert.equal(yanmar.CONTACT_URL, 'https://www.yanmar.com/global/support/contact/form/')
  assert.equal(yanmar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(yanmar.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(yanmar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(yanmar.hasOfficialJobsSignal(jobsHtml), true)
  assert.equal(yanmar.hasOfficialContactSignal(contactHtml), true)
  assert.equal(yanmar.hasPublicJobsSignal(jobsHtml), false)
})

test('YANMAR run returns an empty list while Search Jobs exposes no public job records or apply surface', async () => {
  const yanmar = await loadModule()
  assert.ok(yanmar, 'YANMAR scraper module should load')

  const requestedUrls = []
  const jobs = await yanmar.createYanmarScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === yanmar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === yanmar.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === yanmar.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === yanmar.JOBS_URL) return { status: 200, url, html: jobsHtml }
      if (url === yanmar.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected YANMAR URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.yanmar.com/global/',
    'https://www.yanmar.com/global/about/',
    'https://www.yanmar.com/global/career/',
    'https://www.yanmar.com/global/career/jobs/',
    'https://www.yanmar.com/global/support/contact/form/',
  ])
  assert.deepEqual(jobs, [])
})

test('YANMAR fails closed when a trusted page changes materially or the jobs page starts exposing public job links', async () => {
  const yanmar = await loadModule()
  assert.ok(yanmar, 'YANMAR scraper module should load')

  await assert.rejects(
    yanmar.createYanmarScraper().run({
      fetchPage: async () => ({ status: 200, url: 'https://www.yanmar.com/global/', html: '<html><body><h1>Unexpected homepage</h1></body></html>' }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    yanmar.createYanmarScraper().run({
      fetchPage: async (url) => {
        if (url === yanmar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === yanmar.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === yanmar.CAREERS_URL) return { status: 200, url, html: careersHtml }
        return { status: 200, url, html: '<html><body><h1>Unexpected jobs page</h1></body></html>' }
      },
    }),
    /verified jobs page/i,
  )

  await assert.rejects(
    yanmar.createYanmarScraper().run({
      fetchPage: async (url) => {
        if (url === yanmar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === yanmar.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === yanmar.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === yanmar.CONTACT_URL) return { status: 200, url, html: contactHtml }
        return {
          status: 200,
          url,
          html: jobsHtml.replace(
            '</main>',
            '<a href="https://jobs.jobvite.com/yanmar/job/o123">Apply Now</a></main>',
          ),
        }
      },
    }),
    /now appears to expose a direct public jobs surface/i,
  )
})
