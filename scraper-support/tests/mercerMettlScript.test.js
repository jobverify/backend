import assert from 'node:assert/strict'
import test from 'node:test'

const mercerHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mercer | Mettl: Best Online Talent Assessment Company - Assessments, Platform, and Proctoring</title>
  </head>
  <body>
    <main>
      <h1>Mercer | Mettl</h1>
      <a href="https://mercermettl.com/careers/">Careers</a>
      <p>Best online talent assessment company.</p>
    </main>
  </body>
</html>
`

const mettlHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Talent Assessment Company - Online Tools &amp; Software Platform | Mercer | Mettl</title>
  </head>
  <body>
    <main>
      <h1>Mettl</h1>
      <a href="https://mettl.com/careers/">Careers</a>
      <p>Mercer | Mettl talent assessment platform.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers Mercer | Mettl&#x27;s Paint your future</title>
    <link rel="canonical" href="https://mettl.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>If you want to work with us, please search for relevant openings on our LinkedIn page or write to us: talentacquisition_mettl@mmc.com</p>
      <a href="https://mettl.com/">Visit home</a>
    </main>
  </body>
</html>
`

const missingRoute404Html = `
<!doctype html>
<html lang="en">
  <head></head>
  <body>
    <main>
      <h1>404</h1>
      <p>Page not found</p>
    </main>
  </body>
</html>
`

const loadMercerMettlModule = async () => {
  try {
    return await import('../../scraper/mercermettl/script.js')
  } catch {
    assert.fail('Expected Mercer | Mettl scraper module at ../../scraper/mercermettl/script.js')
  }
}

test('Mercer | Mettl sentinel recognizes the verified dual-domain homepage and careers surfaces', async () => {
  const mercerMettl = await loadMercerMettlModule()

  assert.equal(mercerMettl.SOURCE, 'mercermettl')
  assert.equal(mercerMettl.COMPANY, 'Mercer | Mettl')
  assert.equal(mercerMettl.LINKEDIN_HANDOFF_TEXT, 'search for relevant openings on our linkedin page')
  assert.equal(mercerMettl.TALENT_EMAIL, 'talentacquisition_mettl@mmc.com')
  assert.equal(mercerMettl.MERCER_METTL_SITE.homepageUrl, 'https://mercermettl.com/')
  assert.equal(mercerMettl.MERCER_METTL_SITE.careersUrl, 'https://mercermettl.com/careers/')
  assert.equal(mercerMettl.METTL_SITE.homepageUrl, 'https://mettl.com/')
  assert.equal(mercerMettl.METTL_SITE.careersUrl, 'https://mettl.com/careers/')
  assert.equal(mercerMettl.hasOfficialHomepageSignal(mercerHomepageHtml, mercerMettl.MERCER_METTL_SITE), true)
  assert.equal(mercerMettl.hasOfficialHomepageSignal(mettlHomepageHtml, mercerMettl.METTL_SITE), true)
  assert.equal(mercerMettl.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mercerMettl.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Mercer | Mettl sentinel returns [] only while both first-party careers pages remain LinkedIn handoffs', async () => {
  const mercerMettl = await loadMercerMettlModule()
  const requestedUrls = []

  const jobs = await mercerMettl.createMercerMettlScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mercerMettl.MERCER_METTL_SITE.homepageUrl) {
        return { status: 200, url, html: mercerHomepageHtml }
      }
      if (url === mercerMettl.MERCER_METTL_SITE.careersUrl) {
        return { status: 200, url, html: careersHtml }
      }
      if (mercerMettl.MERCER_METTL_SITE.missingRouteUrls.includes(url)) {
        return { status: 200, url: mercerMettl.MERCER_METTL_SITE.homepageUrl, html: mercerHomepageHtml }
      }
      if (url === mercerMettl.METTL_SITE.homepageUrl) {
        return { status: 200, url, html: mettlHomepageHtml }
      }
      if (url === mercerMettl.METTL_SITE.careersUrl) {
        return { status: 200, url, html: careersHtml }
      }
      if (mercerMettl.METTL_SITE.missingRouteUrls.includes(url)) {
        return { status: 200, url: mercerMettl.METTL_SITE.homepageUrl, html: mettlHomepageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mercerMettl.MERCER_METTL_SITE.homepageUrl,
    mercerMettl.MERCER_METTL_SITE.careersUrl,
    ...mercerMettl.MERCER_METTL_SITE.missingRouteUrls,
    mercerMettl.METTL_SITE.homepageUrl,
    mercerMettl.METTL_SITE.careersUrl,
    ...mercerMettl.METTL_SITE.missingRouteUrls,
  ])
  assert.deepEqual(jobs, [])
})

test('Mercer | Mettl sentinel also returns [] when same-domain missing routes now resolve to verified 404 pages', async () => {
  const mercerMettl = await loadMercerMettlModule()
  const requestedUrls = []

  const jobs = await mercerMettl.createMercerMettlScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mercerMettl.MERCER_METTL_SITE.homepageUrl) {
        return { status: 200, url, html: mercerHomepageHtml }
      }
      if (url === mercerMettl.MERCER_METTL_SITE.careersUrl) {
        return { status: 200, url, html: careersHtml }
      }
      if (mercerMettl.MERCER_METTL_SITE.missingRouteUrls.includes(url)) {
        return { status: 404, url: `${url}/`, html: missingRoute404Html }
      }
      if (url === mercerMettl.METTL_SITE.homepageUrl) {
        return { status: 200, url, html: mettlHomepageHtml }
      }
      if (url === mercerMettl.METTL_SITE.careersUrl) {
        return { status: 200, url, html: careersHtml }
      }
      if (mercerMettl.METTL_SITE.missingRouteUrls.includes(url)) {
        return { status: 404, url: `${url}/`, html: missingRoute404Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mercerMettl.MERCER_METTL_SITE.homepageUrl,
    mercerMettl.MERCER_METTL_SITE.careersUrl,
    ...mercerMettl.MERCER_METTL_SITE.missingRouteUrls,
    mercerMettl.METTL_SITE.homepageUrl,
    mercerMettl.METTL_SITE.careersUrl,
    ...mercerMettl.METTL_SITE.missingRouteUrls,
  ])
  assert.deepEqual(jobs, [])
})

test('Mercer | Mettl sentinel fails closed when the verified careers or route contracts drift', async () => {
  const mercerMettl = await loadMercerMettlModule()

  await assert.rejects(
    mercerMettl.createMercerMettlScraper().run({
      fetchPage: async (url) => {
        if (url === mercerMettl.MERCER_METTL_SITE.homepageUrl) {
          return { status: 200, url, html: mercerHomepageHtml }
        }
        if (url === mercerMettl.MERCER_METTL_SITE.careersUrl) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    mercerMettl.createMercerMettlScraper().run({
      fetchPage: async (url) => {
        if (url === mercerMettl.MERCER_METTL_SITE.homepageUrl) {
          return { status: 200, url, html: mercerHomepageHtml }
        }
        if (url === mercerMettl.MERCER_METTL_SITE.careersUrl) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              '</main>',
              '<a href="https://jobs.lever.co/mercermettl/software-engineer">Apply now</a></main>',
            ),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
