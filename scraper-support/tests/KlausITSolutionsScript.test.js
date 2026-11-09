import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Klaus IT Solutions</title>
    <script src="https://klausit.com/wp-content/plugins/MyApiPage/myapiscript.js"></script>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <div id="MyApiPage">Search current openings</div>
      <input id="txtsearch" type="text" />
      <input id="txtcity" type="text" />
      <button>Search</button>
    </main>
  </body>
</html>
`

const careersHtmlWithEncodedDash = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Klaus IT Solutions</title>
    <link rel="stylesheet" href="https://klausit.com/wp-content/plugins/MyApiPage/css/responsive.css" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Explore Opportunities</p>
      <div>Below are the list of opportunities at Klaus which you can explore.</div>
      <input id="txtsearch" type="text" />
      <input id="txtcity" type="text" />
    </main>
  </body>
</html>
`

const structuredJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Klaus IT Solutions</title>
  </head>
  <body>
    <main>
      <div id="MyApiPage"></div>
      <input id="txtsearch" type="text" />
      <input id="txtcity" type="text" />
      <article class="job-card">
        <h2>Java Developer</h2>
        <a href="https://klausit.com/careers/java-developer/">Apply</a>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/klausitsolutions/script.js')
  } catch {
    assert.fail('Expected Klaus IT Solutions scraper module at ../../scraper/klausitsolutions/script.js')
  }
}

test('Klaus IT Solutions returns [] only while the verified MyApiPage shell exposes no public role listings', async () => {
  const klaus = await loadModule()
  const requestedUrls = []

  assert.equal(klaus.hasOfficialKlausCareersSignals(careersHtml), true)
  assert.equal(klaus.pageExposesStructuredJobListings(careersHtml), false)

  const jobs = await klaus.createKlausITSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://klausit.com/careers/'])
  assert.deepEqual(jobs, [])
})

test('Klaus IT Solutions accepts the live encoded en-dash title and current MyApiPage shell markers', async () => {
  const klaus = await loadModule()

  assert.equal(klaus.hasOfficialKlausCareersSignals(careersHtmlWithEncodedDash), true)
  assert.equal(klaus.pageExposesStructuredJobListings(careersHtmlWithEncodedDash), false)
})

test('Klaus IT Solutions fails closed when structured public jobs appear on the careers shell', async () => {
  const klaus = await loadModule()

  await assert.rejects(
    klaus.createKlausITSolutionsScraper().run({
      fetchText: async () => structuredJobsHtml,
    }),
    /structured public job listings/i,
  )
})

test('Klaus IT Solutions fails closed when the verified careers shell identity drifts', async () => {
  const klaus = await loadModule()

  await assert.rejects(
    klaus.createKlausITSolutionsScraper().run({
      fetchText: async () => '<html><body>Unknown</body></html>',
    }),
    /official careers shell changed/i,
  )
})
