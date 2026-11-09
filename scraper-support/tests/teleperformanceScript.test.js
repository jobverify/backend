import assert from 'node:assert/strict'
import test from 'node:test'

const loadTeleperformanceModule = async () => {
  try {
    return await import('../../scraper/teleperformance/script.js')
  } catch {
    assert.fail('Expected Teleperformance scraper module at ../../scraper/teleperformance/script.js')
  }
}

const indiaLocationHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>TP in India | Global Digital Business Services</title>
  </head>
  <body>
    <main>
      <section>
        <p>TP IN INDIA</p>
        <h1>Digital CX &amp; Transformation CoE for TP</h1>
      </section>
      <nav>
        <a href="https://www.tp.com/en-in/locations/india/careers/">Careers</a>
      </nav>
    </main>
  </body>
</html>
`

const indiaCareersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs in TP India | TP in India</title>
  </head>
  <body>
    <main>
      <h1>Jobs in TP India</h1>
      <section>
        <p>TP IN INDIA</p>
        <h1>Work with us</h1>
      </section>
      <div>CLEAR FILTER</div>
      <div>Country (All)</div>
      <ul>
        <li>India</li>
      </ul>
      <div>Only Work-from-home</div>
      <a href="https://www.tp.com/en-us/careers/job-opportunities/">Back to job opportunities page</a>
      <button type="button">SEE MORE RESULTS</button>
    </main>
  </body>
</html>
`

test('Teleperformance scraper validates the verified TP India location handoff and current careers shell', async () => {
  const teleperformance = await loadTeleperformanceModule()

  assert.equal(teleperformance.SOURCE, 'teleperformance')
  assert.equal(teleperformance.COMPANY, 'Teleperformance')
  assert.equal(teleperformance.INDIA_LOCATION_URL, 'https://www.tp.com/en-in/locations/india/')
  assert.equal(teleperformance.INDIA_CAREERS_URL, 'https://www.tp.com/en-in/locations/india/careers/')
  assert.equal(teleperformance.hasIndiaLocationSignal(indiaLocationHtml), true)
  assert.equal(
    teleperformance.extractIndiaCareersUrl(indiaLocationHtml),
    'https://www.tp.com/en-in/locations/india/careers/',
  )
  assert.equal(teleperformance.hasIndiaCareersShellSignal(indiaCareersShellHtml), true)
  assert.deepEqual(teleperformance.extractPublicJobRecordUrls(indiaCareersShellHtml), [])
})

test('Teleperformance scraper returns no jobs while the verified India careers surface exposes only the shell without public job records', async () => {
  const teleperformance = await loadTeleperformanceModule()
  const requestedUrls = []

  const jobs = await teleperformance.createTeleperformanceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === teleperformance.INDIA_LOCATION_URL) return indiaLocationHtml
      if (url === teleperformance.INDIA_CAREERS_URL) return indiaCareersShellHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    teleperformance.INDIA_LOCATION_URL,
    teleperformance.INDIA_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Teleperformance scraper fails closed when the official India handoff changes or public job records appear', async () => {
  const teleperformance = await loadTeleperformanceModule()

  await assert.rejects(
    teleperformance.createTeleperformanceScraper().run({
      fetchText: async (url) => {
        if (url === teleperformance.INDIA_LOCATION_URL) {
          return indiaLocationHtml.replace(
            'https://www.tp.com/en-in/locations/india/careers/',
            'https://www.tp.com/en-in/locations/india/work-with-us/',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified india careers route/i,
  )

  await assert.rejects(
    teleperformance.createTeleperformanceScraper().run({
      fetchText: async (url) => {
        if (url === teleperformance.INDIA_LOCATION_URL) return indiaLocationHtml
        if (url === teleperformance.INDIA_CAREERS_URL) {
          return `
            <html>
              <body>
                <main>
                  <p>TP IN INDIA</p>
                  <h1>Work with us</h1>
                  <a href="https://www.tp.com/en-in/locations/india/careers/customer-support-associate-bangalore/">
                    Customer Support Associate
                  </a>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public india careers surface now exposes job records/i,
  )
})
