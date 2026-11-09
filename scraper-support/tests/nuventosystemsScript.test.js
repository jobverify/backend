import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-03T00:00:00.000Z'

const CAREERS_HUB_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>careers - Nuvento</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h6>Careers in India</h6>
    <p>Are you looking to be a part of tomorrow's powerful digital transformation team? Join us!</p>
    <a class="elementor-button elementor-button-link elementor-size-sm" href="/careers/kochi/">
      <span>Careers In INDIA</span>
    </a>
  </body>
</html>
`

const INDIA_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>kochi - Nuvento</title>
    <meta property="og:site_name" content="Nuvento">
    <meta property="og:description" content="Nuvento – India For all the enquiries and resume submission please email to naseeba.parvin@nuvento.com anindita.ghosal@nuvento.com Build your Career with Nuvento Team Lead -Python Sales and Marketing Intern (Paid Internship)">
  </head>
  <body>
    <h1>Nuvento – India</h1>
    <h2>Build your Career with Nuvento</h2>
    <p>For all the enquiries and resume submission please email to naseeba.parvin@nuvento.com</p>
    <p>anindita.ghosal@nuvento.com</p>

    <details class="e-n-accordion-item">
      <summary class="e-n-accordion-item-title">
        <span class="e-n-accordion-item-title-header"><div class="e-n-accordion-item-title-text">Team Lead -Python</div></span>
      </summary>
      <div role="region">
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Experience: 10+ Years <br> Location: Kerala (Hybrid)</h6>
        </div>
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Key Responsibilities</h6>
        </div>
        <ul class="elementor-icon-list-items">
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">Lead architecture and development of Django-based services.</span></li>
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">Drive performance tuning and platform security reviews.</span></li>
        </ul>
      </div>
    </details>

    <details class="e-n-accordion-item">
      <summary class="e-n-accordion-item-title">
        <span class="e-n-accordion-item-title-header"><div class="e-n-accordion-item-title-text">Sales and Marketing Intern (Paid Internship)</div></span>
      </summary>
      <div role="region">
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Location: PAN India <br> Work Mode: Remote</h6>
        </div>
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Key Responsibilities</h6>
        </div>
        <ul class="elementor-icon-list-items">
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">Assist in planning and executing digital marketing and sales campaigns.</span></li>
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">Support lead generation, prospect outreach, and lead nurturing activities.</span></li>
        </ul>
      </div>
    </details>

    <details class="e-n-accordion-item">
      <summary class="e-n-accordion-item-title">
        <span class="e-n-accordion-item-title-header"><div class="e-n-accordion-item-title-text">Senior DevOps / Platform Engineer</div></span>
      </summary>
      <div role="region">
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Location: Kochi, Kerala</h6>
        </div>
        <div class="elementor-widget-container">
          <h6 class="elementor-heading-title elementor-size-default">Required Experience</h6>
        </div>
        <ul class="elementor-icon-list-items">
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">7+ years in DevOps/Platform/SRE roles, including at least 4 years running production Kubernetes at scale.</span></li>
          <li class="elementor-icon-list-item"><span class="elementor-icon-list-text">Real database operations experience: backup/restore, point-in-time recovery, connection pooling, and performance troubleshooting on PostgreSQL in production.</span></li>
        </ul>
      </div>
    </details>

    <h6>Address</h6>
    <p>Kochi</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nuventosystems/script.js')
  } catch {
    assert.fail('Expected Nuvento Systems scraper module at ../../scraper/nuventosystems/script.js')
  }
}

test('Nuvento Systems scraper accepts the current hub handoff and accordion-based India job sections', async () => {
  const nuvento = await loadModule()

  assert.equal(nuvento.SOURCE, 'nuventosystems')
  assert.equal(nuvento.COMPANY, 'Nuvento Systems')
  assert.equal(nuvento.CAREERS_HUB_URL, 'https://nuvento.com/careers/')
  assert.equal(nuvento.CAREERS_URL, 'https://nuvento.com/careers/kochi/')
  assert.equal(nuvento.hasOfficialCareersHubSignal(CAREERS_HUB_HTML), true)
  assert.equal(nuvento.hasOfficialIndiaCareersSignal(INDIA_CAREERS_HTML), true)

  const sections = nuvento.extractRoleSections(INDIA_CAREERS_HTML)
  assert.deepEqual(
    sections.map((section) => section.title),
    ['Team Lead -Python', 'Sales and Marketing Intern (Paid Internship)', 'Senior DevOps / Platform Engineer'],
  )

  const jobs = await nuvento.createNuventoSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === nuvento.CAREERS_HUB_URL) return CAREERS_HUB_HTML
      if (url === nuvento.CAREERS_URL) return INDIA_CAREERS_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.location,
      job.city,
      job.workplaceType,
      job.experienceRequired,
    ]),
    [
      ['Sales and Marketing Intern (Paid Internship)', 'PAN India', null, 'Remote', null],
      ['Senior DevOps / Platform Engineer', 'Kochi, Kerala', 'Kochi', null, '7+ years'],
      ['Team Lead -Python', 'Kerala (Hybrid)', null, 'Hybrid', '10+ Years'],
    ],
  )
  assert.equal(jobs[0].company, 'Nuvento Systems')
  assert.equal(jobs[0].source, 'nuventosystems')
  assert.equal(jobs[0].applyUrl, nuvento.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.match(jobs[2].jobDescription, /Lead architecture and development/i)
})

test('Nuvento Systems accepts new India titles and hybrid location without an outdated title pin', async () => {
  const nuvento = await loadModule()
  const currentHtml = INDIA_CAREERS_HTML
    .replaceAll('Team Lead -Python', 'HR Trainee - Payroll & Statutory Compliance')
    .replaceAll('Sales and Marketing Intern (Paid Internship)', 'Intern - Automation')
    .replaceAll('Senior DevOps / Platform Engineer', 'Creative/Design Executive')
    .replaceAll('Location: Kochi, Kerala', 'Location: Hybrid / Work-from-Office')
    .replaceAll('Location: Kerala (Hybrid)', 'Location: Hybrid / Work-from-Office')

  assert.equal(nuvento.hasOfficialIndiaCareersSignal(currentHtml), true)
  const jobs = await nuvento.run({
    fetchText: async (url) => url === nuvento.CAREERS_HUB_URL ? CAREERS_HUB_HTML : currentHtml,
  })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].city, null)
})
