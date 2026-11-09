import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKaniniModule = async () => {
  try {
    return await import('../../scraper/kanini/script.js')
  } catch {
    assert.fail('Expected KANINI scraper module at ../../scraper/kanini/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kanini')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const openPositionsHtml = readFileSync(path.join(fixturesDir, 'open-positions-empty.html'), 'utf8')
const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your partner in AI journey | KANINI</title>
    <link rel="canonical" href="https://kanini.com/">
  </head>
  <body>
    <nav>
      <a href="/careers/">Careers</a>
      <a href="/careers/open-positions/">Open Positions</a>
    </nav>
    <main>
      <h1>Your partner in AI journey</h1>
      <h2>Get Agile. Go Digital.</h2>
      <p>Let's blaze the trail for tomorrow's transformation</p>
      <p>Engineering Solutions for Better Customer Experiences</p>
    </main>
    <footer>KANINI Software Solutions Inc</footer>
  </body>
</html>
`
const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - KANINI</title>
  </head>
  <body>
    <main>
      <h1>Welcome to the happier way to work</h1>
      <section>
        <h2>At KANINI, we are building a more human tech.</h2>
        <p>Our people come to work because it makes them happy.</p>
      </section>
      <section>
        <h2>Explore our open positions</h2>
        <a href="/careers/open-positions">View Open Positions</a>
        <a href="/careers/open-positions">Join Us</a>
      </section>
    </main>
  </body>
</html>
`

test('KANINI scraper keeps the verified first-party URLs and empty-state signals pinned', async () => {
  const kanini = await loadKaniniModule()

  assert.equal(kanini.SOURCE, 'kanini')
  assert.equal(kanini.COMPANY, 'KANINI SOFTWARE SOLUTIONS')
  assert.equal(kanini.HOMEPAGE_URL, 'https://kanini.com/')
  assert.equal(kanini.CAREERS_URL, 'https://kanini.com/careers/')
  assert.equal(kanini.OPEN_POSITIONS_URL, 'https://kanini.com/careers/open-positions/')
  assert.equal(kanini.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kanini.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(kanini.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kanini.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(kanini.extractOpenPositionsUrl(currentCareersHtml), 'https://kanini.com/careers/open-positions')
  assert.equal(kanini.hasZeroJobsSignal(openPositionsHtml), true)
})

test('KANINI scraper returns no jobs while the verified first-party open positions page stays empty', async () => {
  const kanini = await loadKaniniModule()
  const requestedUrls = []

  const jobs = await kanini.createKaniniScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kanini.HOMEPAGE_URL) return homepageHtml
      if (url === kanini.CAREERS_URL) return careersHtml
      if (url === kanini.OPEN_POSITIONS_URL) return openPositionsHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kanini.HOMEPAGE_URL,
    kanini.CAREERS_URL,
    kanini.OPEN_POSITIONS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('KANINI scraper fails closed when the verified first-party surface drifts or public jobs appear', async () => {
  const kanini = await loadKaniniModule()

  await assert.rejects(
    kanini.createKaniniScraper().run({
      fetchText: async (url) => {
        if (url === kanini.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        if (url === kanini.CAREERS_URL) return careersHtml
        if (url === kanini.OPEN_POSITIONS_URL) return openPositionsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kanini.createKaniniScraper().run({
      fetchText: async (url) => {
        if (url === kanini.HOMEPAGE_URL) return homepageHtml
        if (url === kanini.CAREERS_URL) {
          return careersHtml.replace(/https:\/\/kanini\.com\/careers\/open-positions\/?/g, 'https://jobs.kanini.com/apply/software-engineer')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official open positions surface/i,
  )

  await assert.rejects(
    kanini.createKaniniScraper().run({
      fetchText: async (url) => {
        if (url === kanini.HOMEPAGE_URL) return homepageHtml
        if (url === kanini.CAREERS_URL) return careersHtml
        if (url === kanini.OPEN_POSITIONS_URL) {
          return openPositionsHtml.replace(
            'We’re Sorry. We were not able to find a match.',
            'Senior Software Engineer',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface now exposes openings|zero-job state/i,
  )
})
