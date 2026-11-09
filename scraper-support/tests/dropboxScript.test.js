import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedJobsLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>It starts with your ideas, then scales to the world | Dropbox Careers</title>
  </head>
  <body>
    <main>
      <h1>It starts with your ideas, then scales to the world</h1>
      <p>Search jobs</p>
      <p>Displaying 1 to 20 of 39 matching jobs</p>
    </main>
  </body>
</html>
`

const verifiedRobotsTxt = `
# Production

User-agent: *
Allow: /
Disallow: /cdn-cgi/

sitemap:https://www.dropbox.jobs/sitemap.xml
`

const verifiedSitemapXml = `
<?xml version="1.0" encoding="utf-8" standalone="no"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.dropbox.jobs/en/</loc>
    <lastmod>2026-06-09T20:36:58.4559286Z</lastmod>
  </url>
  <url>
    <loc>https://www.dropbox.jobs/en/jobs/</loc>
    <lastmod>2025-12-01T15:39:14.35Z</lastmod>
  </url>
  <url>
    <loc>https://www.dropbox.jobs/en/jobs/8038750/head-of-field-and-partner-marketing/</loc>
    <lastmod>2026-07-07T20:06:45Z</lastmod>
  </url>
  <url>
    <loc>https://www.dropbox.jobs/pl/jobs/8038750/head-of-field-and-partner-marketing/</loc>
    <lastmod>2026-07-07T20:06:45Z</lastmod>
  </url>
  <url>
    <loc>https://www.dropbox.jobs/en/jobs/8053628/data-engineer/</loc>
    <lastmod>2026-07-14T13:34:25Z</lastmod>
  </url>
</urlset>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dropbox/script.js')
  } catch {
    assert.fail('Expected Dropbox scraper module at ../../scraper/dropbox/script.js')
  }
}

test('Dropbox pins the verified jobs listing, robots contract, and sitemap surface', async () => {
  const dropbox = await loadModule()

  assert.equal(dropbox.SOURCE, 'dropbox')
  assert.equal(dropbox.COMPANY, 'Dropbox')
  assert.equal(dropbox.CAREERS_ENTRY_URL, 'https://www.dropbox.com/jobs')
  assert.equal(dropbox.CAREERS_HOME_URL, 'https://www.dropbox.jobs/en/')
  assert.equal(dropbox.JOBS_URL, 'https://www.dropbox.jobs/en/jobs/')
  assert.equal(dropbox.ROBOTS_URL, 'https://www.dropbox.jobs/robots.txt')
  assert.equal(dropbox.SITEMAP_URL, 'https://www.dropbox.jobs/sitemap.xml')
  assert.equal(dropbox.VERIFIED_LISTING_JOB_COUNT, 39)
  assert.equal(dropbox.hasOfficialJobsLandingSignal(verifiedJobsLandingHtml), true)
  assert.equal(dropbox.hasVerifiedRobotsSitemapSignal(verifiedRobotsTxt), true)
  assert.equal(
    dropbox.extractSitemapUrlFromRobots(verifiedRobotsTxt),
    'https://www.dropbox.jobs/sitemap.xml',
  )
  assert.equal(dropbox.sitemapIncludesVerifiedJobsSurface(verifiedSitemapXml), true)
})

test('Dropbox sitemap parsing keeps only canonical English job detail URLs and normalizes title metadata', async () => {
  const dropbox = await loadModule()

  assert.deepEqual(dropbox.extractEnglishJobEntriesFromSitemap(verifiedSitemapXml), [
    {
      jobId: '8053628',
      requisitionId: '8053628',
      title: 'Data Engineer',
      sourceUrl: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
      applyUrl: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
      postingDate: '2026-07-14T13:34:25Z',
    },
    {
      jobId: '8038750',
      requisitionId: '8038750',
      title: 'Head Of Field And Partner Marketing',
      sourceUrl: 'https://www.dropbox.jobs/en/jobs/8038750/head-of-field-and-partner-marketing/',
      applyUrl: 'https://www.dropbox.jobs/en/jobs/8038750/head-of-field-and-partner-marketing/',
      postingDate: '2026-07-07T20:06:45Z',
    },
  ])
})

test('Dropbox run validates the first-party robots and sitemap surfaces and decorates sitemap-derived jobs', async () => {
  const dropbox = await loadModule()
  const requestedUrls = []

  const jobs = await dropbox.createDropboxScraper({
    maxJobs: 1,
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === dropbox.ROBOTS_URL) return verifiedRobotsTxt
      if (url === dropbox.SITEMAP_URL) return verifiedSitemapXml

      throw new Error(`Unexpected Dropbox fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    dropbox.ROBOTS_URL,
    dropbox.SITEMAP_URL,
  ])
  assert.deepEqual(jobs, [
    {
      jobId: '8053628',
      title: 'Data Engineer',
      company: 'Dropbox',
      department: null,
      location: null,
      city: null,
      country: 'Global',
      sourceUrl: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
      applyUrl: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14T13:34:25Z',
      closingDate: null,
      jobDescription: 'Official Dropbox opening published on the verified first-party careers sitemap.',
      remoteStatus: null,
      requisitionId: '8053628',
      source: 'dropbox',
      link: 'https://www.dropbox.jobs/en/jobs/8053628/data-engineer/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
      companyCareerPage: 'https://www.dropbox.com/jobs',
      companyDomain: 'dropbox.jobs',
      atsPlatform: 'official-company-careers-sitemap',
    },
  ])
})

test('Dropbox fails closed when the verified robots or sitemap contract drifts', async () => {
  const dropbox = await loadModule()

  await assert.rejects(
    dropbox.createDropboxScraper().run({
      fetchText: async (url) => {
        if (url === dropbox.ROBOTS_URL) {
          return 'User-agent: *\nAllow: /\n'
        }

        return verifiedSitemapXml
      },
    }),
    /verified robots\.txt/i,
  )

  await assert.rejects(
    dropbox.createDropboxScraper().run({
      fetchText: async (url) => {
        if (url === dropbox.ROBOTS_URL) return verifiedRobotsTxt
        if (url === dropbox.SITEMAP_URL) {
          return `
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://www.dropbox.jobs/en/</loc></url>
            </urlset>
          `
        }

        throw new Error(`Unexpected Dropbox fixture URL: ${url}`)
      },
    }),
    /verified careers sitemap/i,
  )
})
