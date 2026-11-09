import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>iBall &ndash; Electronics &amp; Peripherals</title>
  </head>
  <body>
    <nav>
      <a href="/pages/about-us">About iBall</a>
      <a href="/blogs/news-center">News Center</a>
      <a href="/pages/contact">Contact Us</a>
      <a href="/pages/service-centers">Service Centers</a>
    </nav>
    <main>
      <h1>Our Range</h1>
      <p>Upgrade your digital lifestyle with quality audio, performance peripherals, and practical accessories.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us &ndash; iBall</title>
  </head>
  <body>
    <h1>About iBall</h1>
    <p>Commitment to India</p>
    <p>Corporate Office</p>
    <a href="mailto:enquiry@iball.co.in">enquiry@iball.co.in</a>
  </body>
</html>
`

const newsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>News Center &ndash; iBall</title>
  </head>
  <body>
    <h1>News Center</h1>
    <p>Press Release</p>
    <p>Cinebar 560</p>
    <p>Glidr AI1</p>
    <p>Zebronics</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/iball/script.js')
  } catch {
    assert.fail('Expected iBall scraper module at ../../scraper/iball/script.js')
  }
}

test('iBall recognizes the current homepage, about page, and news center as zero-job first-party surfaces', async () => {
  const iball = await loadModule()

  assert.equal(iball.SOURCE, 'iball')
  assert.equal(iball.COMPANY, 'iBall')
  assert.equal(iball.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(iball.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(iball.hasOfficialNewsCenterSignal(newsHtml), true)
  assert.equal(iball.hasPublicJobsSignal(homepageHtml), false)
})

test('iBall returns no jobs while the verified public pages expose no public jobs surface', async () => {
  const iball = await loadModule()
  const requestedUrls = []

  const jobs = await iball.createIBallScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === iball.HOMEPAGE_URL) return { ok: true, status: 200, url, text: homepageHtml }
      if (url === iball.ABOUT_URL) return { ok: true, status: 200, url, text: aboutHtml }
      if (url === iball.NEWS_CENTER_URL) return { ok: true, status: 200, url, text: newsHtml }
      return { ok: false, status: 404, url, text: '' }
    },
  })

  assert.deepEqual(requestedUrls.slice(0, 3), [
    iball.HOMEPAGE_URL,
    iball.ABOUT_URL,
    iball.NEWS_CENTER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('iBall fails closed when a careers route starts exposing a public jobs surface', async () => {
  const iball = await loadModule()

  await assert.rejects(
    iball.createIBallScraper().run({
      fetchPage: async (url) => {
        if (url === iball.HOMEPAGE_URL) return { ok: true, status: 200, url, text: homepageHtml }
        if (url === iball.ABOUT_URL) return { ok: true, status: 200, url, text: aboutHtml }
        if (url === iball.NEWS_CENTER_URL) return { ok: true, status: 200, url, text: newsHtml }
        if (url === iball.COMMON_CAREERS_ROUTES[0]) {
          return {
            ok: true,
            status: 200,
            url,
            text: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }
        return { ok: false, status: 404, url, text: '' }
      },
    }),
    /public jobs surface/i,
  )
})
