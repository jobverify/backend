import assert from 'node:assert/strict'
import test from 'node:test'

const loadTeachnookModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Teachnook scraper module at ./script.js')
  }
}

const officialRedirectHtml = '<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>'

const parkedLanderHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
    <script>window.LANDER_SYSTEM="PW"</script>
    <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
    <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
    <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
    <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Join Teachnook and build the future of education.</p>
      <a href="/apply/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Teachnook sentinel pins the current official routes and parked lander contract', async () => {
  const teachnook = await loadTeachnookModule()

  assert.equal(teachnook.SOURCE, 'teachnook')
  assert.equal(teachnook.COMPANY, 'Teachnook')
  assert.equal(teachnook.HOMEPAGE_URL, 'https://teachnook.in/')
  assert.equal(teachnook.CAREERS_URL, 'https://teachnook.in/careers')
  assert.equal(teachnook.LANDER_URL, 'https://teachnook.in/lander')
  assert.equal(teachnook.ALT_HOMEPAGE_URL, 'https://teachnook.com/')
  assert.equal(teachnook.ALT_CAREERS_URL, 'https://teachnook.com/careers')
  assert.equal(teachnook.APPLY_URL, null)
  assert.deepEqual(teachnook.PRIMARY_URLS, [
    'https://teachnook.in/',
    'https://teachnook.in/careers',
    'https://teachnook.in/lander',
    'https://teachnook.com/',
    'https://teachnook.com/careers',
  ])
  assert.equal(teachnook.hasOfficialRedirectSignal(officialRedirectHtml), true)
  assert.equal(teachnook.hasParkedLanderSignal(parkedLanderHtml), true)
  assert.equal(teachnook.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Teachnook run returns no jobs only while the official first-party routes stay parked', async () => {
  const teachnook = await loadTeachnookModule()
  const requestedUrls = []

  const jobs = await teachnook.createTeachnookScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === teachnook.HOMEPAGE_URL || url === teachnook.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialRedirectHtml,
        }
      }

      if (url === teachnook.LANDER_URL) {
        return {
          status: 200,
          url,
          html: parkedLanderHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    teachnook.HOMEPAGE_URL,
    teachnook.CAREERS_URL,
    teachnook.LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Teachnook fails closed when the official careers route starts exposing public jobs', async () => {
  const teachnook = await loadTeachnookModule()

  await assert.rejects(
    teachnook.createTeachnookScraper().run({
      fetchPage: async (url) => {
        if (url === teachnook.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialRedirectHtml,
          }
        }

        if (url === teachnook.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers route now appears to expose public jobs/i,
  )
})

test('Teachnook fails closed when the redirect target stops matching the parked lander contract', async () => {
  const teachnook = await loadTeachnookModule()

  await assert.rejects(
    teachnook.createTeachnookScraper().run({
      fetchPage: async (url) => {
        if (url === teachnook.HOMEPAGE_URL || url === teachnook.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialRedirectHtml,
          }
        }

        if (url === teachnook.LANDER_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Teachnook</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /redirect target no longer matches the verified parked lander/i,
  )
})

test('Teachnook returns [] when the verified first-party host times out', async () => {
  const teachnook = await loadTeachnookModule()

  const jobs = await teachnook.createTeachnookScraper().run({
    fetchPage: async () => {
      throw new Error(`Connect Timeout Error for ${teachnook.HOMEPAGE_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
})
