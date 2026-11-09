import assert from 'node:assert/strict'
import test from 'node:test'

const rootShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="build-version" content="2026-07-21-11:48:12">
    <title>EMBIBE - The most powerful AI-powered learning platform</title>
    <meta
      name="description"
      content="Achieve your best every time with EMBIBE. For CBSE, ICSE, IB, State Boards, JEE, NEET, BITSAT, AIIMS, Banking, Insurance, Railways, SSC, Defence, UPSC & more."
    >
  </head>
  <body>
    <div id="app"></div>
    <script src="/static/js/main.a08cb8de.chunk.js"></script>
  </body>
</html>
`

const marketingHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Home - EMBIBE - The most powerful AI-powered learning platform</title>
    <link rel="canonical" href="https://www.embibe.com/in-en/home/">
  </head>
  <body>
    <h1>Embibe Is A Global Innovator</h1>
    <p>AI Powered Learning Solution Provider</p>
    <a href="https://www.embibe.com/in-en/joinus/">Join Us</a>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us - EMBIBE - The most powerful AI-powered learning platform</title>
    <link rel="canonical" href="https://www.embibe.com/in-en/contactus/">
  </head>
  <body>
    <h1>We might be reaching for the stars, but we'll always be right here for you.</h1>
    <a href="mailto:support@embibe.com">support@embibe.com</a>
    <a href="tel:18002572961">18002572961 (Toll Free)</a>
    <p>Diamond District, EMBIBE (Indiavidual Learning Limited)</p>
    <a href="https://www.embibe.com/in-en/joinus/">Join Us</a>
  </body>
</html>
`

const joinUsPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta name="robots" content="noindex, nofollow">
    <title>Join Us - EMBIBE - The most powerful AI-powered learning platform</title>
    <meta property="og:url" content="https://www.embibe.com/in-en/joinus/">
    <meta
      property="og:description"
      content="EMBIBE is the world’s first edtech company that truly delivers learning and life outcomes."
    >
  </head>
  <body>
    <h1>Join Us</h1>
    <p>If your heart beats for education and you want to be part of a revolution, you probably have a place here.</p>
    <a href="https://embibe.darwinbox.in/ms/candidate/careers">Explore openings</a>
    <a href="https://www.embibe.com/in-en/joinus/discovery-brief/">Discovery Brief</a>
  </body>
</html>
`

const joinUsApiPayload = {
  slug: 'joinus',
  link: 'https://www.embibe.com/in-en/joinus/',
  template: 'template-joinus.php',
  content: {
    rendered: `
      <p>EMBIBE is the world’s first edtech company that truly delivers learning and life outcomes.</p>
      <p>If your heart beats for education and you want to be part of a revolution, you probably have a place here.</p>
    `,
  },
  yoast_head: `
    <title>Join Us - EMBIBE - The most powerful AI-powered learning platform</title>
    <meta name="robots" content="noindex, nofollow" />
  `,
}

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.embibe.com/in-en/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.embibe.com/in-en/help-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.embibe.com/in-en/</loc></url>
  <url><loc>https://www.embibe.com/in-en/home/</loc></url>
  <url><loc>https://www.embibe.com/in-en/contactus/</loc></url>
  <url><loc>https://www.embibe.com/in-en/vulnerability-disclosure-program/</loc></url>
</urlset>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Embibe Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"ML Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://embibe.darwinbox.in/ms/candidatev2/main/careers/allJobs">Apply now</a>
  </body>
</html>
`

const darwinboxJobs = [
  {
    title: 'ML Engineer',
    company: 'Embibe',
    department: 'Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    jobId: 'a123',
    requisitionId: null,
    sourceUrl: 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a123',
    applyUrl: 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a123',
    employmentType: 'Full-time',
    experienceRequired: '3+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-01',
    closingDate: null,
    jobDescription: 'Build learning experiences.',
    source: 'embibe',
    link: 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a123',
    scrapedAt: '2026-08-02T00:00:00.000Z',
  },
]

const loadEmbibeModule = async () => {
  try {
    return await import('../../scraper/embibe/script.js')
  } catch {
    assert.fail('Expected Embibe scraper module at ../../scraper/embibe/script.js')
  }
}

test('Embibe scraper helpers stay pinned to the verified first-party join-us surface and Darwinbox handoff', async () => {
  const embibe = await loadEmbibeModule()

  assert.equal(embibe.SOURCE, 'embibe')
  assert.equal(embibe.COMPANY, 'Embibe')
  assert.equal(embibe.OFFICIAL_BRAND_NAME, 'Indiavidual Learning Limited (Embibe)')
  assert.equal(embibe.VERIFIED_ON, '2026-08-02')
  assert.equal(embibe.ROOT_URL, 'https://www.embibe.com/')
  assert.equal(embibe.ROOT_CAREERS_URL, 'https://www.embibe.com/careers')
  assert.equal(embibe.HOMEPAGE_URL, 'https://www.embibe.com/in-en/home/')
  assert.equal(embibe.CONTACT_PAGE_URL, 'https://www.embibe.com/in-en/contactus/')
  assert.equal(embibe.JOIN_US_PAGE_URL, 'https://www.embibe.com/in-en/joinus/')
  assert.equal(embibe.JOIN_US_API_URL, 'https://www.embibe.com/in-en/wp-json/wp/v2/pages/483')
  assert.equal(embibe.SITEMAP_INDEX_URL, 'https://www.embibe.com/in-en/sitemap_index.xml')
  assert.equal(embibe.PAGE_SITEMAP_URL, 'https://www.embibe.com/in-en/page-sitemap.xml')
  assert.equal(embibe.DARWINBOX_HANDOFF_URL, 'https://embibe.darwinbox.in/ms/candidate/careers')
  assert.equal(embibe.DARWINBOX_ORIGIN, 'https://embibe.darwinbox.in')
  assert.equal(embibe.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(embibe.PUBLIC_ALL_JOBS_URL, 'https://embibe.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(embibe.hasRootSiteShellSignal(rootShellHtml), true)
  assert.equal(embibe.hasOfficialMarketingHomepageSignal(marketingHomepageHtml), true)
  assert.equal(embibe.hasOfficialContactPageSignal(contactPageHtml), true)
  assert.deepEqual(embibe.extractDarwinboxHandoffUrls(joinUsPageHtml), [
    'https://embibe.darwinbox.in/ms/candidate/careers',
  ])
  assert.equal(embibe.hasJoinUsPageSignal(joinUsPageHtml), true)
  assert.equal(embibe.hasJoinUsApiSignal(joinUsApiPayload), true)
  assert.equal(embibe.hasExpectedSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(embibe.hasExpectedPageSitemapSignal(pageSitemapXml), true)
  assert.deepEqual(embibe.extractCareerLikeUrlsFromPageSitemap(pageSitemapXml), [])
  assert.equal(embibe.hasPublicJobsSignal(joinUsPageHtml), false)
  assert.equal(embibe.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Embibe verifies first-party pages and delegates job extraction to the shared Darwinbox scraper', async () => {
  const embibe = await loadEmbibeModule()
  const requestedPages = []
  const requestedJson = []
  const darwinboxCalls = []

  const jobs = await embibe.createEmbibeScraper({
    maxJobs: 5,
    now: () => '2026-08-02T12:00:00.000Z',
    darwinboxScraper: {
      run: async (options) => {
        darwinboxCalls.push(options)
        return darwinboxJobs
      },
    },
  }).run({
    maxPages: 3,
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === embibe.ROOT_URL) {
        return { status: 200, url, html: rootShellHtml }
      }

      if (url === embibe.ROOT_CAREERS_URL) {
        return { status: 404, url, html: rootShellHtml }
      }

      if (url === embibe.HOMEPAGE_URL) {
        return { status: 200, url, html: marketingHomepageHtml }
      }

      if (url === embibe.CONTACT_PAGE_URL) {
        return { status: 200, url, html: contactPageHtml }
      }

      if (url === embibe.JOIN_US_PAGE_URL) {
        return { status: 200, url, html: joinUsPageHtml }
      }

      if (url === embibe.SITEMAP_INDEX_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === embibe.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      throw new Error(`Unexpected Embibe page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === embibe.JOIN_US_API_URL) {
        return joinUsApiPayload
      }

      throw new Error(`Unexpected Embibe JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    embibe.ROOT_URL,
    embibe.ROOT_CAREERS_URL,
    embibe.HOMEPAGE_URL,
    embibe.CONTACT_PAGE_URL,
    embibe.JOIN_US_PAGE_URL,
    embibe.SITEMAP_INDEX_URL,
    embibe.PAGE_SITEMAP_URL,
  ])
  assert.deepEqual(requestedJson, [embibe.JOIN_US_API_URL])
  assert.equal(darwinboxCalls.length, 1)
  assert.equal(darwinboxCalls[0].maxPages, 3)
  assert.equal(darwinboxCalls[0].maxJobs, 5)
  assert.equal(darwinboxCalls[0].fetchListingPage, undefined)
  assert.deepEqual(jobs, [{
    ...darwinboxJobs[0],
    scrapedAt: '2026-08-02T12:00:00.000Z',
  }])
})

test('Embibe fails closed when the verified root shell, join-us page, page sitemap, or Darwinbox fetch materially changes', async () => {
  const embibe = await loadEmbibeModule()

  await assert.rejects(
    embibe.createEmbibeScraper().run({
      fetchPage: async (url) => {
        if (url === embibe.ROOT_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Embibe page URL: ${url}`)
      },
    }),
    /verified root homepage shell/i,
  )

  await assert.rejects(
    embibe.createEmbibeScraper().run({
      darwinboxScraper: { run: async () => [] },
      fetchPage: async (url) => {
        if (url === embibe.ROOT_URL) {
          return { status: 200, url, html: rootShellHtml }
        }

        if (url === embibe.ROOT_CAREERS_URL) {
          return { status: 404, url, html: rootShellHtml }
        }

        if (url === embibe.HOMEPAGE_URL) {
          return { status: 200, url, html: marketingHomepageHtml }
        }

        if (url === embibe.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        if (url === embibe.JOIN_US_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Embibe page URL: ${url}`)
      },
      fetchJson: async () => joinUsApiPayload,
    }),
    /join us page no longer matches/i,
  )

  await assert.rejects(
    embibe.createEmbibeScraper({
      darwinboxScraper: { run: async () => [] },
    }).run({
      fetchPage: async (url) => {
        if (url === embibe.ROOT_URL) {
          return { status: 200, url, html: rootShellHtml }
        }

        if (url === embibe.ROOT_CAREERS_URL) {
          return { status: 404, url, html: rootShellHtml }
        }

        if (url === embibe.HOMEPAGE_URL) {
          return { status: 200, url, html: marketingHomepageHtml }
        }

        if (url === embibe.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        if (url === embibe.JOIN_US_PAGE_URL) {
          return { status: 200, url, html: joinUsPageHtml }
        }

        if (url === embibe.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === embibe.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${pageSitemapXml}<url><loc>https://www.embibe.com/in-en/careers/</loc></url>`,
          }
        }

        throw new Error(`Unexpected Embibe page URL: ${url}`)
      },
      fetchJson: async () => joinUsApiPayload,
    }),
    /page sitemap career surface changed/i,
  )

  await assert.rejects(
    embibe.createEmbibeScraper({
      darwinboxScraper: {
        run: async () => {
          throw new Error('Darwinbox listing fetch failed')
        },
      },
    }).run({
      fetchPage: async (url) => {
        if (url === embibe.ROOT_URL) {
          return { status: 200, url, html: rootShellHtml }
        }

        if (url === embibe.ROOT_CAREERS_URL) {
          return { status: 404, url, html: rootShellHtml }
        }

        if (url === embibe.HOMEPAGE_URL) {
          return { status: 200, url, html: marketingHomepageHtml }
        }

        if (url === embibe.CONTACT_PAGE_URL) {
          return { status: 200, url, html: contactPageHtml }
        }

        if (url === embibe.JOIN_US_PAGE_URL) {
          return { status: 200, url, html: joinUsPageHtml }
        }

        if (url === embibe.SITEMAP_INDEX_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === embibe.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        throw new Error(`Unexpected Embibe page URL: ${url}`)
      },
      fetchJson: async () => joinUsApiPayload,
    }),
    /Darwinbox listing fetch failed/i,
  )
})
