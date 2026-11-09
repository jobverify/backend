import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HOME_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Careers - Peak</title>
  </head>
  <body>
    <nav>
      <a href="https://peak.ai/company/careers/india/">India Careers</a>
    </nav>
    <main>
      <h1>Great awaits you at Peak</h1>
      <a href="https://peak.ai/company/careers/india/">Open opportunities</a>
    </main>
  </body>
</html>
`

const INDIA_CAREERS_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Careers in India - Peak</title>
  </head>
  <body>
    <main>
      <h1>Careers in India</h1>
      <section>
        <h2>Our India Opportunities</h2>
        <div class="row jobs-board">
          <label>Department</label>
          <span>Search for:</span>
          <h5>There are currently no opportunities</h5>
        </div>
      </section>
    </main>
  </body>
</html>
`

const loadPeakAiModule = async () => {
  try {
    return await import('../../scraper/peakai/script.js')
  } catch {
    assert.fail('Expected Peak AI scraper module at ../../scraper/peakai/script.js')
  }
}

test('Peak AI helpers stay pinned to the official careers landing page and empty India opportunities board', async () => {
  const peakAi = await loadPeakAiModule()

  assert.equal(peakAi.SOURCE, 'peakai')
  assert.equal(peakAi.COMPANY, 'Peak AI')
  assert.equal(peakAi.HOMEPAGE_URL, 'https://peak.ai/')
  assert.equal(peakAi.CAREERS_HOME_URL, 'https://peak.ai/company/careers/')
  assert.equal(peakAi.INDIA_CAREERS_URL, 'https://peak.ai/company/careers/india/')
  assert.equal(peakAi.VERIFIED_ON, '2026-07-17')
  assert.equal(peakAi.hasOfficialCareersHomeSignal(CAREERS_HOME_HTML), true)
  assert.equal(
    peakAi.extractIndiaCareersUrl(CAREERS_HOME_HTML),
    'https://peak.ai/company/careers/india/',
  )
  assert.equal(peakAi.hasOfficialIndiaCareersSignal(INDIA_CAREERS_HTML), true)
  assert.equal(peakAi.hasExplicitNoOpportunitiesSignal(INDIA_CAREERS_HTML), true)
})

test('Peak AI returns [] only while the official India careers board still shows no opportunities', async () => {
  const peakAi = await loadPeakAiModule()
  const requests = []

  const jobs = await peakAi.createPeakAiScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === peakAi.CAREERS_HOME_URL) return CAREERS_HOME_HTML
      if (url === peakAi.INDIA_CAREERS_URL) return INDIA_CAREERS_HTML
      throw new Error(`Unexpected Peak AI URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [peakAi.CAREERS_HOME_URL, peakAi.INDIA_CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Peak AI fails closed when the official careers home or India board changes materially', async () => {
  const peakAi = await loadPeakAiModule()

  await assert.rejects(
    peakAi.createPeakAiScraper().run({
      fetchText: async (url) => {
        if (url === peakAi.CAREERS_HOME_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }
        throw new Error(`Unexpected Peak AI URL: ${url}`)
      },
    }),
    /official careers landing page/i,
  )

  await assert.rejects(
    peakAi.createPeakAiScraper().run({
      fetchText: async (url) => {
        if (url === peakAi.CAREERS_HOME_URL) return CAREERS_HOME_HTML
        if (url === peakAi.INDIA_CAREERS_URL) {
          return INDIA_CAREERS_HTML.replace(
            'There are currently no opportunities',
            'Senior Data Scientist',
          )
        }
        throw new Error(`Unexpected Peak AI URL: ${url}`)
      },
    }),
    /no opportunities/i,
  )

  await assert.rejects(
    peakAi.createPeakAiScraper().run({
      fetchText: async (url) => {
        if (url === peakAi.CAREERS_HOME_URL) {
          return CAREERS_HOME_HTML.replace(
            /https:\/\/peak\.ai\/company\/careers\/india\//g,
            'https://jobs.lever.co/peak-ai',
          )
        }
        throw new Error(`Unexpected Peak AI URL: ${url}`)
      },
    }),
    /india careers/i,
  )
})
