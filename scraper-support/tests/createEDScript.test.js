import assert from 'node:assert/strict'
import test from 'node:test'

const loadCreateEDModule = async () => {
  try {
    return await import('../../scraper/createed/script.js')
  } catch {
    assert.fail('Expected CreatED scraper module at ../../scraper/createed/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CreatED | Inspiring the Innovators of Tomorrow</title>
    <link rel="canonical" href="https://www.create-ed.in"/>
  </head>
  <body>
    <nav>HOME Reach Out About Programs</nav>
    <h1>INSPIRING THE INNOVATORS OF TOMORROW</h1>
    <p>CreatED is an innovation hub empowering high school students to ideate, create, and build groundbreaking projects.</p>
    <a href="/schedule-a-consultation">Schedule A Consultation</a>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About | CreatED</title>
    <link rel="canonical" href="https://www.create-ed.in/about"/>
  </head>
  <body>
    <h1>About</h1>
    <p>Aashna Saraf</p>
    <p>Harvard University</p>
    <p>Aashna founded CreatEd with the vision of turning curiosity into creation.</p>
    <p>Founder &amp; CEO</p>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.create-ed.in</loc></url>
  <url><loc>https://www.create-ed.in/about</loc></url>
  <url><loc>https://www.create-ed.in/schedule-a-consultation</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Error: Page Not Found</title>
  </head>
  <body>
    <h1>404 Error: Page Not Found</h1>
  </body>
</html>
`

test('CreatED surface validators accept the current no-public-careers homepage and about-page signals', async () => {
  const createED = await loadCreateEDModule()

  assert.equal(createED.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(createED.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(createED.sitemapHasExpectedCorePages(sitemapXml), true)
  assert.equal(createED.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(createED.isVerifiedMissingCareerRoute({ status: 404, html: missingRouteHtml }), true)
})

test('CreatED run returns an empty result when the verified no-public-careers routes remain missing', async () => {
  const createED = await loadCreateEDModule()

  const jobs = await createED.createCreatEDScraper().run({
    fetchPage: async (url) => {
      if (url === createED.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }
      if (url === createED.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }
      if (url === createED.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }
      return { status: 404, url, html: missingRouteHtml }
    },
  })

  assert.deepEqual(jobs, [])
})
