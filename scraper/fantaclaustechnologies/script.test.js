import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_ALIAS_URLS,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  LEGAL_HOME_URL,
  MISSING_ROUTE_URLS,
  SITEMAP_URL,
  SOURCE,
  createFantaclausTechnologiesScraper,
  extractPublicJobs,
  hasLegalRedirectSignal,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialSitemapSignal,
  hasVerifiedCareersAlias,
  hasVerifiedCareersLink,
  isVerifiedMissingRoute,
} from './script.js'

const legalRedirectHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Redirecting</title>
      <meta http-equiv="refresh" content="0; url=https://www.inteligenai.com" />
    </head>
    <body>
      <h1>Redirecting</h1>
      <a href="https://www.inteligenai.com">link</a>
    </body>
  </html>
`

const homepageHtml = `
  <html>
    <head>
      <title>Custom AI Development for Enterprise | InteligenAI</title>
      <link rel="canonical" href="https://inteligenai.com/" />
      <meta property="og:site_name" content="InteligenAI" />
    </head>
    <body>
      <nav>
        <a href="https://inteligenai.com/careers/" class="menu-link">Careers</a>
      </nav>
      <h1>Enterprise-grade custom AI solutions</h1>
      <p>Trusted by startups and enterprises</p>
      <p>Sukrit Goel</p>
      <p>Swati Jain Goel</p>
      <p><a href="mailto:contact@inteligenai.com">contact@inteligenai.com</a></p>
      <footer>
        <p>Copyright © 2026 Fantaclaus Technologies Pvt. Ltd. | Powered by inteligenai</p>
      </footer>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://inteligenai.com/about/</loc></url>
    <url><loc>https://inteligenai.com/contact/</loc></url>
    <url><loc>https://inteligenai.com/careers/</loc></url>
    <url><loc>https://inteligenai.com/tools/</loc></url>
  </urlset>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers - inteligenai</title>
      <link rel="canonical" href="https://inteligenai.com/careers/" />
    </head>
    <body>
      <h2>Careers</h2>
      <h3>Know more about InteligenAI</h3>
      <p>Explore our current openings</p>

      <div class="role-card">
        <h3>AI Development Engineer</h3>
        <div class="elementor-widget-container">
          <h5><strong>Gurugram | Full-Time</strong></h5>
          <p><strong>About the Role:</strong></p>
          <p>We are looking for smart, curious freshers to join as AI Development Engineers.</p>
          <p><strong>Compensation:</strong></p>
          <p>8-12 LPA (Fixed)</p>
          <p><strong>Eligibility Criteria:</strong></p>
          <ul>
            <li>B.Tech (2025 or 2026 pass-out)</li>
            <li>JEE Main Common Rank List (CRL) Rank under 50,000.</li>
          </ul>
        </div>
        <div class="elementor-button-wrapper">
          <a href="https://forms.gle/DUeAiQoUSxfhQAbf6" target="_blank" rel="noopener">
            <span class="elementor-button-content-wrapper">
              <span class="elementor-button-text">Apply HERE</span>
            </span>
          </a>
        </div>
      </div>

      <div class="role-card">
        <h3>Campus Recruitment Drive 2027</h3>
        <div class="elementor-widget-container">
          <p>InteligenAI is conducting its 4th Campus Recruitment Drive for students who want to work on cutting-edge AI systems from Day 1.</p>
          <p>The environment is fast-paced, hands-on, and designed for people who enjoy solving hard problems and growing through real responsibility.</p>
          <p><strong>Note:</strong> This application form is for the graduating batch of engineering colleges applying through their placement cells.</p>
        </div>
        <div class="elementor-button-wrapper">
          <a href="https://forms.gle/urWAQBkX49cXbiYu9" target="_blank" rel="noopener">
            <span class="elementor-button-content-wrapper">
              <span class="elementor-button-text">Apply HERE</span>
            </span>
          </a>
        </div>
      </div>

      <div class="role-card">
        <h3>Senior Backend Engineer</h3>
        <div class="elementor-widget-container">
          <h5><strong>Gurugram | 4+ years of experience | Full-Time</strong></h5>
          <p>Closed role.</p>
        </div>
        <div class="elementor-button-wrapper">
          <span class="elementor-button-text">closed</span>
        </div>
      </div>

      <div class="role-card">
        <h3>Junior Full-Stack Developer</h3>
        <div class="elementor-widget-container">
          <h5><strong>Gurugram | 2+ years of experience | Full-Time</strong></h5>
          <p>Closed role.</p>
        </div>
        <div class="elementor-button-wrapper">
          <span class="elementor-button-text">Closed</span>
        </div>
      </div>

      <h2>Partner with us</h2>
      <p><strong>Contact us at:</strong> <a href="mailto:hr@inteligenai.com">hr@inteligenai.com</a></p>
      <footer>
        <p>Copyright © 2026 Fantaclaus Technologies Pvt. Ltd. | Powered by inteligenai</p>
      </footer>
    </body>
  </html>
`

const missingRouteHtml = `
  <html>
    <head>
      <title>Page not found - inteligenai</title>
      <meta name="robots" content="follow, noindex" />
    </head>
    <body>
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist.</p>
    </body>
  </html>
`

test('fantaclaustechnologies scraper recognizes the verified redirect, homepage, sitemap, careers alias, and missing-route surface', () => {
  assert.equal(SOURCE, 'fantaclaustechnologies')
  assert.equal(COMPANY, 'Fantaclaus Technologies')
  assert.equal(LEGAL_HOME_URL, 'https://fantaclaus.com/')
  assert.equal(HOMEPAGE_URL, 'https://inteligenai.com/')
  assert.equal(SITEMAP_URL, 'https://inteligenai.com/page-sitemap.xml')
  assert.deepEqual(CAREERS_ALIAS_URLS, [
    'https://inteligenai.com/career',
    'https://inteligenai.com/careers',
  ])
  assert.equal(CAREERS_URL, 'https://inteligenai.com/careers/')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://inteligenai.com/jobs',
    'https://inteligenai.com/join-us',
    'https://inteligenai.com/current-openings',
    'https://inteligenai.com/openings',
  ])

  assert.equal(hasLegalRedirectSignal(legalRedirectHtml), true)
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(hasOfficialSitemapSignal(pageSitemapXml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  for (const careersAliasUrl of CAREERS_ALIAS_URLS) {
    assert.equal(hasVerifiedCareersAlias({ status: 200, url: CAREERS_URL, html: careersHtml }), true, careersAliasUrl)
  }
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      url: MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('FantaClaus bare-city legacy sample cannot establish publisher-owned vacancy/country or turn a campus programme into an India job', () => {
  assert.throws(() => extractPublicJobs(careersHtml), /Fantaclaus|native|publisher|document/i)
})

test('FantaClaus current acquisition requires original HTTP and does not invoke metadata-free callbacks', async () => {
  let reads = 0
  await assert.rejects(createFantaclausTechnologiesScraper().run({fetchPage:async()=>{
    reads++; return {status:200,url:CAREERS_URL,html:careersHtml}
  }}), /original HTTP metadata/i)
  assert.equal(reads, 0)
})
