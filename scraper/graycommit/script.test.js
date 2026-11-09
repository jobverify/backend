import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Graycommit Careers</title>
    </head>
    <body>
      <main>
        <h1>Careers at Graycommit</h1>
        <p>Build AI products with Graycommit.</p>

        <article>
          <h2>GTM Sales Exec - AI</h2>
          <p>Bangalore</p>
          <p>Own outbound AI sales and partnerships for India growth.</p>
          <a href="https://forms.gle/JRRyEqayaV32F3xC7">Apply Now</a>
        </article>

        <article>
          <h2>Founding Engineer</h2>
          <p>San Francisco</p>
          <p>Build full-stack AI systems from zero to one.</p>
          <a href="https://forms.gle/JRRyEqayaV32F3xC7">Apply Now</a>
        </article>

        <article>
          <h2>Founding AI Researcher</h2>
          <p>San Francisco</p>
          <p>Work on frontier model evaluation and productization.</p>
          <a href="https://forms.gle/JRRyEqayaV32F3xC7">Apply Now</a>
        </article>
      </main>
    </body>
  </html>
`

const currentCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Graycommit Stock Radar - AI Market Intelligence</title>
    </head>
    <body>
      <nav>
        <a href="/careers">Careers</a>
      </nav>
      <main>
        <h1>Join Our Team</h1>
        <section id="open-positions">
          <h2>Open Positions</h2>
          <p>Ready to join our mission? Check out our current openings below.</p>

          <div class="job-card">
            <div class="job-card__header">
              <div>
                <h3>GTM Sales Exec - AI</h3>
                <div class="job-meta">
                  <div>Sales</div>
                  <div><span class="icon-map-pin"></span>Bangalore</div>
                  <div>Full-time</div>
                </div>
              </div>
              <a href="https://forms.gle/JRRyEqayaV32F3xC7">
                <button>Apply Now</button>
              </a>
            </div>
            <p>Drive revenue growth by selling our AI-powered sales platform to enterprise customers and building strategic partnerships.</p>
          </div>

          <div class="job-card">
            <div class="job-card__header">
              <div>
                <h3>Founding Engineer</h3>
                <div class="job-meta">
                  <div>Engineering</div>
                  <div><span class="icon-map-pin"></span>San Francisco</div>
                  <div>Full-time</div>
                </div>
              </div>
              <a href="https://forms.gle/JRRyEqayaV32F3xC7">
                <button>Apply Now</button>
              </a>
            </div>
            <p>Build full-stack AI systems from zero to one.</p>
          </div>
        </section>
      </main>
    </body>
  </html>
`

const currentShellHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Graycommit</title>
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
      <!-- Use static rendering with Expo Router to support running without JavaScript. -->
      <script src="/_expo/static/js/web/entry-215fea92581564a9c3e940efb96ccdb8.js" defer></script>
    </body>
  </html>
`

const currentShellBundleText = `
  globalThis.__appConfig = {
    brand: 'graycommit',
    screens: ['home', 'about', 'privacy'],
    notes: 'expo shell bundle'
  };
`

test('Graycommit scraper extracts the verified India opening from the official careers page', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  assert.equal(graycommit.HOMEPAGE_URL, 'https://graycommit.com/')
  assert.equal(graycommit.CAREERS_URL, 'https://www.graycommit.com/careers')
  assert.equal(graycommit.VERIFIED_ON, '2026-08-07')
  assert.equal(graycommit.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(graycommit.extractJobCards(careersHtml), [{
    title: 'GTM Sales Exec - AI',
    company: 'Graycommit',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'graycommit-gtm-sales-exec-ai-bangalore',
    requisitionId: 'graycommit-gtm-sales-exec-ai-bangalore',
    sourceUrl: 'https://www.graycommit.com/careers',
    applyUrl: 'https://forms.gle/JRRyEqayaV32F3xC7',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Own outbound AI sales and partnerships for India growth.',
  }])
})

test('Graycommit scraper extracts the current India opening from the live open-positions card layout', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  assert.equal(graycommit.hasOfficialCareersSignal(currentCareersHtml), true)

  assert.deepEqual(graycommit.extractJobCards(currentCareersHtml), [{
    title: 'GTM Sales Exec - AI',
    company: 'Graycommit',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'graycommit-gtm-sales-exec-ai-bangalore',
    requisitionId: 'graycommit-gtm-sales-exec-ai-bangalore',
    sourceUrl: 'https://www.graycommit.com/careers',
    applyUrl: 'https://forms.gle/JRRyEqayaV32F3xC7',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Drive revenue growth by selling our AI-powered sales platform to enterprise customers and building strategic partnerships.',
  }])
})

test('Graycommit scraper recognizes the verified Friday, August 7, 2026 Expo shell with no public careers payload', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  assert.equal(
    graycommit.extractBundleUrl(currentShellHtml),
    'https://www.graycommit.com/_expo/static/js/web/entry-215fea92581564a9c3e940efb96ccdb8.js',
  )
  assert.equal(graycommit.hasOfficialCareersShellSignal(currentShellHtml), true)
  assert.equal(graycommit.hasPublicCareersBundleSignal(currentShellBundleText), false)
  assert.equal(graycommit.hasVerifiedNoPublicCareersSignal(currentShellBundleText), true)
})

test('Graycommit scraper run decorates the verified India opening', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  const requestedUrls = []
  const jobs = await graycommit.createGraycommitScraper({
    now: () => '2026-07-12T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.graycommit.com/careers'])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      source: jobs[0].source,
      company: jobs[0].company,
      location: jobs[0].location,
      link: jobs[0].link,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'GTM Sales Exec - AI',
      source: 'graycommit',
      company: 'Graycommit',
      location: 'Bangalore, India',
      link: 'https://forms.gle/JRRyEqayaV32F3xC7',
      scrapedAt: '2026-07-12T10:00:00.000Z',
    },
  )
})

test('Graycommit returns an honest zero result when the verified careers route is an Expo shell with no public job markers', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  const requestedUrls = []
  const jobs = await graycommit.createGraycommitScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === graycommit.CAREERS_URL) return currentShellHtml
      if (url === 'https://www.graycommit.com/_expo/static/js/web/entry-215fea92581564a9c3e940efb96ccdb8.js') {
        return currentShellBundleText
      }

      throw new Error(`Unexpected Graycommit URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.graycommit.com/careers',
    'https://www.graycommit.com/_expo/static/js/web/entry-215fea92581564a9c3e940efb96ccdb8.js',
  ])
  assert.deepEqual(jobs, [])
})

test('Graycommit scraper fails closed when the official careers surface changes materially', async () => {
  const graycommit = await loadModule()
  assert.ok(graycommit, 'Graycommit scraper module should load')

  await assert.rejects(
    graycommit.createGraycommitScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Graycommit</h1>
            <p>Product updates only.</p>
          </body>
        </html>
      `,
    }),
    /Graycommit official careers surface changed/i,
  )

  await assert.rejects(
    graycommit.createGraycommitScraper().run({
      fetchText: async (url) => {
        if (url === graycommit.CAREERS_URL) return currentShellHtml
        return `
          window.__routes = ['careers'];
          const applyLink = 'https://forms.gle/JRRyEqayaV32F3xC7';
        `
      },
    }),
    /Graycommit careers surface now exposes public listings and needs a structured scraper/i,
  )
})
