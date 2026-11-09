import assert from 'node:assert/strict'
import test from 'node:test'

const loadDrytisModule = async () => {
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
    <title>Drytis — AI builds prototypes. Humans build companies.</title>
    <meta
      name="description"
      content="AI democratized starting. Drytis democratizes finishing."
    />
  </head>
  <body>
    <header class="nav">
      <a href="/" class="nav__brand">Drytis</a>
      <nav class="nav__links">
        <a href="/about">About</a>
        <a href="/features">Features</a>
        <a href="/pricing">Pricing</a>
      </nav>
      <div class="nav__auth">
        <a href="https://studio.drytis.ai/login">Log in</a>
        <a href="https://studio.drytis.ai/login">Start Building Free</a>
      </div>
    </header>
    <main>
      <h1>AI builds prototypes. Humans build companies.</h1>
      <p>AI democratized starting. Drytis democratizes finishing.</p>
      <p>We built the door.</p>
    </main>
    <footer>
      <span>© 2026 Drytis. All rights reserved.</span>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Drytis | AI builds prototypes. Humans build companies.</title>
  </head>
  <body>
    <header class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/faq">FAQ</a>
      <a href="https://studio.drytis.ai/login">Log In</a>
      <a href="https://studio.drytis.ai/login">Try Drytis</a>
    </header>
    <main>
      <h1>You build something real Now you need someone who can finish it .</h1>
      <p>AI only gets you started. It doesn't get you finished.</p>
      <p>A real human engineer steps in.</p>
      <p>You build something that actually works.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Drytis — About</title>
    <meta
      name="description"
      content="There is not a single enterprise product on this planet built to production by AI alone. Drytis exists so finishing is just as accessible as starting."
    />
  </head>
  <body>
    <header class="nav">
      <a href="/" class="nav__brand">Drytis</a>
      <nav class="nav__links">
        <a href="/about">About</a>
        <a href="/features">Features</a>
        <a href="/pricing">Pricing</a>
      </nav>
    </header>
    <main>
      <p>We built Drytis for that exact moment.</p>
      <p>You cannot train that into a model. We made it accessible instead.</p>
      <p>If that offends you, you're probably at the wrong company.</p>
    </main>
  </body>
</html>
`

const currentAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About | Drytis</title>
  </head>
  <body>
    <header class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/faq">FAQ</a>
      <a href="https://studio.drytis.ai/login">Log In</a>
      <a href="https://studio.drytis.ai/login">Try Drytis</a>
    </header>
    <main>
      <h1>You didn't fail. AI was not enough .</h1>
      <p>You got further than most people do. A working prototype. A demo that held up. Something worth finishing.</p>
      <p>What no AI has ever done.</p>
      <p>Your instinct built this.</p>
      <p>This is for anyone with an idea worth finishing.</p>
      <p>Everyone has a prototype. Almost nobody has a product.</p>
    </main>
  </body>
</html>
`

const august2026HomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Drytis","url":"https://drytis.com/"}
    </script>
  </head>
  <body>
    <header class="nav">
      <a href="/">drytis</a>
      <a href="/solutions">Solutions</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
      <a href="https://studio.drytis.ai/login">Log In</a>
      <a href="https://studio.drytis.ai/login">Start Building</a>
    </header>
    <main>
      <h1>The gap between ‘it works’ and ‘it’s ready’ is an engineer</h1>
      <p>AI can start a project. Only a real engineer can finish one.</p>
      <p>AI writes software. Humans build companies.</p>
      <p>The moment AI says it’s done, a Drytis engineer takes over.</p>
      <p>No queue. No ticket. No waiting.</p>
    </main>
  </body>
</html>
`

const currentHomepageRedesignHtml = `
<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Drytis","url":"https://drytis.com/"}
    </script>
  </head>
  <body>
    <nav>
      <a href="/">drytis</a>
      <a href="/solutions">Solutions</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
      <a href="/careers">Careers</a>
      <a href="https://studio.drytis.ai/login">Start Building</a>
    </nav>
    <main>
      <h1>Built with AI. Finished by engineers!</h1>
      <p>AI writes software. Humans build companies. Drytis is the human part.</p>
    </main>
    <footer>© 2026 Drytis. All rights reserved.</footer>
  </body>
</html>
`

const august2026AboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Drytis","url":"https://drytis.com/"}
    </script>
  </head>
  <body>
    <header class="nav">
      <a href="/">drytis</a>
      <a href="/solutions">Solutions</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
      <a href="https://studio.drytis.ai/login">Log In</a>
      <a href="https://studio.drytis.ai/login">Start Building</a>
    </header>
    <main>
      <h1>WHAT DRYTIS IS</h1>
      <p>We turned 'hire an engineer' into something you can buy by the token.</p>
      <p>Drytis is human intelligence, tokenized and accessible.</p>
      <p>AI writes software. Drytis gives you the engineer behind it.</p>
      <p>We believe the future is built by engineers. AI just made them more powerful.</p>
      <p>Engineers deliver outcomes.</p>
      <p>To give anyone with ingenuity access to the engineering talent needed to release their vision to the world.</p>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy | Drytis - AI App Builder</title>
    <meta
      name="description"
      content="How Drytis collects, uses, and protects your personal information. Our privacy policy, cookie policy, and your privacy rights."
    />
  </head>
  <body>
    <nav id="mainNav">
      <a href="/">how it works</a>
      <a href="/lifeguard">lifeguards</a>
      <a href="/features">features</a>
      <a href="/pricing">pricing</a>
      <a href="/engineers">engineers</a>
      <a href="/about">about</a>
      <a href="/security">security</a>
      <a href="/help">help</a>
    </nav>
    <header class="hero">
      <h1>Privacy Policy</h1>
      <p>How Drytis collects, uses, and protects your personal information.</p>
    </header>
    <main>
      <div class="legal-meta">Last Updated: April 3, 2026</div>
      <p>Drytis, Inc. ("Drytis," "we," "us," or "our") provides an AI-powered software development platform.</p>
      <p>Drytis, Inc. is the controller of the personal information described in this Privacy Policy.</p>
      <ul>
        <li>Registered users of the Drytis platform, including workspace owners, collaborators, and organization admins.</li>
        <li>Job applicants and recruiting candidates who interact with Drytis in connection with employment or contractor opportunities.</li>
      </ul>
    </main>
  </body>
</html>
`

const currentPrivacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy Policy | Drytis</title>
    <meta
      name="description"
      content="How Drytis collects, uses, and protects your personal information. Our privacy policy, cookie policy, and your privacy rights."
    />
    <link rel="canonical" href="https://drytis.com/privacy">
  </head>
  <body>
    <nav id="mainNav">
      <a href="/">Home</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/faq">FAQ</a>
      <a href="https://studio.drytis.ai/login">Log in</a>
      <a href="https://studio.drytis.ai/login">Try Drytis</a>
    </nav>
    <main>
      <h1>Privacy Policy</h1>
      <p>How Drytis collects, uses, and protects your personal information.</p>
      <p>Privacy Policy</p>
      <p>Cookie Policy</p>
      <p>Last Updated: April 3, 2026</p>
      <p>Drytis, Inc. ("Drytis," "we," "us," or "our") provides an AI-powered software development platform.</p>
      <p>Job applicants and recruiting candidates who interact with Drytis in connection with employment or contractor opportunities.</p>
    </main>
  </body>
</html>
`

const termsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Terms | Drytis - AI App Builder</title>
    <meta
      name="description"
      content="Drytis terms of service, acceptable use policy, AI use policy, and data processing addendum."
    />
  </head>
  <body>
    <nav id="mainNav">
      <a href="/">how it works</a>
      <a href="/lifeguard">lifeguards</a>
      <a href="/features">features</a>
      <a href="/pricing">pricing</a>
      <a href="/engineers">engineers</a>
      <a href="/about">about</a>
      <a href="/security">security</a>
      <a href="/help">help</a>
    </nav>
    <header class="hero">
      <h1>Terms of Service</h1>
      <p>The terms, policies, and agreements that govern your use of the Drytis platform.</p>
    </header>
    <main>
      <div class="last-updated">Last updated: July 2025</div>
      <p>Drytis provides an AI-powered application building platform that allows users to create software applications using natural language prompts.</p>
      <p>Drytis charges on a pay-per-use basis.</p>
      <p>Contact us at <a href="mailto:support@drytis.com">support@drytis.com</a>.</p>
      <p>These Terms are governed by the laws of the State of Delaware, United States.</p>
    </main>
  </body>
</html>
`

const currentTermsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Terms of Service | Drytis</title>
    <meta
      name="description"
      content="Drytis terms of service, acceptable use policy, AI use policy, and data processing addendum."
    />
    <link rel="canonical" href="https://drytis.com/terms">
  </head>
  <body>
    <nav id="mainNav">
      <a href="/">Home</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
      <a href="/faq">FAQ</a>
      <a href="https://studio.drytis.ai/login">Log in</a>
      <a href="https://studio.drytis.ai/login">Try Drytis</a>
    </nav>
    <main>
      <h1>Terms of Service</h1>
      <p>The terms, policies, and agreements that govern your use of the Drytis platform.</p>
      <p>Acceptable Use</p>
      <p>AI Use Policy</p>
      <p>Data Processing</p>
      <p>Drytis charges on a pay-per-use basis.</p>
      <p>Contact us at <a href="mailto:support@drytis.com">support@drytis.com</a>.</p>
      <p>These Terms are governed by the laws of the State of Delaware, United States.</p>
    </main>
  </body>
</html>
`

const engineersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Engineers | Drytis</title>
    <meta
      name="description"
      content="Meet the vetted senior engineers behind Drytis Lifeguard."
    />
  </head>
  <body>
    <nav class="eng-nav">
      <a href="/" class="eng-nav-logo">Drytis</a>
      <div class="eng-nav-links">
        <a href="/pricing">Pricing</a>
        <a href="/#bottleneck">About Us</a>
        <a href="/engineers">Our Engineers</a>
      </div>
      <div class="eng-nav-right">
        <a href="https://studio.drytis.ai/login" class="eng-nav-login">Login</a>
        <a href="https://studio.drytis.ai/login" class="eng-nav-signup">Signup</a>
      </div>
    </nav>
    <main>
      <section class="eng-hero">
        <h1>The Moment AI Stops We Begin.</h1>
        <p>Not next week. Not after a hiring process. The moment your problem needs someone who's genuinely been there — a Drytis engineer is ready.</p>
      </section>
      <section class="eng-roster">
        <h2>NOT A DIRECTORY. NOT A MARKETPLACE.</h2>
        <p>THESE ARE PEOPLE WHO HAVE SHIPPED THE PROJECTS WAITING ON THE SHELF — AND KNOW THE WAY OUT.</p>
        <button type="button">Hire</button>
      </section>
      <section class="eng-army">
        <h2>How we build our Army.</h2>
        <p>Every engineer on Drytis is Co-Code Certified.</p>
        <span>1 in 12</span>
        <p>Applicants make it through.</p>
      </section>
      <section class="eng-cta">
        <p>An engineer is ready. The only thing between you and moving forward is the request.</p>
        <button type="button">Start building for free</button>
      </section>
    </main>
    <footer>
      <span>© 2025 Drytis. All rights reserved.</span>
    </footer>
  </body>
</html>
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://drytis.com/</loc></url>
  <url><loc>https://drytis.com/features</loc></url>
  <url><loc>https://drytis.com/lifeguard</loc></url>
  <url><loc>https://drytis.com/pricing</loc></url>
  <url><loc>https://drytis.com/security</loc></url>
  <url><loc>https://drytis.com/estimator</loc></url>
  <url><loc>https://drytis.com/help</loc></url>
  <url><loc>https://drytis.com/privacy</loc></url>
  <url><loc>https://drytis.com/terms</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://drytis.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Error response</title></head>
      <body>
        <h1>Error response</h1>
        <p>Error code: 404</p>
        <p>Message: File Not Found.</p>
        <p>Error code explanation: 404 - Nothing matches the given URI.</p>
      </body>
    </html>
  `,
}

const august2026MissingRoutePage = {
  status: 404,
  url: 'https://drytis.com/careers',
  html: '404 - page not found.',
}

const publicJobsPage = {
  status: 200,
  url: 'https://drytis.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Careers | Drytis</title></head>
      <body>
        <h1>Current Openings</h1>
        <a href="/careers/founding-engineer">Apply Now</a>
      </body>
    </html>
  `,
}

test('DRYTIS sentinel recognizes the verified homepage, legal pages, engineers route, sitemap, and missing careers routes', async () => {
  const drytis = await loadDrytisModule()
  assert.ok(drytis, 'Expected scraper module at ./script.js')

  assert.equal(drytis.SOURCE, 'drytis')
  assert.equal(drytis.COMPANY, 'DRYTIS')
  assert.equal(drytis.HOMEPAGE_URL, 'https://drytis.com/')
  assert.equal(drytis.ABOUT_URL, 'https://drytis.com/about')
  assert.equal(drytis.PRIVACY_URL, 'https://drytis.com/privacy')
  assert.equal(drytis.TERMS_URL, 'https://drytis.com/terms')
  assert.equal(drytis.ENGINEERS_URL, 'https://drytis.com/engineers')
  assert.equal(drytis.SITEMAP_URL, 'https://drytis.com/sitemap.xml')
  assert.deepEqual(drytis.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://drytis.com/careers',
    'https://drytis.com/career',
    'https://drytis.com/jobs',
    'https://drytis.com/job',
    'https://drytis.com/join-us',
    'https://drytis.com/work-with-us',
  ])
  assert.equal(drytis.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(drytis.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(drytis.hasOfficialHomepageSignal(august2026HomepageHtml), true)
  assert.equal(drytis.hasOfficialHomepageSignal(currentHomepageRedesignHtml), true)
  assert.equal(drytis.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(drytis.hasOfficialAboutSignal(currentAboutHtml), true)
  assert.equal(drytis.hasOfficialAboutSignal(august2026AboutHtml), true)
  assert.equal(drytis.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(drytis.hasOfficialPrivacySignal(currentPrivacyHtml), true)
  assert.equal(drytis.hasOfficialTermsSignal(termsHtml), true)
  assert.equal(drytis.hasOfficialTermsSignal(currentTermsHtml), true)
  assert.equal(drytis.hasOfficialEngineersSignal(engineersHtml), true)
  assert.equal(drytis.pageHasExpectedEngineersLink(privacyHtml), true)
  assert.equal(drytis.pageHasExpectedEngineersLink(termsHtml), true)
  assert.equal(drytis.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(drytis.hasPublicJobsSignal(privacyHtml), false)
  assert.equal(drytis.hasPublicJobsSignal(termsHtml), false)
  assert.equal(drytis.hasPublicJobsSignal(engineersHtml), false)
  assert.equal(drytis.sitemapHasUnexpectedCareerLikeUrl(sitemapXml), false)
  assert.equal(drytis.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
  assert.equal(drytis.isVerifiedMissingCareerRoute(august2026MissingRoutePage), true)
})

test('DRYTIS sentinel returns no jobs only while the verified first-party surfaces stay public-jobs-free', async () => {
  const drytis = await loadDrytisModule()
  assert.ok(drytis, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await drytis.createDrytisScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === drytis.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === drytis.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === drytis.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
      if (url === drytis.TERMS_URL) return { status: 200, url, html: termsHtml }
      if (url === drytis.ENGINEERS_URL) return { status: 200, url, html: engineersHtml }
      if (url === drytis.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (drytis.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    drytis.HOMEPAGE_URL,
    drytis.ABOUT_URL,
    drytis.PRIVACY_URL,
    drytis.TERMS_URL,
    drytis.ENGINEERS_URL,
    drytis.SITEMAP_URL,
    ...drytis.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('DRYTIS sentinel accepts the August 20, 2026 redesign while the retired routes stay missing', async () => {
  const drytis = await loadDrytisModule()
  assert.ok(drytis, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const retiredRouteUrls = [
    drytis.PRIVACY_URL,
    drytis.TERMS_URL,
    drytis.ENGINEERS_URL,
    drytis.SITEMAP_URL,
  ]

  const jobs = await drytis.createDrytisScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === drytis.HOMEPAGE_URL) return { status: 200, url, html: august2026HomepageHtml }
      if (url === drytis.ABOUT_URL) return { status: 200, url, html: august2026AboutHtml }
      if (retiredRouteUrls.includes(url)) return { ...august2026MissingRoutePage, url }
      if (drytis.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...august2026MissingRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    drytis.HOMEPAGE_URL,
    drytis.ABOUT_URL,
    ...retiredRouteUrls,
    ...drytis.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('DRYTIS sentinel fails closed when the verified no-public-careers contract drifts', async () => {
  const drytis = await loadDrytisModule()
  assert.ok(drytis, 'Expected scraper module at ./script.js')

  await assert.rejects(
    drytis.createDrytisScraper().run({
      fetchPage: async (url) => {
        if (url === drytis.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === drytis.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === drytis.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === drytis.TERMS_URL) return { status: 200, url, html: termsHtml }
        if (url === drytis.ENGINEERS_URL) return publicJobsPage
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified engineers page|public jobs surface/i,
  )

  await assert.rejects(
    drytis.createDrytisScraper().run({
      fetchPage: async (url) => {
        if (url === drytis.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === drytis.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === drytis.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === drytis.TERMS_URL) return { status: 200, url, html: termsHtml }
        if (url === drytis.ENGINEERS_URL) return { status: 200, url, html: engineersHtml }
        if (url === drytis.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://drytis.com/careers</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    drytis.createDrytisScraper().run({
      fetchPage: async (url) => {
        if (url === drytis.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === drytis.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === drytis.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === drytis.TERMS_URL) return { status: 200, url, html: termsHtml }
        if (url === drytis.ENGINEERS_URL) return { status: 200, url, html: engineersHtml }
        if (url === drytis.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === drytis.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (drytis.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
