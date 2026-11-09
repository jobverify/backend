import assert from 'node:assert/strict'
import test from 'node:test'

const loadGravityAIModule = async () => {
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
    <title>gravityAI</title>
    <link rel="canonical" href="https://www.gravity-ai.com/" />
  </head>
  <body>
    <header>
      <a href="/pricing/">Pricing</a>
      <a href="https://app.gravity-ai.com/catalog">Catalog</a>
      <a href="https://docs.gravity-ai.com/">Documentation</a>
      <a href="https://enterprise.gravity-ai.com/tenant/login">Sign In</a>
    </header>
    <main>
      <h1>Build and Deploy AI. Every Team. Every Model. Fully Governed.</h1>
      <p>Stop managing AI chaos across tools and teams.</p>
      <p>gravityAI gives everyone a shared workspace, with governance that doesn't slow you down.</p>
      <p>Trusted by 50,000+ developers and enterprises:</p>
      <a href="/about-us/">About us</a>
    </main>
    <footer>
      <p>© 2019-2026 gravityAI. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head=""></title>
    <meta
      name="description"
      content="Build, deploy, and scale AI models securely with gravityAI. Private Cloud, on-prem, and air-gapped deployments with enterprise governance built in."
    />
  </head>
  <body>
    <header>
      <a href="/pricing/">Pricing</a>
      <a href="https://app.gravity-ai.com/catalog">Catalog</a>
      <a href="https://docs.gravity-ai.com/">Documentation</a>
      <a href="https://enterprise.gravity-ai.com/tenant/login">Sign In</a>
    </header>
    <main>
      <h1>Build and Deploy AI. Every Team. Every Model. Fully Governed.</h1>
      <p>Stop managing AI chaos across tools and teams.</p>
      <p>gravityAI gives everyone a shared workspace, with governance that doesn&#x27;t slow you down.</p>
      <p>Trusted by 50,000+ developers and enterprises:</p>
      <a href="/about-us/">About us</a>
    </main>
    <footer>
      <p>© 2019-2026 gravityAI. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About us | gravityAI</title>
  </head>
  <body>
    <main>
      <h1>gravityAI is an enterprise AI platform for building, deploying, and governing multi-model workflows.</h1>
      <h2>Securely and at scale.</h2>
      <p>We’re the team behind gravityAI</p>
      <p>An AI infrastructure platform built by people who got tired of cool models going nowhere.</p>
      <p>We wanted something that adds gravity—bringing models, workflows, and governance into one place so teams can actually ship and scale.</p>
    </main>
    <footer>
      <p>© 2019-2026 gravityAI. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.gravity-ai.com/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.gravity-ai.com/</loc></url>
  <url><loc>https://www.gravity-ai.com/blog/</loc></url>
  <url><loc>https://www.gravity-ai.com/privacy-policy/</loc></url>
  <url><loc>https://www.gravity-ai.com/terms/</loc></url>
  <url><loc>https://www.gravity-ai.com/about-us/</loc></url>
  <url><loc>https://www.gravity-ai.com/contact/</loc></url>
  <url><loc>https://www.gravity-ai.com/pricing/</loc></url>
  <url><loc>https://www.gravity-ai.com/data-scientist/</loc></url>
  <url><loc>https://www.gravity-ai.com/platform-engineer/</loc></url>
</urlset>
`

const dataScientistHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.gravity-ai.com/data-scientist/" />
  </head>
  <body>
    <header>
      <a href="/pricing/">Pricing</a>
      <a href="https://docs.gravity-ai.com/">Documentation</a>
    </header>
    <article>
      <h1>Data Scientist</h1>
    </article>
    <footer>
      <a href="/about-us/">About us</a>
      <p>© 2019-2026 gravityAI. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const platformEngineerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://www.gravity-ai.com/platform-engineer/" />
  </head>
  <body>
    <article>
      <h2>Standardize AI deployments—once—and run them everywhere.</h2>
      <h4>gravityAI gives platform teams a private, internal AI marketplace where models ship as containers, pass review, and deploy consistently—on-prem or in your cloud.</h4>
      <a href="https://www.gravity-ai.com/contact-us">Book a demo</a>
      <p>You package the model as a container. You approve it once. Your org reuses it safely—without re-integration every time.</p>
      <p>Trust that scales</p>
    </article>
    <footer>
      <p>© 2019-2026 gravityAI. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.gravity-ai.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <link rel="canonical" href="https://www.gravity-ai.com/404/" />
        <title>404: This page could not be found</title>
      </head>
      <body>
        <h1>404</h1>
        <h2>This page could not be found.</h2>
        <a href="https://enterprise.gravity-ai.com/tenant/login">Sign In</a>
        <p>© 2019-2025 gravityAI. All rights reserved.</p>
      </body>
    </html>
  `,
}

const currentMissingCareerRoutePage = {
  status: 404,
  url: 'https://www.gravity-ai.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <link rel="canonical" href="https://www.gravity-ai.com/404/" />
        <title>404: This page could not be found</title>
      </head>
      <body>
        <a href="https://enterprise.gravity-ai.com/tenant/login">Sign In</a>
        <h1>404</h1>
        <h2>This page could not be found .</h2>
        <p>© 2019-2025 gravityAI. All rights reserved.</p>
      </body>
    </html>
  `,
}

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | gravityAI</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/gravity-ai/founding-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Gravity AI sentinel recognizes the verified homepage, about page, sitemap, role pages, and missing careers routes', async () => {
  const gravityai = await loadGravityAIModule()
  assert.ok(gravityai, 'Expected Gravity AI scraper module at ./script.js')

  assert.equal(gravityai.SOURCE, 'gravityai')
  assert.equal(gravityai.COMPANY, 'Gravity AI')
  assert.equal(gravityai.HOMEPAGE_URL, 'https://www.gravity-ai.com/')
  assert.equal(gravityai.ABOUT_URL, 'https://www.gravity-ai.com/about-us/')
  assert.equal(gravityai.SITEMAP_INDEX_URL, 'https://www.gravity-ai.com/sitemap.xml')
  assert.equal(gravityai.SITEMAP_URL, 'https://www.gravity-ai.com/sitemap-0.xml')
  assert.deepEqual(gravityai.ROLE_PAGE_URLS, [
    'https://www.gravity-ai.com/data-scientist/',
    'https://www.gravity-ai.com/platform-engineer/',
  ])
  assert.deepEqual(gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.gravity-ai.com/careers',
    'https://www.gravity-ai.com/career',
    'https://www.gravity-ai.com/jobs',
    'https://www.gravity-ai.com/join-us',
  ])
  assert.deepEqual(gravityai.EXPECTED_SITEMAP_URLS, [
    'https://www.gravity-ai.com/',
    'https://www.gravity-ai.com/about-us/',
    'https://www.gravity-ai.com/contact/',
    'https://www.gravity-ai.com/pricing/',
    'https://www.gravity-ai.com/data-scientist/',
    'https://www.gravity-ai.com/platform-engineer/',
  ])

  assert.equal(gravityai.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(gravityai.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(gravityai.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(gravityai.hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.deepEqual(gravityai.extractSitemapUrls(sitemapXml), [
    'https://www.gravity-ai.com/',
    'https://www.gravity-ai.com/blog/',
    'https://www.gravity-ai.com/privacy-policy/',
    'https://www.gravity-ai.com/terms/',
    'https://www.gravity-ai.com/about-us/',
    'https://www.gravity-ai.com/contact/',
    'https://www.gravity-ai.com/pricing/',
    'https://www.gravity-ai.com/data-scientist/',
    'https://www.gravity-ai.com/platform-engineer/',
  ])
  assert.equal(gravityai.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(
    gravityai.hasVerifiedRolePageSignal(gravityai.ROLE_PAGE_URLS[0], dataScientistHtml),
    true,
  )
  assert.equal(
    gravityai.hasVerifiedRolePageSignal(gravityai.ROLE_PAGE_URLS[1], platformEngineerHtml),
    true,
  )
  assert.equal(gravityai.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(gravityai.hasPublicJobsSignal(aboutHtml), false)
  assert.equal(gravityai.hasPublicJobsSignal(dataScientistHtml), false)
  assert.equal(gravityai.hasPublicJobsSignal(platformEngineerHtml), false)
  assert.equal(gravityai.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
  assert.equal(gravityai.isVerifiedMissingCareerRoute(currentMissingCareerRoutePage), true)
})

test('Gravity AI sentinel accepts the current homepage entity encoding and branded 404 careers routes', async () => {
  const gravityai = await loadGravityAIModule()
  assert.ok(gravityai, 'Expected Gravity AI scraper module at ./script.js')

  const jobs = await gravityai.createGravityAIScraper().run({
    fetchPage: async (url) => {
      if (url === gravityai.HOMEPAGE_URL) return { status: 200, url, html: currentHomepageHtml }
      if (url === gravityai.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === gravityai.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === gravityai.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === gravityai.ROLE_PAGE_URLS[0]) return { status: 200, url, html: dataScientistHtml }
      if (url === gravityai.ROLE_PAGE_URLS[1]) return { status: 200, url, html: platformEngineerHtml }
      if (gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...currentMissingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Gravity AI sentinel returns no jobs only while the verified first-party surface remains unchanged', async () => {
  const gravityai = await loadGravityAIModule()
  assert.ok(gravityai, 'Expected Gravity AI scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await gravityai.createGravityAIScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === gravityai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === gravityai.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === gravityai.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === gravityai.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (url === gravityai.ROLE_PAGE_URLS[0]) return { status: 200, url, html: dataScientistHtml }
      if (url === gravityai.ROLE_PAGE_URLS[1]) return { status: 200, url, html: platformEngineerHtml }
      if (gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    gravityai.HOMEPAGE_URL,
    gravityai.ABOUT_URL,
    gravityai.SITEMAP_INDEX_URL,
    gravityai.SITEMAP_URL,
    ...gravityai.ROLE_PAGE_URLS,
    ...gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Gravity AI sentinel fails closed when the verified no-public-jobs surface drifts', async () => {
  const gravityai = await loadGravityAIModule()
  assert.ok(gravityai, 'Expected Gravity AI scraper module at ./script.js')

  await assert.rejects(
    gravityai.createGravityAIScraper().run({
      fetchPage: async (url) => {
        if (url === gravityai.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    gravityai.createGravityAIScraper().run({
      fetchPage: async (url) => {
        if (url === gravityai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === gravityai.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === gravityai.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === gravityai.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://www.gravity-ai.com/careers/</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    gravityai.createGravityAIScraper().run({
      fetchPage: async (url) => {
        if (url === gravityai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === gravityai.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === gravityai.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === gravityai.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === gravityai.ROLE_PAGE_URLS[0]) {
          return {
            status: 200,
            url,
            html: dataScientistHtml.replace('</article>', '<a href="/careers/ml-engineer">Apply now</a></article>'),
          }
        }
        if (url === gravityai.ROLE_PAGE_URLS[1]) return { status: 200, url, html: platformEngineerHtml }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified role page/i,
  )

  await assert.rejects(
    gravityai.createGravityAIScraper().run({
      fetchPage: async (url) => {
        if (url === gravityai.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === gravityai.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === gravityai.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === gravityai.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === gravityai.ROLE_PAGE_URLS[0]) return { status: 200, url, html: dataScientistHtml }
        if (url === gravityai.ROLE_PAGE_URLS[1]) return { status: 200, url, html: platformEngineerHtml }
        if (url === gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return { status: 200, url, html: publicJobsHtml }
        if (gravityai.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
