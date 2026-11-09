import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T18:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Care Management Platform for Value-Based Care | blueBriX</title>
    <link rel="canonical" href="https://bluebrix.health" />
  </head>
  <body>
    <h1>EHR software for value-based care</h1>
    <p>The Low code-no code Platform for care coordination.</p>
    <a href="https://careers.bluebrix.health/">Career</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Healthcare Tech &amp; Innovation Jobs - blueBriX Careers</title>
    <link rel="canonical" href="https://careers.bluebrix.health" />
  </head>
  <body>
    <nav>Home Stories All roles</nav>
    <section class="section career-banner">
      <h2>Build the "What's next"</h2>
      <div class="roles-container">
        <div class="roles-card">
          <a href="https://careers.bluebrix.health/roles/product-lead/">
            <div class="roles-header">
              <span>Product Management</span>
              <h3>Product Lead / Manager</h3>
              <p>A Product Manager Who Can Herd Cats, Build Rome, and Still Show Up on Time</p>
            </div>
            <div class="roles-action">
              <span>7-15 years &bull; Full-time &bull; 1 roles &bull; Kochi, Kerala</span>
            </div>
          </a>
        </div>
        <div class="roles-card">
          <a href="https://careers.bluebrix.health/roles/vp-of-sales/">
            <div class="roles-header">
              <span>Sales &amp; Marketing</span>
              <h3>Vice President of Sales &#8211; Healthcare SaaS &#8211; EHR</h3>
              <p>Wanted: A Head of Sales Who Can Sell Sand in a Desert.</p>
            </div>
            <div class="roles-action">
              <span>10-15 Years &bull; Full-time, Permanent &bull; 1 &bull; Bethesda, MD</span>
            </div>
          </a>
        </div>
        <div class="roles-card">
          <a href="https://careers.bluebrix.health/roles/it-talent-acquisition-specialist/">
            <div class="roles-header">
              <span>Human Resources</span>
              <h3>IT Talent Acquisition Specialist</h3>
              <p>Wanted: A Talent Acquisition Specialist Who Hires Like It Is Personal.</p>
            </div>
            <div class="roles-action">
              <span>3-6 Years &bull; Full-time, Permanent &bull; 1 &bull; Kochi, Kerala</span>
            </div>
          </a>
        </div>
      </div>
      <a href="https://careers.bluebrix.health/all-roles/">Explore all open roles</a>
    </section>
    <div class="modal fade apply-career-modal" id="applyCareerModal">Apply Here<form></form></div>
  </body>
</html>
`

const loadBlueBrixModule = async () => {
  try {
    return await import('../../scraper/bluebrix/script.js')
  } catch {
    assert.fail('Expected blueBriX scraper module at ../../scraper/bluebrix/script.js')
  }
}

test('blueBriX recognizes the current official homepage and careers role-card surface', async () => {
  const blueBrix = await loadBlueBrixModule()

  assert.equal(blueBrix.SOURCE, 'bluebrix')
  assert.equal(blueBrix.COMPANY, 'blueBriX')
  assert.equal(blueBrix.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(blueBrix.hasOfficialCareersSignal(careersHtml), true)
})

test('blueBriX parses only India roles from the live role-card layout', async () => {
  const blueBrix = await loadBlueBrixModule()

  const jobs = blueBrix.extractJobCards(careersHtml)

  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.location, job.city, job.sourceUrl]),
    [
      [
        'Product Lead / Manager',
        'Product Management',
        'Kochi, Kerala, India',
        'Kochi',
        'https://careers.bluebrix.health/roles/product-lead/',
      ],
      [
        'IT Talent Acquisition Specialist',
        'Human Resources',
        'Kochi, Kerala, India',
        'Kochi',
        'https://careers.bluebrix.health/roles/it-talent-acquisition-specialist/',
      ],
    ],
  )
})

test('blueBriX run validates the homepage before returning current India roles', async () => {
  const blueBrix = await loadBlueBrixModule()
  const requested = []

  const jobs = await blueBrix.createBlueBrixScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === blueBrix.HOMEPAGE_URL) return homepageHtml
      if (url === blueBrix.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [blueBrix.HOMEPAGE_URL, blueBrix.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'bluebrix')
  assert.equal(jobs[0].link, 'https://careers.bluebrix.health/roles/product-lead/')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})
