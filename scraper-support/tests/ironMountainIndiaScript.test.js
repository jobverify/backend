import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const ABOUT_PAGE_URL = 'https://www.ironmountain.com/about-us'
const CAREERS_URL = 'https://ironmountain.jobs/'
const JOBS_SITEMAP_URL = 'https://ironmountain.jobs/sitemaps/jobs_1.xml'

const aboutPageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Discover who we are | Iron Mountain United States</title>
      <meta name="careers-board-domain" content="ironmountain.jobs" />
    </head>
    <body>
      <main>
        <h1>About Iron Mountain</h1>
        <nav>
          <a href="https://www.ironmountain.com/en-in">India</a>
          <a href="/company/about/careers">Careers</a>
        </nav>
        <p>We protect what our customers value most.</p>
      </main>
    </body>
  </html>
`

const jobsBoardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Home | Iron Mountain</title>
    </head>
    <body>
      <main>
        <h1>Search jobs</h1>
      </main>
      <script>
        window.__NUXT__ = {};
        window.__NUXT__.config = {
          public: {
            "job-folder": "ironmountain-jobs",
            source: "solr",
            "x-origin": "ironmountain.jobs"
          }
        };
      </script>
    </body>
  </html>
`

const jobDetailShellHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Job | Iron Mountain</title>
    </head>
    <body>
      <script>
        window.__NUXT__ = {};
        window.__NUXT__.config = {
          public: {
            "job-folder": "ironmountain-jobs",
            source: "solr",
            "x-origin": "ironmountain.jobs"
          }
        };
      </script>
      <script type="application/json" data-nuxt-data="nuxt-app" data-ssr="false" id="__NUXT_DATA__">[{"prerenderedAt":1,"serverRendered":2},1782489944046,false]</script>
    </body>
  </html>
`

const currentJobDetailShellHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title></title>
    </head>
    <body>
      <script>
        window.__NUXT__ = {};
        window.__NUXT__.config = {
          public: {
            "job-folder": "ironmountain-jobs",
            source: "solr",
            "x-origin": "ironmountain.jobs"
          }
        };
      </script>
      <script type="application/json" data-nuxt-data="nuxt-app" data-ssr="false" id="__NUXT_DATA__">[{"prerenderedAt":1,"serverRendered":2},1782489944046,false]</script>
    </body>
  </html>
`

const vercelSecurityCheckpointHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Vercel Security Checkpoint</title>
    </head>
    <body>
      <main>
        <h1>Vercel Security Checkpoint</h1>
      </main>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/</loc>
      <lastmod>2026-07-12</lastmod>
    </url>
    <url>
      <loc>https://ironmountain.jobs/bangalore-ind/information-security-lead/20AC18A6C9E94DC496CD2CF69B073684/job/</loc>
      <lastmod>2026-07-12</lastmod>
    </url>
    <url>
      <loc>https://ironmountain.jobs/newark-nj/manager-labor-strategy-engagement-remote/00935A83E8214967BD9C20834DB0F820/job/</loc>
      <lastmod>2026-07-12</lastmod>
    </url>
  </urlset>
`

const loadIronMountainIndiaModule = async () => {
  try {
    return await import('../../scraper/ironmountainindia/script.js')
  } catch {
    assert.fail('Expected Iron Mountain India scraper module at ../../scraper/ironmountainindia/script.js')
  }
}

test('Iron Mountain India pins the verified first-party careers handoff and sitemap helpers', async () => {
  const ironMountainIndia = await loadIronMountainIndiaModule()

  assert.equal(ironMountainIndia.SOURCE, 'ironmountainindia')
  assert.equal(ironMountainIndia.COMPANY_NAME, 'Iron Mountain India')
  assert.equal(ironMountainIndia.OFFICIAL_BRAND_NAME, 'Iron Mountain')
  assert.equal(ironMountainIndia.HOMEPAGE_URL, 'https://www.ironmountain.com/en-in')
  assert.equal(ironMountainIndia.ABOUT_PAGE_URL, ABOUT_PAGE_URL)
  assert.equal(ironMountainIndia.CAREERS_URL, CAREERS_URL)
  assert.equal(ironMountainIndia.JOBS_SITEMAP_URL, JOBS_SITEMAP_URL)
  assert.equal(ironMountainIndia.VERIFIED_ON, '2026-08-03')
  assert.equal(ironMountainIndia.hasOfficialAboutPageCareersSignal(aboutPageHtml), true)
  assert.equal(ironMountainIndia.hasOfficialAboutPageCareersSignal('<html><title>About Another Company</title></html>'), false)
  assert.equal(ironMountainIndia.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(ironMountainIndia.hasOfficialJobsBoardSignal('<html><title>Jobs</title></html>'), false)
  assert.equal(ironMountainIndia.hasVercelSecurityCheckpointSignal(vercelSecurityCheckpointHtml), true)
  assert.deepEqual(ironMountainIndia.extractSitemapEntries(sitemapXml), [
    {
      url: 'https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/',
      lastmod: '2026-07-12',
    },
    {
      url: 'https://ironmountain.jobs/bangalore-ind/information-security-lead/20AC18A6C9E94DC496CD2CF69B073684/job/',
      lastmod: '2026-07-12',
    },
    {
      url: 'https://ironmountain.jobs/newark-nj/manager-labor-strategy-engagement-remote/00935A83E8214967BD9C20834DB0F820/job/',
      lastmod: '2026-07-12',
    },
  ])
  assert.equal(
    ironMountainIndia.isIndiaJobUrl('https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/'),
    true,
  )
  assert.equal(
    ironMountainIndia.isIndiaJobUrl('https://ironmountain.jobs/newark-nj/manager-labor-strategy-engagement-remote/00935A83E8214967BD9C20834DB0F820/job/'),
    false,
  )
  assert.equal(ironMountainIndia.humanizeTitleSlug('business-development-manager-psu'), 'Business Development Manager PSU')
  assert.equal(ironMountainIndia.formatIndiaLocationFromSlug('navi-mumbai-ind'), 'Navi Mumbai, India')
})

test('mapSitemapEntryToJob converts public India sitemap URLs into normalized jobs', async () => {
  const ironMountainIndia = await loadIronMountainIndiaModule()

  assert.deepEqual(
    ironMountainIndia.mapSitemapEntryToJob({
      url: 'https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/',
      lastmod: '2026-07-12',
    }),
    {
      title: 'Business Development Manager PSU',
      company: 'Iron Mountain India',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'CA3B2FE418DD4D93BA414E6E9A0A9EE8',
      requisitionId: 'CA3B2FE418DD4D93BA414E6E9A0A9EE8',
      sourceUrl: 'https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/',
      applyUrl: 'https://ironmountain.jobs/mumbai-ind/business-development-manager-psu/CA3B2FE418DD4D93BA414E6E9A0A9EE8/job/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-12',
      closingDate: null,
      jobDescription: null,
    },
  )
})

const nativeSamples = [
  '3E5B9F4951D04C2B88CB21B5658F3CC1',
  '60603B3B91B24C10B1A347BF7944B439',
].map(id => JSON.parse(readFileSync(new URL('./fixtures/ironmountainindia/native-' + id + '-20261024.json', import.meta.url))))
const nativeSitemap = '<urlset>' + nativeSamples.map(sample => '<url><loc>' + sample.entry.url + '</loc><lastmod>' + sample.entry.lastmod + '</lastmod></url>').join('') + '</urlset>'
const nativeReceipt = url => {
  if (url === ABOUT_PAGE_URL) return { status: 200, url, html: aboutPageHtml }
  if (url === CAREERS_URL) return { status: 200, url, html: jobsBoardHtml }
  if (url === JOBS_SITEMAP_URL) return { status: 200, url, html: nativeSitemap }
  for (const sample of nativeSamples) {
    if (url === sample.nativeDataUrl) return { status: 200, url, html: JSON.stringify(sample.nlx) }
    if (url === sample.nlx.link) return sample.applyReceipt
    if (url === sample.cxsUrl) return { status: sample.cxsStatus, url, html: JSON.stringify(sample.cxs) }
  }
  throw new Error('Unexpected Iron Mountain native fixture URL: ' + url)
}

test('Iron Mountain India run binds each native detail and decorates original employer content', async () => {
  const source = await loadIronMountainIndiaModule(), requested = []
  const jobs = await source.createIronMountainIndiaScraper({ now: () => '2026-10-24T18:32:19.000Z' }).run({
    requestIntervalMs: 0, fetchPage: async url => { requested.push(url); return nativeReceipt(url) },
  })
  assert.equal(jobs.length, 2)
  assert.deepEqual(requested, [ABOUT_PAGE_URL, CAREERS_URL, JOBS_SITEMAP_URL,
    ...nativeSamples.flatMap(sample => [sample.nativeDataUrl, sample.nlx.link, sample.cxsUrl])])
  assert.equal(jobs[0].jobDescription, nativeSamples[0].cxs.jobPostingInfo.jobDescription)
  assert.equal(jobs[0].source, 'ironmountainindia')
  assert.equal(jobs[0].scrapedAt, '2026-10-24T18:32:19.000Z')
  assert.equal(jobs[0].postingDate, '2026-09-30')
  assert.equal(jobs[0].link, nativeSamples[0].applyReceipt.url)
  assert.equal(jobs[0].sourceNativeEmployerEvidence.primaryLegalEmployer, '45101 Web Werks India Pvt Ltd')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Iron Mountain India fails closed when the about page or jobs board changes', async () => {
  const source = await loadIronMountainIndiaModule()
  for (const [target, pattern] of [[ABOUT_PAGE_URL, /about page/i], [CAREERS_URL, /jobs board/i]]) {
    await assert.rejects(source.run({ requestIntervalMs: 0, fetchPage: async url => url === target
      ? { status: 200, url, html: '<title>Another company</title>' } : nativeReceipt(url) }), pattern)
  }
})

test('Iron Mountain India rejects text-only browser fallback hooks before making requests', async () => {
  const source = await loadIronMountainIndiaModule()
  let attempts = 0
  await assert.rejects(source.run({
    fetchText: async () => { attempts++; throw new Error('HTTP429') },
    fetchBrowserText: async () => { attempts++; return jobDetailShellHtml },
  }), /response receipts/)
  assert.equal(attempts, 0)
})

test('Iron Mountain retains native employer evidence when the corporate page is checkpointed and keeps scope incomplete', async () => {
  const source = await loadIronMountainIndiaModule()
  const jobs = await source.run({ now: () => '2026-10-24T18:32:19.000Z', requestIntervalMs: 0,
    fetchPage: async url => url === ABOUT_PAGE_URL
      ? { status: 429, url, html: vercelSecurityCheckpointHtml } : nativeReceipt(url),
  })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceDescription, nativeSamples[0].cxs.jobPostingInfo.jobDescription)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /publisher-about-checkpointed=true/)
})

test('Iron Mountain propagates a receipt-aware native transport timeout without fabricating current jobs', async () => {
  const source = await loadIronMountainIndiaModule(), reason = Error('native connection timed out')
  await assert.rejects(source.run({ fetchPage: async () => { throw reason } }), error => error === reason)
})
