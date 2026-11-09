import assert from 'node:assert/strict'
import test from 'node:test'

const loadPixbotModule = async () => {
  try {
    return await import(new URL(`./script.js?ts=${Date.now()}`, import.meta.url).href)
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return {}
    }

    throw error
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Home - Pixbot</title>
    </head>
    <body>
      <nav>
        <a href="https://pixbot.co/">Home</a>
        <a href="https://pixbot.co/services/">Services</a>
        <a href="https://pixbot.co/portfolio/">Portfolio</a>
        <a href="https://pixbot.co/blog-posts/">Blog</a>
        <a href="https://pixbot.co/about/">About</a>
        <a href="https://pixbot.co/contact/">Contact</a>
      </nav>
      <main>
        <h1>Video Production Company Central Florida</h1>
        <p>Build Brand Awareness | Showcase Products | Promote Services | Tell Your Story</p>
        <p>CONTACT US</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head>
      <title>About - Pixbot</title>
    </head>
    <body>
      <nav>
        <a href="https://pixbot.co/">Home</a>
        <a href="https://pixbot.co/services/">Services</a>
        <a href="https://pixbot.co/portfolio/">Portfolio</a>
        <a href="https://pixbot.co/blog-posts/">Blog</a>
        <a href="https://pixbot.co/about/">About</a>
        <a href="https://pixbot.co/contact/">Contact</a>
      </nav>
      <main>
        <h1>Why We rock!</h1>
        <h2>WHO WE ARE?</h2>
        <p>pixbot is a full service video production company based out of Central Florida.</p>
        <p>We create content that helps businesses connect with viewers, build brand awareness and promote products and services.</p>
        <p>Our Mission is to help businesses use their story to connect with audiences and build their brand awareness by leveraging the power of high quality video and storytelling to showcase your brand messaging.</p>
      </main>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <head>
      <title>Contact - Pixbot</title>
    </head>
    <body>
      <nav>
        <a href="https://pixbot.co/">Home</a>
        <a href="https://pixbot.co/services/">Services</a>
        <a href="https://pixbot.co/portfolio/">Portfolio</a>
        <a href="https://pixbot.co/blog-posts/">Blog</a>
        <a href="https://pixbot.co/about/">About</a>
        <a href="https://pixbot.co/contact/">Contact</a>
      </nav>
      <main>
        <h1>CONTACT US</h1>
        <p>We're Ready, Let's Talk.</p>
        <p>Email Us: cs@pixbotad.com</p>
        <p>Call Us: 609 712 8804</p>
      </main>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://pixbot.co/</loc></url>
    <url><loc>https://pixbot.co/services/</loc></url>
    <url><loc>https://pixbot.co/portfolio/</loc></url>
    <url><loc>https://pixbot.co/about/</loc></url>
    <url><loc>https://pixbot.co/blog-posts/</loc></url>
    <url><loc>https://pixbot.co/contact/</loc></url>
    <url><loc>https://pixbot.co/lets-talk-branding-marketing/</loc></url>
    <url><loc>https://pixbot.co/mission/</loc></url>
    <url><loc>https://pixbot.co/home-2/</loc></url>
  </urlset>
`

const missingCareersHtml = `
  <html>
    <head>
      <title>Page not found - Pixbot</title>
    </head>
    <body>
      <nav>
        <a href="https://pixbot.co/">Home</a>
        <a href="https://pixbot.co/services/">Services</a>
        <a href="https://pixbot.co/portfolio/">Portfolio</a>
        <a href="https://pixbot.co/blog-posts/">Blog</a>
        <a href="https://pixbot.co/about/">About</a>
        <a href="https://pixbot.co/contact/">Contact</a>
      </nav>
      <main>
        <p>This page doesn't seem to exist.</p>
        <p>It looks like the link pointing here was faulty. Maybe try searching?</p>
      </main>
    </body>
  </html>
`

test('Pixbot sentinel exports the verified first-party routes and stable no-careers signals', async () => {
  const subject = await loadPixbotModule()

  assert.equal(subject.HOMEPAGE_URL, 'https://pixbot.co/')
  assert.equal(subject.ABOUT_URL, 'https://pixbot.co/about/')
  assert.equal(subject.CONTACT_URL, 'https://pixbot.co/contact/')
  assert.equal(subject.PAGE_SITEMAP_URL, 'https://pixbot.co/page-sitemap.xml')
  assert.deepEqual(subject.CAREERS_ROUTE_URLS, [
    'https://pixbot.co/careers/',
    'https://pixbot.co/career/',
    'https://pixbot.co/jobs/',
    'https://pixbot.co/join-us/',
    'https://pixbot.co/work-with-us/',
    'https://pixbot.co/openings/',
  ])
  assert.equal(subject.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(subject.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(subject.hasOfficialContactSignal(contactHtml), true)
  assert.equal(subject.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(subject.isVerifiedMissingCareersRoute({
    url: 'https://pixbot.co/careers/',
    html: missingCareersHtml,
  }), true)
})

test('run returns an empty array while Pixbot only exposes the verified first-party no-careers contract', async () => {
  const subject = await loadPixbotModule()
  const requestedUrls = []

  const jobs = await subject.createPixbotScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === subject.HOMEPAGE_URL) {
        return { url, html: homepageHtml }
      }

      if (url === subject.ABOUT_URL) {
        return { url, html: aboutHtml }
      }

      if (url === subject.CONTACT_URL) {
        return { url, html: contactHtml }
      }

      if (url === subject.PAGE_SITEMAP_URL) {
        return { url, html: pageSitemapXml }
      }

      if (subject.CAREERS_ROUTE_URLS.includes(url)) {
        return { url, html: missingCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    subject.HOMEPAGE_URL,
    subject.ABOUT_URL,
    subject.CONTACT_URL,
    subject.PAGE_SITEMAP_URL,
    ...subject.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('run throws when Pixbot first-party pages drift into a public careers surface', async () => {
  const subject = await loadPixbotModule()
  const driftedSitemapXml = `${pageSitemapXml}
    <url><loc>https://pixbot.co/careers/</loc></url>
  `

  await assert.rejects(
    subject.createPixbotScraper().run({
      fetchPage: async (url) => {
        if (url === subject.HOMEPAGE_URL) {
          return { url, html: homepageHtml }
        }

        if (url === subject.ABOUT_URL) {
          return { url, html: aboutHtml }
        }

        if (url === subject.CONTACT_URL) {
          return { url, html: contactHtml }
        }

        if (url === subject.PAGE_SITEMAP_URL) {
          return { url, html: driftedSitemapXml }
        }

        if (subject.CAREERS_ROUTE_URLS.includes(url)) {
          return { url, html: missingCareersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers|jobs|drift/i,
  )
})

test('run classifies Pixbot ModSecurity 406 blocks as upstream soft failures', async () => {
  const subject = await loadPixbotModule()

  await assert.rejects(
    subject.createPixbotScraper().run({
      fetchPage: async () => ({
        status: 406,
        url: subject.HOMEPAGE_URL,
        html: '<html><head><title>Not Acceptable!</title></head><body><p>An appropriate representation of the requested resource could not be found on this server. This error was generated by Mod_Security.</p></body></html>',
      }),
    }),
    (error) => {
      assert.match(error.message, /ModSecurity \(HTTP 406\)/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      return true
    },
  )
})
