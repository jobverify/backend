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
    <head>
      <title>blueBriX Health</title>
    </head>
    <body>
      <main>
        <h1>AI-powered healthcare operations</h1>
        <a href="https://careers.bluebrix.health/">Careers</a>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>blueBriX Careers</title>
    </head>
    <body>
      <main>
        <h1>Open Roles at blueBriX</h1>
        <p>Apply Here</p>
        <form action="/apply">
          <input type="text" name="name" />
        </form>

        <article>
          <h2>Implementation Analyst</h2>
          <p>Kochi, Kerala</p>
          <p>Support customer onboarding and healthcare workflow delivery.</p>
        </article>

        <article>
          <h2>Clinical Product Specialist</h2>
          <p>Bethesda, MD</p>
          <p>Partner with U.S. provider teams on product rollout.</p>
        </article>
      </main>
    </body>
  </html>
`

test('blueBriX validates the official careers page and extracts only India roles', async () => {
  const bluebrix = await loadModule()
  assert.ok(bluebrix, 'blueBriX scraper module should load')

  assert.equal(bluebrix.SOURCE, 'bluebrix')
  assert.equal(bluebrix.COMPANY, 'blueBriX')
  assert.equal(bluebrix.HOMEPAGE_URL, 'https://bluebrix.health/')
  assert.equal(bluebrix.CAREERS_URL, 'https://careers.bluebrix.health/')
  assert.equal(bluebrix.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bluebrix.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(bluebrix.extractJobCards(careersHtml), [{
    title: 'Implementation Analyst',
    company: 'blueBriX',
    department: null,
    location: 'Kochi, Kerala, India',
    city: 'Kochi',
    country: 'India',
    jobId: 'bluebrix-implementation-analyst-kochi',
    requisitionId: 'bluebrix-implementation-analyst-kochi',
    sourceUrl: 'https://careers.bluebrix.health/',
    applyUrl: 'https://careers.bluebrix.health/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Support customer onboarding and healthcare workflow delivery.',
  }])
})

test('blueBriX scraper run decorates the verified India role', async () => {
  const bluebrix = await loadModule()
  assert.ok(bluebrix, 'blueBriX scraper module should load')

  const requestedUrls = []
  const jobs = await bluebrix.createBlueBrixScraper({
    now: () => '2026-07-12T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bluebrix.HOMEPAGE_URL) return homepageHtml
      if (url === bluebrix.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected blueBriX URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://bluebrix.health/',
    'https://careers.bluebrix.health/',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      source: jobs[0].source,
      company: jobs[0].company,
      link: jobs[0].link,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'Implementation Analyst',
      source: 'bluebrix',
      company: 'blueBriX',
      link: 'https://careers.bluebrix.health/',
      scrapedAt: '2026-07-12T12:00:00.000Z',
    },
  )
})

test('blueBriX scraper fails closed when the first-party homepage or careers portal changes materially', async () => {
  const bluebrix = await loadModule()
  assert.ok(bluebrix, 'blueBriX scraper module should load')

  await assert.rejects(
    bluebrix.createBlueBrixScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    bluebrix.createBlueBrixScraper().run({
      fetchText: async (url) => {
        if (url === bluebrix.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Unexpected careers page</h1></body></html>'
      },
    }),
    /verified first-party careers page/i,
  )
})
