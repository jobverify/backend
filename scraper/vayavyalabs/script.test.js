import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html>
  <head>
    <title>Home - Vayavya Labs Pvt. Ltd.</title>
    <link rel="canonical" href="https://vayavyalabs.com/" />
  </head>
  <body>
    <a href="https://vayavyalabs.com/careers/">Careers</a>
    <footer>© 2026 Vayavya Labs Pvt. Ltd.</footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers - Vayavya Labs Pvt. Ltd.</title>
    <link rel="canonical" href="https://vayavyalabs.com/careers/" />
  </head>
  <body>
    <h2 class="elementor-heading-title elementor-size-default">Current Openings</h2>
    <div class="premium-blog-post-outer-container current-openings eda-semiconductors systemc-job-openings" data-total="1">
      <div class="premium-blog-post-container premium-blog-skin-side">
        <div class="premium-blog-content-wrapper empty-thumb">
          <div class="premium-blog-inner-container">
            <h2 class="premium-blog-entry-title">
              <a href="https://vayavyalabs.com/current_opening/systemc-engineer-senior-engineer/" target="_self">SystemC Engineer / Senior Engineer</a>
            </h2>
          </div>
          <div class="premium-blog-content-inner-wrapper">
            <p class="premium-blog-post-content">Join Vayavya Labs as a SystemC Engineer — build virtual platforms shaping the future of semiconductor &amp; embedded systems.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="premium-blog-post-outer-container current-openings non-technical" data-total="1">
      <div class="premium-blog-post-container premium-blog-skin-side">
        <div class="premium-blog-content-wrapper empty-thumb">
          <div class="premium-blog-inner-container">
            <h2 class="premium-blog-entry-title">
              <a href="https://vayavyalabs.com/current_opening/pre-sales-lead-senior-lead-engineering-services/" target="_self">Pre-Sales Lead / Senior Lead – Engineering Services</a>
            </h2>
          </div>
          <div class="premium-blog-content-inner-wrapper">
            <p class="premium-blog-post-content">We are looking for a Pre-Sales Lead professional who can articulate the value proposition and can help identify and shape sales opportunities.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="premium-blog-post-outer-container career-communications-connectivity current-openings" data-total="1">
      <div class="premium-blog-post-container premium-blog-skin-side">
        <div class="premium-blog-content-wrapper empty-thumb">
          <div class="premium-blog-inner-container">
            <h2 class="premium-blog-entry-title">
              <a href="https://vayavyalabs.com/current_opening/developer-linux-device-driver/" target="_self">Developer- Linux Device Driver</a>
            </h2>
          </div>
          <div class="premium-blog-content-inner-wrapper">
            <p class="premium-blog-post-content">Position: Developer – Linux Device Driver Development Experience: 3-8 Years Location: Bengaluru, Karnataka Job Brief: Top semiconductor companies are our customers.</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const SYSTEMC_DETAIL_HTML = `
<!doctype html>
<html>
  <head>
    <title>SystemC Engineer / Senior Engineer - Vayavya Labs Pvt. Ltd.</title>
    <link rel="canonical" href="https://vayavyalabs.com/current_opening/systemc-engineer-senior-engineer/" />
    <meta property="article:published_time" content="2026-07-08T08:16:30+00:00" />
  </head>
  <body>
    <ol class="breadcrumb">
      <li>Careers</li>
      <li>SystemC Engineer / Senior Engineer</li>
    </ol>
    <h2 style="padding-top:15px;">SystemC Engineer / Senior Engineer</h2>
    <div class="elementor-widget-text-editor">
      <div class="elementor-widget-container">
        <p><strong>Position Name:</strong> System-C Engineer / Senior Engineer</p>
        <p><strong>Education Requirement:</strong> B. Tech/BE, M Tech (CS, E&amp;C, Embedded Systems)</p>
        <p><strong>Experience:</strong> 0.5-4 Years</p>
        <p><strong>Location:</strong> Belagavi/ Bengaluru</p>
        <h5><strong>What You Will Do</strong></h5>
        <ul>
          <li>Architect &amp; develop C++ and SystemC based TLM2.0 models for CPUs.</li>
          <li>Optimize simulation performance, ensuring fast and accurate virtual testing.</li>
        </ul>
        <h5><strong>Must-Have Technical Skills</strong></h5>
        <ul>
          <li>Expertise in SystemC and Transaction-Level Modeling (TLM 2.0).</li>
          <li>Strong programming skills in C/C++.</li>
        </ul>
      </div>
    </div>
    <div class="elementor-widget-button">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:careers@vayavyalabs.com?subject=SystemC%20Engineer">
        <span class="elementor-button-text">Apply Here</span>
      </a>
    </div>
  </body>
</html>
`

const PRESALES_DETAIL_HTML = `
<!doctype html>
<html>
  <head>
    <title>Pre-Sales Lead / Senior Lead – Engineering Services - Vayavya Labs Pvt. Ltd.</title>
    <link rel="canonical" href="https://vayavyalabs.com/current_opening/pre-sales-lead-senior-lead-engineering-services/" />
    <meta property="article:published_time" content="2026-05-12T16:40:55+00:00" />
  </head>
  <body>
    <ol class="breadcrumb">
      <li>Careers</li>
      <li>Pre-Sales Lead / Senior Lead – Engineering Services</li>
    </ol>
    <h2 style="padding-top:15px;">Pre-Sales Lead / Senior Lead – Engineering Services</h2>
    <div class="elementor-widget-text-editor">
      <div class="elementor-widget-container">
        <p><strong>Role Summary</strong></p>
        <p>We are looking for a Pre-Sales professional who can articulate the value proposition and can help identify and shape sales opportunities.</p>
        <p><strong>Skills &amp; Experience:</strong></p>
        <ul>
          <li>5-7 years in Pre-Sales / Solutioning / Technical Sales</li>
          <li>Strong understanding of embedded systems and software lifecycle</li>
        </ul>
      </div>
    </div>
    <div class="elementor-widget-button">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:careers@vayavyalabs.com?mailto:careers@vayavyalabs.com?subject=Pre-Sales%20Lead">
        <span class="elementor-button-text">Apply Now</span>
      </a>
    </div>
  </body>
</html>
`

const LINUX_DRIVER_DETAIL_HTML = `
<!doctype html>
<html>
  <head>
    <title>Developer- Linux Device Driver - Vayavya Labs Pvt. Ltd.</title>
    <link rel="canonical" href="https://vayavyalabs.com/current_opening/developer-linux-device-driver/" />
    <meta property="article:published_time" content="2024-08-06T06:56:09+00:00" />
  </head>
  <body>
    <ol class="breadcrumb">
      <li>Careers</li>
      <li>Developer- Linux Device Driver</li>
    </ol>
    <h2 style="padding-top:15px;">Developer- Linux Device Driver</h2>
    <div class="elementor-widget-text-editor">
      <div class="elementor-widget-container">
        <p><strong>Position:</strong> Developer – Linux Device Driver Development</p>
        <p><strong>Experience:</strong> 3-8 Years</p>
        <p><strong>Location:</strong> Bengaluru, Karnataka</p>
        <p><strong>Job Brief:</strong> Top semiconductor companies are our customers.</p>
        <p><strong>Must-Have Technical Skills:</strong></p>
        <ul>
          <li>Excellent programming skills in C</li>
          <li>Design, Implementation and debugging of Linux device drivers</li>
        </ul>
      </div>
    </div>
    <div class="elementor-widget-button">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:careers@vayavyalabs.com?subject=Developer-Linux%20Device%20Driver">
        <span class="elementor-button-text">Apply Now</span>
      </a>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../vayavyalabs/script.js')
  } catch {
    assert.fail('Expected Vayavya Labs scraper module at ../vayavyalabs/script.js')
  }
}

test('Vayavya Labs validates the official homepage and careers surfaces before parsing jobs', async () => {
  const vayavya = await loadModule()

  assert.equal(vayavya.SOURCE, 'vayavyalabs')
  assert.equal(vayavya.COMPANY, 'Vayavya Labs')
  assert.equal(vayavya.HOMEPAGE_URL, 'https://vayavyalabs.com/')
  assert.equal(vayavya.CAREERS_URL, 'https://vayavyalabs.com/careers/')
  assert.equal(vayavya.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(vayavya.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('Vayavya Labs extracts current opening cards from the first-party careers page', async () => {
  const vayavya = await loadModule()

  const cards = vayavya.extractJobCards(CAREERS_HTML)

  assert.equal(cards.length, 3)
  assert.deepEqual(cards[0], {
    title: 'SystemC Engineer / Senior Engineer',
    sourceUrl: 'https://vayavyalabs.com/current_opening/systemc-engineer-senior-engineer/',
    department: 'EDA & Semiconductors',
    summary: 'Join Vayavya Labs as a SystemC Engineer - build virtual platforms shaping the future of semiconductor & embedded systems.',
  })
  assert.equal(cards[1].department, 'Non-Technical')
  assert.equal(cards[2].department, 'Communications & Connectivity')
})

test('Vayavya Labs extracts stable detail metadata from first-party job pages', async () => {
  const vayavya = await loadModule()
  const cards = vayavya.extractJobCards(CAREERS_HTML)

  const systemc = vayavya.extractJobDetail(cards[0], SYSTEMC_DETAIL_HTML)
  assert.equal(systemc.title, 'SystemC Engineer / Senior Engineer')
  assert.equal(systemc.location, 'Belagavi / Bengaluru, Karnataka, India')
  assert.equal(systemc.city, null)
  assert.equal(systemc.state, 'Karnataka')
  assert.equal(systemc.country, 'India')
  assert.equal(systemc.experienceRequired, '0.5-4 Years')
  assert.equal(systemc.minimumQualification, 'B. Tech/BE, M Tech (CS, E&C, Embedded Systems)')
  assert.equal(systemc.applyUrl, 'mailto:careers@vayavyalabs.com?subject=SystemC%20Engineer')
  assert.equal(systemc.postingDate, '2026-07-08')
  assert.ok(systemc.requiredSkills.length >= 4)

  const presales = vayavya.extractJobDetail(cards[1], PRESALES_DETAIL_HTML)
  assert.equal(presales.title, 'Pre-Sales Lead / Senior Lead - Engineering Services')
  assert.equal(presales.location, 'India')
  assert.equal(presales.experienceRequired, '5-7 Years')
  assert.equal(presales.applyUrl, 'mailto:careers@vayavyalabs.com?subject=Pre-Sales%20Lead')
  assert.equal(presales.postingDate, '2026-05-12')

  const linuxDriver = vayavya.extractJobDetail(cards[2], LINUX_DRIVER_DETAIL_HTML)
  assert.equal(linuxDriver.location, 'Bengaluru, Karnataka, India')
  assert.equal(linuxDriver.city, 'Bengaluru')
  assert.equal(linuxDriver.state, 'Karnataka')
  assert.equal(linuxDriver.experienceRequired, '3-8 Years')
})

test('Vayavya Labs run fetches the homepage, careers page, and detail pages before returning jobs', async () => {
  const vayavya = await loadModule()
  const requestedUrls = []

  const jobs = await vayavya.createVayavyaLabsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === vayavya.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === vayavya.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://vayavyalabs.com/current_opening/systemc-engineer-senior-engineer/') {
        return SYSTEMC_DETAIL_HTML
      }
      if (url === 'https://vayavyalabs.com/current_opening/pre-sales-lead-senior-lead-engineering-services/') {
        return PRESALES_DETAIL_HTML
      }
      if (url === 'https://vayavyalabs.com/current_opening/developer-linux-device-driver/') {
        return LINUX_DRIVER_DETAIL_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vayavya.HOMEPAGE_URL,
    vayavya.CAREERS_URL,
    'https://vayavyalabs.com/current_opening/systemc-engineer-senior-engineer/',
    'https://vayavyalabs.com/current_opening/pre-sales-lead-senior-lead-engineering-services/',
    'https://vayavyalabs.com/current_opening/developer-linux-device-driver/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Vayavya Labs')
  assert.equal(jobs[0].source, 'vayavyalabs')
  assert.equal(jobs[0].companyCareerPage, 'https://vayavyalabs.com/careers/')
  assert.equal(jobs[0].companyDomain, 'vayavyalabs.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[1].applyUrl, 'mailto:careers@vayavyalabs.com?subject=Pre-Sales%20Lead')
})

test('Vayavya Labs fails closed when the verified homepage, careers page, or detail contract drifts', async () => {
  const vayavya = await loadModule()

  await assert.rejects(
    vayavya.createVayavyaLabsScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>No careers link.</body></html>',
    }),
    /homepage/i,
  )

  await assert.rejects(
    vayavya.createVayavyaLabsScraper().run({
      fetchText: async (url) => {
        if (url === vayavya.HOMEPAGE_URL) return HOMEPAGE_HTML
        return '<html><head><title>Careers - Vayavya Labs Pvt. Ltd.</title></head><body>No current openings.</body></html>'
      },
    }),
    /careers page|current opening/i,
  )

  await assert.rejects(
    vayavya.createVayavyaLabsScraper().run({
      fetchText: async (url) => {
        if (url === vayavya.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === vayavya.CAREERS_URL) return CAREERS_HTML
        return '<html><head><title>SystemC Engineer / Senior Engineer</title></head><body>No Vayavya identity here.</body></html>'
      },
    }),
    /exact first-party company identity|primary job content block/i,
  )
})
