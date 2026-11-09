import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Cybersecurity-NXXT</title>
      <link href="index.html" rel="canonical" />
    </head>
    <body>
      <header>
        <nav>
          <a href="index.html">Home</a>
          <a href="cloud-security.html">Cloud Security</a>
          <a href="managed-security-services.html">Managed Security Services</a>
          <a href="security-operations-centre.html">Security Operations Centre</a>
          <a href="operational-technology.html">Operational Technology</a>
          <a href="vapt-red-teaming.html">VAPT/ RED Teaming</a>
          <a href="governance-risk-and-compliance-solutions.html">Governance, Risk, and Compliance Solutions</a>
          <a href="identity-and-access-management.html">Identity and Access Management</a>
          <a href="compliance-and-regulatory-consulting.html">Compliance and Regulatory Consulting</a>
          <a href="#nxxt-form">Get Started</a>
        </nav>
      </header>
      <main>
        <h1>Look Beyond The Obvious</h1>
        <p>with Cybersecurity NxxT</p>
        <p>At Cybersecurity Nxxt, we pride ourselves as proactive problem solvers.</p>
        <p>
          While our primary focus is on providing next-gen cybersecurity solutions, we are equally
          committed to nurturing talent and fostering opportunities at every level.
        </p>
        <p>Diversity is key to our team, and we actively promote inclusive career development initiatives.</p>
      </main>
      <footer>
        <p>Cybersecurity NXXT Pvt. Ltd. B1 Block, Ground Floor, Rathinam Technical Campus, Eachanari, Coimbatore - 641021, India.</p>
        <p>Copyright ©2024 Cybersecurity-NXXT. All rights reserved.</p>
      </footer>
    </body>
  </html>
`

const missingSurfaceHtml = `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
      <title>404 - File or directory not found.</title>
    </head>
    <body>
      <h2>404 - File or directory not found.</h2>
      <h3>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</h3>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Cybersecurity-NxxT scraper module at ./script.js')
  }
}

test('Cybersecurity-NxxT recognizes the verified first-party no-public-careers surface', async () => {
  const cybersecurityNxxt = await loadModule()

  assert.equal(cybersecurityNxxt.SOURCE, 'cybersecuritynxxt')
  assert.equal(cybersecurityNxxt.COMPANY, 'Cybersecurity-NxxT')
  assert.equal(cybersecurityNxxt.HOMEPAGE_URL, 'https://cybersecurity-nxxt.com/')
  assert.equal(cybersecurityNxxt.ROBOTS_URL, 'https://cybersecurity-nxxt.com/robots.txt')
  assert.equal(cybersecurityNxxt.SITEMAP_URL, 'https://cybersecurity-nxxt.com/sitemap.xml')
  assert.deepEqual(cybersecurityNxxt.CAREERS_ROUTE_URLS, [
    'https://cybersecurity-nxxt.com/careers',
    'https://cybersecurity-nxxt.com/career',
    'https://cybersecurity-nxxt.com/jobs',
    'https://cybersecurity-nxxt.com/career.html',
    'https://cybersecurity-nxxt.com/careers.html',
    'https://cybersecurity-nxxt.com/jobs.html',
    'https://cybersecurity-nxxt.com/career-opportunities.html',
    'https://cybersecurity-nxxt.com/current-openings.html',
    'https://cybersecurity-nxxt.com/open-positions.html',
  ])

  assert.equal(cybersecurityNxxt.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cybersecurityNxxt.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(cybersecurityNxxt.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    cybersecurityNxxt.isVerifiedMissingPublicSurface({
      status: 404,
      url: 'https://cybersecurity-nxxt.com/careers',
      html: missingSurfaceHtml,
    }),
    true,
  )
})

test('Cybersecurity-NxxT returns no jobs while the verified public surface exposes no careers board', async () => {
  const cybersecurityNxxt = await loadModule()
  const requestedUrls = []
  const missingSurfaceUrls = [
    cybersecurityNxxt.ROBOTS_URL,
    cybersecurityNxxt.SITEMAP_URL,
    ...cybersecurityNxxt.CAREERS_ROUTE_URLS,
  ]

  const jobs = await cybersecurityNxxt.createCybersecurityNxxtScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === cybersecurityNxxt.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (missingSurfaceUrls.includes(url)) {
        return { status: 404, url, html: missingSurfaceHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cybersecurityNxxt.HOMEPAGE_URL,
    cybersecurityNxxt.ROBOTS_URL,
    cybersecurityNxxt.SITEMAP_URL,
    ...cybersecurityNxxt.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Cybersecurity-NxxT fails closed when the homepage drifts into a public jobs surface', async () => {
  const cybersecurityNxxt = await loadModule()

  await assert.rejects(
    cybersecurityNxxt.createCybersecurityNxxtScraper().run({
      fetchPage: async (url) => {
        if (url === cybersecurityNxxt.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              '</nav>',
              '<a href="/careers">Careers</a></nav>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers path/i,
  )
})

test('Cybersecurity-NxxT fails closed when a verified no-public surface starts exposing openings', async () => {
  const cybersecurityNxxt = await loadModule()

  await assert.rejects(
    cybersecurityNxxt.createCybersecurityNxxtScraper().run({
      fetchPage: async (url) => {
        if (url === cybersecurityNxxt.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === cybersecurityNxxt.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: '<urlset><url><loc>https://cybersecurity-nxxt.com/careers</loc></url></urlset>',
          }
        }

        if (url === cybersecurityNxxt.ROBOTS_URL) {
          return { status: 404, url, html: missingSurfaceHtml }
        }

        if (cybersecurityNxxt.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingSurfaceHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap surface no longer matches the verified no-public-careers baseline/i,
  )

  await assert.rejects(
    cybersecurityNxxt.createCybersecurityNxxtScraper().run({
      fetchPage: async (url) => {
        if (url === cybersecurityNxxt.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === cybersecurityNxxt.ROBOTS_URL || url === cybersecurityNxxt.SITEMAP_URL) {
          return { status: 404, url, html: missingSurfaceHtml }
        }

        if (url === cybersecurityNxxt.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current openings</h1><p>Apply now</p></body></html>',
          }
        }

        if (cybersecurityNxxt.CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingSurfaceHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
