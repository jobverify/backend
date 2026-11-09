import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Invenger</title>
  </head>
  <body>
    <a href="/careers">Careers</a>
    <p>info@invenger.com</p>
    <p>India Office Location</p>
    <p>Invenger Tower's Ware House Road, Ballalbagh, Lalbagh, Mangaluru, Karnataka - 575 003</p>
  </body>
</html>
`

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Invenger</title>
    <meta property="og:site_name" content="Invenger"/>
  </head>
  <body>
    <nav>
      <a href="/jobs">Careers</a>
    </nav>
    <main>
      <h1>Careers</h1>
      <a href="/jobs">Careers</a>
    </main>
  </body>
</html>
`

const JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Invenger</title>
  </head>
  <body>
    <h2>Our Job Offers</h2>
    <a draggable="false" href="/jobs/business-development-executive-26" class="text-decoration-none text-reset">
      <div class="card-body p-4">
        <h3>Business Development Executive</h3>
        <h5 class="text-reset"><span>5</span> open positions</h5>
        <div class="oe_empty text-muted mb16"><div>Kickstart your business development career by engaging clients and delivering impactful presentations that drive growth.</div></div>
        <div class="o_job_infos d-flex flex-column">
          <address class="o_portal_address mb-0">
            <span itemprop="addressLocality">Mangaluru</span>,
            <span itemprop="addressRegion">KA</span>,
            <span itemprop="addressCountry">India</span>
          </address>
          <div class="d-inline-flex align-items-center">
            <i class="fa fa-suitcase fa-fw" title="Employment type"></i><span class="fw-light">Full-Time</span>
          </div>
        </div>
      </div>
    </a>
    <a draggable="false" href="/jobs/it-admin-23" class="text-decoration-none text-reset">
      <div class="card-body p-4">
        <h3>IT Admin</h3>
        <h5 class="text-reset"><span>1</span> open position</h5>
        <div class="oe_empty text-muted mb16"><div>A role focused on maintaining secure, efficient IT systems and networks while providing essential technical support.</div></div>
        <div class="o_job_infos d-flex flex-column">
          <address class="o_portal_address mb-0">
            <span itemprop="addressLocality">Mangaluru</span>,
            <span itemprop="addressRegion">KA</span>,
            <span itemprop="addressCountry">India</span>
          </address>
          <div class="d-inline-flex align-items-center">
            <i class="fa fa-suitcase fa-fw" title="Employment type"></i><span class="fw-light">Full-Time</span>
          </div>
        </div>
      </div>
    </a>
    <a draggable="false" href="/jobs/project-manager-31" class="text-decoration-none text-reset">
      <div class="card-body p-4">
        <h3>Project Manager</h3>
        <h5 class="text-reset"><span>1</span> open position</h5>
        <div class="oe_empty text-muted mb16"><div>A results-driven Project Manager role focused on leading teams and delivering high-impact projects.</div></div>
        <div class="o_job_infos d-flex flex-column">
          <address class="o_portal_address mb-0">
            <span itemprop="addressLocality">Mangaluru</span>,
            <span itemprop="addressRegion">KA</span>,
            <span itemprop="addressCountry">India</span>
          </address>
        </div>
      </div>
    </a>
  </body>
</html>
`

const BUSINESS_DEVELOPMENT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Business Development Executive | Invenger</title>
  </head>
  <body>
    <a href="/jobs">All Jobs</a>
    <h1>Business Development Executive</h1>
    <p>Mangaluru, KA, India</p>
    <a href="/jobs/apply/business-development-executive-26">Apply Now!</a>
    <p>We are seeking a dynamic and enthusiastic Business Development Executive to support client engagement and presentation-driven business development activities.</p>
    <p>The position requires strong communication skills, proficiency in Microsoft PowerPoint, and excellent organizational abilities.</p>
    <a href="/web/content/2232?unique=abcdef&download=true">Download JD</a>
    <h6>Presentation Skills</h6>
  </body>
</html>
`

const IT_ADMIN_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>IT Admin | Invenger</title>
  </head>
  <body>
    <a href="/jobs">All Jobs</a>
    <h1>IT Admin</h1>
    <p>Mangaluru, KA, India</p>
    <a href="/jobs/apply/it-admin-23">Apply Now!</a>
    <p>We are looking for a driven and enthusiastic IT / System Administrator who is eager to work with cutting-edge technologies.</p>
    <p>You will have the opportunity to work alongside a skilled IT team and troubleshoot real-world challenges.</p>
    <a href="/web/content/2231?unique=2f8a92d90840b7f9679e85acd8075be0dab3dc4e&download=true">Download JD</a>
    <h6>System Reliability</h6>
  </body>
</html>
`

const loadInvengerModule = async () => {
  try {
    return await import('../../scraper/invenger/script.js')
  } catch {
    assert.fail('Expected Invenger scraper module at ../../scraper/invenger/script.js')
  }
}

test('Invenger verifies the first-party careers page, jobs page, and detail/apply URL patterns', async () => {
  const invenger = await loadInvengerModule()

  assert.equal(invenger.CAREERS_PAGE_URL, 'https://www.invenger.com/careers')
  assert.equal(invenger.JOBS_PAGE_URL, 'https://www.invenger.com/jobs')
  assert.equal(invenger.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(invenger.hasOfficialCareersSignal(CURRENT_CAREERS_HTML), true)
  assert.equal(invenger.hasOfficialJobsPageSignal(JOBS_HTML), true)
})

test('Invenger extracts listing cards from the public jobs page and preserves optional employment types', async () => {
  const invenger = await loadInvengerModule()
  const cards = invenger.extractJobCards(JOBS_HTML)

  assert.equal(cards.length, 3)
  assert.deepEqual(
    cards.map((card) => ({
      title: card.title,
      detailUrl: card.detailUrl,
      openingsLabel: card.openingsLabel,
      employmentType: card.employmentType,
    })),
    [
      {
        title: 'Business Development Executive',
        detailUrl: 'https://www.invenger.com/jobs/business-development-executive-26',
        openingsLabel: '5 open positions',
        employmentType: 'Full-Time',
      },
      {
        title: 'IT Admin',
        detailUrl: 'https://www.invenger.com/jobs/it-admin-23',
        openingsLabel: '1 open position',
        employmentType: 'Full-Time',
      },
      {
        title: 'Project Manager',
        detailUrl: 'https://www.invenger.com/jobs/project-manager-31',
        openingsLabel: '1 open position',
        employmentType: null,
      },
    ],
  )
})

test('Invenger enriches listing cards from first-party detail pages and first-party apply URLs', async () => {
  const invenger = await loadInvengerModule()
  const cards = invenger.extractJobCards(JOBS_HTML)
  const itAdmin = invenger.extractJobDetail(IT_ADMIN_DETAIL_HTML, cards[1])

  assert.equal(itAdmin.title, 'IT Admin')
  assert.equal(itAdmin.company, 'Invenger')
  assert.equal(itAdmin.location, 'Mangaluru, KA, India')
  assert.equal(itAdmin.city, 'Mangaluru')
  assert.equal(itAdmin.state, 'KA')
  assert.equal(itAdmin.country, 'India')
  assert.equal(itAdmin.jobId, '23')
  assert.equal(itAdmin.requisitionId, '23')
  assert.equal(itAdmin.sourceUrl, 'https://www.invenger.com/jobs/it-admin-23')
  assert.equal(itAdmin.applyUrl, 'https://www.invenger.com/jobs/apply/it-admin-23')
  assert.equal(itAdmin.employmentType, 'Full-Time')
  assert.match(itAdmin.jobDescription, /System Administrator/i)
})

test('Invenger run verifies the public jobs page before scraping detail pages', async () => {
  const invenger = await loadInvengerModule()
  const requestedUrls = []

  const jobs = await invenger.createInvengerScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === invenger.CAREERS_PAGE_URL) return CAREERS_HTML
      if (url === invenger.JOBS_PAGE_URL) return JOBS_HTML
      if (url === 'https://www.invenger.com/jobs/business-development-executive-26') {
        return BUSINESS_DEVELOPMENT_DETAIL_HTML
      }
      if (url === 'https://www.invenger.com/jobs/it-admin-23') return IT_ADMIN_DETAIL_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.invenger.com/careers',
    'https://www.invenger.com/jobs',
    'https://www.invenger.com/jobs/business-development-executive-26',
    'https://www.invenger.com/jobs/it-admin-23',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'invenger')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Invenger fails closed when the verified jobs page drifts materially', async () => {
  const invenger = await loadInvengerModule()

  await assert.rejects(
    invenger.createInvengerScraper().run({
      fetchText: async (url) => {
        if (url === invenger.CAREERS_PAGE_URL) return CAREERS_HTML
        if (url === invenger.JOBS_PAGE_URL) return '<html><body><h1>Jobs</h1><p>No public roles here.</p></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Invenger jobs page/i,
  )
})

test('Invenger accepts current vacancies after previously observed roles are replaced', async () => {
  const invenger = await loadInvengerModule()
  const html = JOBS_HTML.replaceAll('business-development-executive-26', 'sr-business-development-executive-27')
    .replaceAll('it-admin-23', 'accountant-35')
  const cards = invenger.extractJobCards(html)
  assert.ok(cards.length >= 2)
  assert.equal(cards[0].detailUrl, 'https://www.invenger.com/jobs/sr-business-development-executive-27')
})

test('Invenger role links cannot substitute for its branded jobs page', async () => {
  const invenger = await loadInvengerModule()
  assert.throws(() => invenger.extractJobCards(JOBS_HTML.replace('Jobs | Invenger', 'Jobs | Other Employer')), /verified Invenger jobs page/)
})
