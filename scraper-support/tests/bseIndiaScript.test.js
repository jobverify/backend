import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>LIVE Stock/Share Market | Indian Stock/Share Market LIVE | BSE SENSEX | BSE (formerly Bombay Stock Exchange)</title>
    <base href="/">
    <script type="module" crossorigin src="/assets/includenew/js/main-LB545UKC.js"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.bseindia.com/static/about/careers</loc></url>
  <url><loc>https://www.bseindia.com/markets/jobprocessstatus</loc></url>
  <url><loc>https://www.bseindia.com/contact</loc></url>
</urlset>
`

const BUNDLE_JS = `
const meta = { careers: { title: "Careers at BSE" } };
const route = "/static/about/careers";
const template = [
  "Careers at BSE",
  "Technology",
  "No Openings",
  "Regulatory",
  "Online Surveillance",
  "Investigation",
  "Listing Compliance (LC 01)",
  "Business",
  "No Openings",
  "Others ( Finance, HR, Corp Communications, Secretarial etc. )",
  "Finance: Financial Planning & Analysis (FP&A 01)",
  "mailto:careers@bseindia.com"
];
const images = [
  ["src","assets/includenew/images/Hiring_OnlineSurveillance.jpg","alt","Hiring Post - Online Surveillance"],
  ["src","assets/includenew/images/Hiring_Post_InvestigationGeneralized.jpg","alt","Hiring Post - Investigation"],
  ["src","assets/includenew/images/Hiring_Post_ListingCompliance.jpg","alt","Hiring Post - Listing Compliance"],
  ["src","assets/includenew/images/Hiring_post.jpg","alt","Hiring Finance: Financial Planning & Analysis (FP&A 01)"]
];
`

const CURRENT_BUNDLE_JS = `
const route = "/static/about/careers";
const navigation = ["About BSE", "Contact us", "Careers", "Feedback"];
`

const CURRENT_SITEMAP_XML = SITEMAP_XML.replace(
  '<url><loc>https://www.bseindia.com/static/about/careers</loc></url>',
  '',
)
const CURRENT_MAIN_JS = `
const navigation = ["/static/about/careers", "Careers"];
const routes = [{path:"static",loadChildren:()=>import("./chunk-2OCJOVBW.js").then(o=>o.staticRoutesOnly)}];
`
const CURRENT_STATIC_JS = `
const routes = [{path:"about",loadChildren:()=>import("./chunk-46MCKQOG.js").then(r=>r.staticAboutRoutes)}];
`
const CURRENT_ABOUT_JS = `
const careers = {path:"careers",component:Pe};
const heading = "Careers at BSE";
const jobs = [
  ["src","assets/includenew/images/Hiring_OnlineSurveillance.jpg","alt",\`Hiring Post
                        - Online Surveillance\`],
  ["src","assets/includenew/images/Hiring_Post_InvestigationGeneralized.jpg","alt",\`Hiring
                        Post - Investigation\`],
  ["src","assets/includenew/images/Hiring_Post_ListingCompliance.jpg","alt","Hiring Post - Listing Compliance"],
  ["src","assets/includenew/images/Hiring_post.jpg","alt","Hiring Finance: Financial Planning & Analysis (FP&A 01)"],
];
const apply = ["href","https://bsegenie.darwinbox.in/ms/candidatev2/main/careers/home"];
`

const loadBseIndiaModule = async () => {
  try {
    return await import('../../scraper/bseindia/script.js')
  } catch {
    assert.fail('Expected BSE India scraper module at ../../scraper/bseindia/script.js')
  }
}

test('BSE India keeps the verified careers shell, sitemap, and bundle signals pinned', async () => {
  const bse = await loadBseIndiaModule()

  assert.equal(bse.CAREERS_URL, 'https://www.bseindia.com/static/about/careers')
  assert.equal(bse.SITEMAP_URL, 'https://www.bseindia.com/sitemap.xml')
  assert.equal(
    bse.extractBundleUrl(CAREERS_PAGE_HTML),
    'https://www.bseindia.com/assets/includenew/js/main-LB545UKC.js',
  )
  assert.equal(bse.hasOfficialCareersShell(CAREERS_PAGE_HTML), true)
  assert.equal(bse.hasVerifiedSitemapSignal(SITEMAP_XML), true)
  assert.equal(bse.sitemapExposesPublicJobsRoute(SITEMAP_XML), false)
  assert.equal(bse.hasOfficialBundleSignal(BUNDLE_JS), true)
  assert.equal(bse.hasOfficialBundleSignal(CURRENT_BUNDLE_JS), true)
  assert.deepEqual(
    bse.extractCurrentOpeningsFromBundle(BUNDLE_JS).map((job) => [job.title, job.department]),
    [
      ['Online Surveillance', 'Regulatory'],
      ['Investigation', 'Regulatory'],
      ['Listing Compliance', 'Regulatory'],
      ['Financial Planning & Analysis (FP&A 01)', 'Others'],
    ],
  )
})

test('BSE India parses public hiring posts from the verified first-party careers bundle', async () => {
  const bse = await loadBseIndiaModule()
  const requestedUrls = []

  const jobs = await bse.createBseIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === bse.CAREERS_URL) return CAREERS_PAGE_HTML
      if (url === bse.SITEMAP_URL) return SITEMAP_XML
      if (url === 'https://www.bseindia.com/assets/includenew/js/main-LB545UKC.js') return BUNDLE_JS

      throw new Error(`Unexpected BSE India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.bseindia.com/static/about/careers',
    'https://www.bseindia.com/sitemap.xml',
    'https://www.bseindia.com/assets/includenew/js/main-LB545UKC.js',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'BSE India')
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@bseindia.com')
})

test('BSE India follows the current lazy careers route and its official application portal', async () => {
  const bse = await loadBseIndiaModule()
  const requestedUrls = []
  const responses = new Map([
    [bse.CAREERS_URL, CAREERS_PAGE_HTML],
    [bse.SITEMAP_URL, CURRENT_SITEMAP_XML],
    ['https://www.bseindia.com/assets/includenew/js/main-LB545UKC.js', CURRENT_MAIN_JS],
    ['https://www.bseindia.com/assets/includenew/js/chunk-2OCJOVBW.js', CURRENT_STATIC_JS],
    ['https://www.bseindia.com/assets/includenew/js/chunk-46MCKQOG.js', CURRENT_ABOUT_JS],
  ])
  const jobs = await bse.createBseIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (!responses.has(url)) throw new Error(`Unexpected BSE India URL: ${url}`)
      return responses.get(url)
    },
  })

  assert.equal(bse.hasVerifiedSitemapSignal(CURRENT_SITEMAP_XML), true)
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Online Surveillance', 'Investigation', 'Listing Compliance',
    'Financial Planning & Analysis (FP&A 01)',
  ])
  assert.equal(jobs[0].applyUrl, 'https://bsegenie.darwinbox.in/ms/candidatev2/main/careers/home')
  assert.equal(requestedUrls.length, 5)
})

test('BSE India fails closed if the sitemap starts exposing a public openings route', async () => {
  const bse = await loadBseIndiaModule()

  await assert.rejects(
    bse.createBseIndiaScraper().run({
      fetchText: async (url) => {
        if (url === bse.CAREERS_URL) return CAREERS_PAGE_HTML
        if (url === bse.SITEMAP_URL) {
          return `${SITEMAP_XML}<url><loc>https://www.bseindia.com/careers/openings</loc></url>`
        }
        return BUNDLE_JS
      },
    }),
    /sitemap now exposes a public jobs route/i,
  )
})
