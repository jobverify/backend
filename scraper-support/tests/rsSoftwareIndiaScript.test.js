import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>RS Software</h1>
    <p>Payments at the Speed of Thought</p>
    <a href="/home/jointeam">Join Our Team</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Where talent meets opportunity</h2>
    <p>Find your next role and take the leap — explore our current openings.</p>
    <p>sourcing@rssoftware.co.in</p>

    <section>
      <h4>Global Delivery Head</h4>
      <p>Roles in Focus: Delivery Head</p>
      <p>Lead the global deployment of mission-critical payment products, transforming customer implementations into long-term advocacy, adoption, and business growth.</p>
      <a href="#apply-global-delivery-head">Apply</a>
    </section>

    <section>
      <h4>Global Pre-sales Solution Engineer (Payments)</h4>
      <p>Roles in Focus: Global Pre-sales Solution Engineer</p>
      <p>Drive global payments deals by translating customer requirements into compelling solution designs, demos, and proof-led engagements that accelerate conversion and build reusable pre-sales assets.</p>
      <a href="#apply-global-pre-sales-solution-engineer-payments">Apply</a>
    </section>

    <section>
      <h4>Senior Manager Sales, Mumbai</h4>
      <p>Roles in Focus: Sales Manager</p>
      <p>Senior Sales Manager driving enterprise digital payments product sales across India through strategic client acquisition, consultative solution selling, account growth, partnerships, and revenue expansion initiatives.</p>
      <a href="#apply-senior-manager-sales-mumbai">Apply</a>
    </section>

    <section>
      <h4>Sales Director, US</h4>
      <p>Roles in Focus: Sales Director</p>
      <p>Sales Director responsible for driving enterprise digital payments product growth across the US through strategic sales, client acquisition, account expansion, partnerships, and revenue leadership.</p>
      <a href="#apply-sales-director-us">Apply</a>
    </section>

    <section>
      <h4>Senior Manager Sales, Bangalore/Chennai</h4>
      <p>Roles in Focus: Sales Manager</p>
      <p>Senior Sales Manager driving enterprise digital payments product sales across India through strategic client acquisition, consultative solution selling, account growth, partnerships, and revenue expansion initiatives.</p>
      <a href="#apply-senior-manager-sales-bangalore-chennai">Apply</a>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rssoftwareindia/script.js')
  } catch {
    assert.fail('Expected RS Software India scraper module at ../../scraper/rssoftwareindia/script.js')
  }
}

test('RS Software India helpers stay pinned to the verified first-party join-team contract', async () => {
  const rsSoftwareIndia = await loadModule()

  assert.equal(rsSoftwareIndia.SOURCE, 'rssoftwareindia')
  assert.equal(rsSoftwareIndia.COMPANY, 'RS Software (India) Ltd.')
  assert.equal(rsSoftwareIndia.HOMEPAGE_URL, 'https://www.rssoftware.com/')
  assert.equal(rsSoftwareIndia.CAREERS_URL, 'https://www.rssoftware.com/home/jointeam')
  assert.equal(rsSoftwareIndia.VERIFIED_ON, '2026-07-17')
  assert.equal(rsSoftwareIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rsSoftwareIndia.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    rsSoftwareIndia.extractOpenRoles(careersHtml),
    [
      {
        title: 'Global Delivery Head',
        roleFocus: 'Delivery Head',
        description:
          'Lead the global deployment of mission-critical payment products, transforming customer implementations into long-term advocacy, adoption, and business growth.',
      },
      {
        title: 'Global Pre-sales Solution Engineer (Payments)',
        roleFocus: 'Global Pre-sales Solution Engineer',
        description:
          'Drive global payments deals by translating customer requirements into compelling solution designs, demos, and proof-led engagements that accelerate conversion and build reusable pre-sales assets.',
      },
      {
        title: 'Senior Manager Sales, Mumbai',
        roleFocus: 'Sales Manager',
        description:
          'Senior Sales Manager driving enterprise digital payments product sales across India through strategic client acquisition, consultative solution selling, account growth, partnerships, and revenue expansion initiatives.',
      },
      {
        title: 'Sales Director, US',
        roleFocus: 'Sales Director',
        description:
          'Sales Director responsible for driving enterprise digital payments product growth across the US through strategic sales, client acquisition, account expansion, partnerships, and revenue leadership.',
      },
      {
        title: 'Senior Manager Sales, Bangalore/Chennai',
        roleFocus: 'Sales Manager',
        description:
          'Senior Sales Manager driving enterprise digital payments product sales across India through strategic client acquisition, consultative solution selling, account growth, partnerships, and revenue expansion initiatives.',
      },
    ],
  )
})

test('RS Software India run validates the careers page and returns only India-relevant roles', async () => {
  const rsSoftwareIndia = await loadModule()
  const requestedUrls = []

  const jobs = await rsSoftwareIndia.createRsSoftwareIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rsSoftwareIndia.HOMEPAGE_URL) return homepageHtml
      if (url === rsSoftwareIndia.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected RS Software URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    rsSoftwareIndia.HOMEPAGE_URL,
    rsSoftwareIndia.CAREERS_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.jobId, job.applyUrl, job.companyDomain, job.atsPlatform]),
    [
      [
        'Global Delivery Head',
        'Kolkata, India',
        'global-delivery-head',
        'https://www.rssoftware.com/home/jointeam',
        'rssoftware.com',
        'official-company-careers',
      ],
      [
        'Global Pre-sales Solution Engineer (Payments)',
        'Kolkata, India',
        'global-pre-sales-solution-engineer-payments',
        'https://www.rssoftware.com/home/jointeam',
        'rssoftware.com',
        'official-company-careers',
      ],
      [
        'Senior Manager Sales, Mumbai',
        'Mumbai, India',
        'senior-manager-sales-mumbai',
        'https://www.rssoftware.com/home/jointeam',
        'rssoftware.com',
        'official-company-careers',
      ],
      [
        'Senior Manager Sales, Bangalore/Chennai',
        'Bangalore/Chennai, India',
        'senior-manager-sales-bangalore-chennai',
        'https://www.rssoftware.com/home/jointeam',
        'rssoftware.com',
        'official-company-careers',
      ],
    ],
  )
  assert.equal(jobs.every((job) => job.scrapedAt === FIXED_SCRAPED_AT), true)
})

test('RS Software India fails closed when the verified homepage or join-team page drifts', async () => {
  const rsSoftwareIndia = await loadModule()

  await assert.rejects(
    rsSoftwareIndia.createRsSoftwareIndiaScraper().run({
      fetchText: async (url) => {
        if (url === rsSoftwareIndia.HOMEPAGE_URL) {
          return '<html><body><h1>RS Software</h1></body></html>'
        }
        if (url === rsSoftwareIndia.CAREERS_URL) {
          return careersHtml
        }
        throw new Error(`Unexpected RS Software URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    rsSoftwareIndia.createRsSoftwareIndiaScraper().run({
      fetchText: async (url) => {
        if (url === rsSoftwareIndia.HOMEPAGE_URL) {
          return homepageHtml
        }
        if (url === rsSoftwareIndia.CAREERS_URL) {
          return '<html><body><h2>Jobs</h2></body></html>'
        }
        throw new Error(`Unexpected RS Software URL: ${url}`)
      },
    }),
    /join-team page/i,
  )
})
