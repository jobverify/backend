import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-27T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &mdash; Join Smart Software Services | Smart Software Services</title>
  </head>
  <body>
    <nav>
      <a href="https://smartsoftwareservices.com/careers">Careers</a>
      <a href="/careers">Careers</a>
      <a href="/contact">Contact</a>
    </nav>
    <main>
      <h1>BUILD THE FUTURE WITH US</h1>
      <p>Join Our Team</p>
      <p>Work on meaningful projects, grow your skills, and build impactful digital solutions.</p>
      <p>4 Open roles</p>
      <p>QA &middot; FE &middot; BE &middot; Design</p>
      <a href="#open-positions">View open roles</a>

      <section id="open-positions">
        <article>
          <div>
            <h3>QA Automation Engineer</h3>
            <span>Mid-Senior</span>
          </div>
          <p>Remote &middot; India</p>
          <p>Posted Apr 1, 2026</p>
          <div>
            <span>Playwright</span>
            <span>Cypress</span>
            <span>CI/CD</span>
            <span>TypeScript</span>
            <span>REST APIs</span>
          </div>
          <p>Own automation strategy across web and APIs - Playwright-first, CI-backed quality gates, and traceable releases for enterprise clients.</p>
          <p>Competitive &middot; based on experience</p>
          <button type="button">View details</button>
          <button type="button">Apply now</button>
        </article>

        <article>
          <div>
            <h3>Frontend Developer (React / Next.js)</h3>
            <span>Mid-Senior</span>
          </div>
          <p>Remote &middot; UAE &middot; India</p>
          <p>Posted Apr 8, 2026</p>
          <div>
            <span>React</span>
            <span>Next.js</span>
            <span>TypeScript</span>
            <span>Tailwind CSS</span>
            <span>a11y</span>
          </div>
          <p>Ship fast, accessible interfaces on Next.js App Router - performance budgets, design systems, and production-grade UX for SaaS and enterprise portals.</p>
          <p>Competitive &middot; based on experience</p>
          <button type="button">View details</button>
          <button type="button">Apply now</button>
        </article>

        <article>
          <div>
            <h3>Backend Developer (Node.js)</h3>
            <span>Mid-Senior</span>
          </div>
          <p>India &middot; Remote</p>
          <p>Posted Apr 12, 2026</p>
          <div>
            <span>Node.js</span>
            <span>PostgreSQL</span>
            <span>REST</span>
            <span>Docker</span>
            <span>Queues</span>
          </div>
          <p>Design APIs and services on Node.js - pragmatic architecture, Postgres, queues, and observability for reliable platforms.</p>
          <p>Competitive &middot; based on experience</p>
          <button type="button">View details</button>
          <button type="button">Apply now</button>
        </article>

        <article>
          <div>
            <h3>UI/UX Designer</h3>
            <span>Mid-Level</span>
          </div>
          <p>Remote &middot; India</p>
          <p>Posted Apr 15, 2026</p>
          <div>
            <span>Figma</span>
            <span>Design systems</span>
            <span>Prototyping</span>
            <span>UX research</span>
          </div>
          <p>Shape flows, prototypes, and design systems - workshops, usability judgment, and dev-ready handoff for web and product surfaces.</p>
          <p>Competitive &middot; based on experience</p>
          <button type="button">View details</button>
          <button type="button">Apply now</button>
        </article>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/smartsoftwareservices/script.js')
  } catch {
    assert.fail('Expected Smart Software Services scraper module at ../../scraper/smartsoftwareservices/script.js')
  }
}

test('Smart Software Services helpers stay pinned to the verified first-party role-card careers surface', async () => {
  const smart = await loadModule()

  assert.equal(smart.SOURCE, 'smartsoftwareservices')
  assert.equal(smart.COMPANY, 'Smart Software Services(I)')
  assert.equal(smart.CAREERS_URL, 'https://smartsoftwareservices.com/careers')
  assert.equal(smart.OPEN_POSITIONS_URL, 'https://smartsoftwareservices.com/careers#open-positions')
  assert.equal(smart.VERIFIED_ON, '2026-07-27')
  assert.equal(smart.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(smart.hasTrustworthyPublicApplySignal(CAREERS_HTML), false)
  assert.equal(typeof smart.extractVisibleRoleCards, 'function')
  assert.deepEqual(
    smart.extractVisibleRoleCards(CAREERS_HTML),
    [
      {
        title: 'QA Automation Engineer',
        experienceRequired: 'Mid-Senior',
        location: 'Remote, India',
        requiredSkills: ['Playwright', 'Cypress', 'CI/CD', 'TypeScript', 'REST APIs'],
        postingDate: '2026-04-01',
        jobDescription:
          'Own automation strategy across web and APIs - Playwright-first, CI-backed quality gates, and traceable releases for enterprise clients.',
      },
      {
        title: 'Frontend Developer (React / Next.js)',
        experienceRequired: 'Mid-Senior',
        location: 'Remote, UAE, India',
        requiredSkills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'a11y'],
        postingDate: '2026-04-08',
        jobDescription:
          'Ship fast, accessible interfaces on Next.js App Router - performance budgets, design systems, and production-grade UX for SaaS and enterprise portals.',
      },
      {
        title: 'Backend Developer (Node.js)',
        experienceRequired: 'Mid-Senior',
        location: 'Remote, India',
        requiredSkills: ['Node.js', 'PostgreSQL', 'REST', 'Docker', 'Queues'],
        postingDate: '2026-04-12',
        jobDescription:
          'Design APIs and services on Node.js - pragmatic architecture, Postgres, queues, and observability for reliable platforms.',
      },
      {
        title: 'UI/UX Designer',
        experienceRequired: 'Mid-Level',
        location: 'Remote, India',
        requiredSkills: ['Figma', 'Design systems', 'Prototyping', 'UX research'],
        postingDate: '2026-04-15',
        jobDescription:
          'Shape flows, prototypes, and design systems - workshops, usability judgment, and dev-ready handoff for web and product surfaces.',
      },
    ],
  )
})

test('Smart Software Services run extracts the visible India role cards instead of returning a stale zero-jobs sentinel', async () => {
  const smart = await loadModule()

  const jobs = await smart.createSmartSoftwareServicesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, smart.CAREERS_URL)
      return CAREERS_HTML
    },
  })

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.location,
      job.city,
      job.jobId,
      job.postingDate,
      job.applyUrl,
      job.remoteStatus,
      job.requiredSkills.join('|'),
      job.companyDomain,
      job.atsPlatform,
    ]),
    [
      [
        'QA Automation Engineer',
        'Remote, India',
        'Remote',
        'qa-automation-engineer',
        '2026-04-01',
        'https://smartsoftwareservices.com/careers#open-positions',
        'Remote',
        'Playwright|Cypress|CI/CD|TypeScript|REST APIs',
        'smartsoftwareservices.com',
        'first-party-careers-site',
      ],
      [
        'Frontend Developer (React / Next.js)',
        'Remote, UAE, India',
        'Remote',
        'frontend-developer-react-next-js',
        '2026-04-08',
        'https://smartsoftwareservices.com/careers#open-positions',
        'Remote',
        'React|Next.js|TypeScript|Tailwind CSS|a11y',
        'smartsoftwareservices.com',
        'first-party-careers-site',
      ],
      [
        'Backend Developer (Node.js)',
        'Remote, India',
        'Remote',
        'backend-developer-node-js',
        '2026-04-12',
        'https://smartsoftwareservices.com/careers#open-positions',
        'Remote',
        'Node.js|PostgreSQL|REST|Docker|Queues',
        'smartsoftwareservices.com',
        'first-party-careers-site',
      ],
      [
        'UI/UX Designer',
        'Remote, India',
        'Remote',
        'ui-ux-designer',
        '2026-04-15',
        'https://smartsoftwareservices.com/careers#open-positions',
        'Remote',
        'Figma|Design systems|Prototyping|UX research',
        'smartsoftwareservices.com',
        'first-party-careers-site',
      ],
    ],
  )
  assert.equal(jobs.every((job) => job.sourceUrl === smart.CAREERS_URL), true)
  assert.equal(jobs.every((job) => job.link === smart.CAREERS_URL), true)
  assert.equal(jobs.every((job) => job.scrapedAt === FIXED_SCRAPED_AT), true)
})

test('Smart Software Services still fails closed when the verified careers surface drifts away', async () => {
  const smart = await loadModule()

  await assert.rejects(
    smart.createSmartSoftwareServicesScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /careers page no longer matches/i,
  )
})
