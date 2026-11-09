import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected The ENERGY COMPANY scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>The Intelligent Storage Layer | The Energy Company</title>
      <meta
        name="description"
        content="The Energy Company builds intelligent battery infrastructure for India. Storage that pays for itself, fleets that don't stop, and batteries that talk back."
      />
    </head>
    <body>
      <a href="/we-are-hiring">Careers</a>
      <a href="/about-us">About Us</a>
      <a href="/contact-us">Contact Us</a>
      <script type="application/ld+json">
        {"@type":"Organization","name":"The Energy Company","sameAs":["https://www.linkedin.com/company/theenergycompany/?originalSubdomain=in"]}
      </script>
      <footer>The Energy Company</footer>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>We are hiring</title>
    </head>
    <body>
      <div class="section-tag" style="justify-content:center">Open Roles</div>
      <p>Full-time roles with real scope. Click any role to see what the job actually involves.</p>

      <div class="role-card" id="role-hw">
        <div class="role-card-header">
          <div class="role-card-left">
            <div class="role-dept">Hardware</div>
            <div class="role-title">Hardware Design Engineer</div>
            <div class="role-loc">📍 Bengaluru, KA · Full-time</div>
          </div>
          <div class="role-card-right">
            <a href="https://www.energycompany.in/contact-us" class="role-apply-btn">Apply Now →</a>
          </div>
        </div>
        <div class="role-body">
          <div class="role-body-inner">
            <div class="role-points">
              <div class="role-point">Design and development of digital and analog electronics for power electronics control systems</div>
              <div class="role-point">Start-to-finish ownership of control boards — from specification through prototype to manufacturing</div>
            </div>
            <div class="role-points">
              <div class="role-point">Strong foundation in analog and digital circuit design for power systems</div>
              <div class="role-point">Experience bringing hardware from prototype to production</div>
            </div>
          </div>
        </div>
      </div>

      <div class="role-card" id="role-emb">
        <div class="role-card-header">
          <div class="role-card-left">
            <div class="role-dept">Firmware</div>
            <div class="role-title">Embedded Software Engineer</div>
            <div class="role-loc">📍 Bengaluru, KA · Full-time</div>
          </div>
          <div class="role-card-right">
            <a href="https://www.energycompany.in/contact-us" class="role-apply-btn">Apply Now →</a>
          </div>
        </div>
        <div class="role-body">
          <div class="role-body-inner">
            <div class="role-points">
              <div class="role-point">Understand product CTQs and translate stakeholder requirements into product features</div>
              <div class="role-point">Design hardware abstractions and APIs for peripherals and devices</div>
            </div>
            <div class="role-points">
              <div class="role-point">Deep experience in embedded C/C++ and RTOS environments</div>
              <div class="role-point">Experience with hardware-software co-design workflows</div>
            </div>
          </div>
        </div>
      </div>

      <div class="role-card" id="role-fs">
        <div class="role-card-header">
          <div class="role-card-left">
            <div class="role-dept">Software</div>
            <div class="role-title">Full Stack Developer</div>
            <div class="role-loc">📍 Bengaluru, KA · Full-time</div>
          </div>
          <div class="role-card-right">
            <a href="https://www.energycompany.in/contact-us" class="role-apply-btn">Apply Now →</a>
          </div>
        </div>
        <div class="role-body">
          <div class="role-body-inner">
            <div class="role-points">
              <div class="role-point">Build and maintain applications using .NET Core 6.0 Web API and Angular</div>
              <div class="role-point">Create configuration, build, and test scripts for CI environments</div>
            </div>
            <div class="role-points">
              <div class="role-point">Strong backend skills in .NET Core / C# with structured database experience (MySQL)</div>
              <div class="role-point">Deep knowledge of Angular 6+ and commonly used modules</div>
            </div>
          </div>
        </div>
      </div>

      <div class="role-card" id="role-be">
        <div class="role-card-header">
          <div class="role-card-left">
            <div class="role-dept">Software</div>
            <div class="role-title">Backend Developer</div>
            <div class="role-loc">📍 Bengaluru, KA · Full-time</div>
          </div>
          <div class="role-card-right">
            <a href="https://www.energycompany.in/contact-us" class="role-apply-btn">Apply Now →</a>
          </div>
        </div>
        <div class="role-body">
          <div class="role-body-inner">
            <div class="role-points">
              <div class="role-point">Develop ASP.NET Core web applications and Angular front-ends</div>
              <div class="role-point">Perform coding, bug verification, unit testing and integration testing</div>
            </div>
            <div class="role-points">
              <div class="role-point">2+ years experience with .NET Core and Angular</div>
              <div class="role-point">Experience with MySQL or MS SQL Server</div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const missingRouteHtml = `
  <html>
    <head><title>Not Found</title></head>
    <body>
      <div class="utility-page-content">
        <h2>Page Not Found</h2>
        <div>The page you are looking for doesn't exist or has been moved</div>
      </div>
    </body>
  </html>
`

test('The ENERGY COMPANY scraper validates the verified first-party surface and extracts the public role cards', async () => {
  const scraperModule = await loadModule()

  assert.equal(scraperModule.SOURCE, 'theenergycompany')
  assert.equal(scraperModule.COMPANY, 'The ENERGY COMPANY')
  assert.equal(scraperModule.HOMEPAGE_URL, 'https://www.energycompany.in/')
  assert.equal(scraperModule.CAREERS_URL, 'https://www.energycompany.in/we-are-hiring')
  assert.deepEqual(scraperModule.MISSING_ROUTE_URLS, [
    'https://www.energycompany.in/careers',
    'https://www.energycompany.in/jobs',
  ])

  assert.equal(scraperModule.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraperModule.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(scraperModule.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    scraperModule.isVerifiedMissingRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )

  const listings = scraperModule.extractListings(careersHtml)
  assert.equal(listings.length, 4)
  assert.deepEqual(
    listings.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Hardware Design Engineer',
        department: 'Hardware',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        applyUrl: 'https://www.energycompany.in/contact-us',
      },
      {
        title: 'Embedded Software Engineer',
        department: 'Firmware',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        applyUrl: 'https://www.energycompany.in/contact-us',
      },
      {
        title: 'Full Stack Developer',
        department: 'Software',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        applyUrl: 'https://www.energycompany.in/contact-us',
      },
      {
        title: 'Backend Developer',
        department: 'Software',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        applyUrl: 'https://www.energycompany.in/contact-us',
      },
    ],
  )
  assert.match(
    listings[0].jobDescription,
    /Design and development of digital and analog electronics/i,
  )
  assert.match(
    listings[3].jobDescription,
    /2\+ years experience with \.NET Core and Angular/i,
  )
})

test('The ENERGY COMPANY scraper run() returns decorated jobs from the verified first-party hiring page', async () => {
  const scraperModule = await loadModule()
  const requestedUrls = []

  const jobs = await scraperModule.createTheEnergyCompanyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraperModule.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === scraperModule.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (scraperModule.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraperModule.HOMEPAGE_URL,
    scraperModule.CAREERS_URL,
    ...scraperModule.MISSING_ROUTE_URLS,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'theenergycompany')
  assert.equal(jobs[0].link, 'https://www.energycompany.in/contact-us')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('The ENERGY COMPANY scraper fails closed when the verified first-party surface drifts', async () => {
  const scraperModule = await loadModule()

  await assert.rejects(
    scraperModule.createTheEnergyCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Placeholder</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraperModule.createTheEnergyCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraperModule.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'Hardware Design Engineer',
              'Principal Grid Trader',
            ),
          }
        }

        if (scraperModule.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers surface|expected public roles/i,
  )

  await assert.rejects(
    scraperModule.createTheEnergyCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === scraperModule.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === scraperModule.MISSING_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1></body></html>',
          }
        }

        if (url === scraperModule.MISSING_ROUTE_URLS[1]) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing careers routes changed materially/i,
  )
})
