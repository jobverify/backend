import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  COMPANY,
  CORPORATE_JOBS_URL,
  FIELD_JOBS_HANDOFF_URL,
  FIELD_JOBS_RSS_URL,
  FIELD_JOBS_URL,
  HOMEPAGE_URL,
  LEGACY_QUOTIENT_URL,
  SOURCE,
  VERIFIED_ON,
  aboutPageLinksToOfficialJobSurfaces,
  createNeptuneRetailSolutionsScraper,
  extractFieldFeedItems,
  hasOfficialAboutUsSignal,
  hasOfficialNeptuneHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Neptune Retail Solutions</title>
    </head>
    <body>
      <h1>Neptune Retail Solutions</h1>
      <p>The only marketing solution connecting consumers through every step of their shopping journey, integrating the largest in-store media, digital incentives and near store DOOH networks proven to increase retail sales.</p>
      <p>Harness the unparalleled power of Neptune.</p>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <body>
      <h1>The leader in retail marketing</h1>
      <p>Acquire Quotient creating the market leading in-store media network linked to market leading digital incentives network.</p>
      <h2>Join Neptune</h2>
      <p>Explore opportunities at Neptune.</p>
      <a href="${FIELD_JOBS_HANDOFF_URL}">Browse Field Positions</a>
      <a href="${CORPORATE_JOBS_URL}">Browse Corporate Positions</a>
    </body>
  </html>
`

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Neptune Retail Solutions Jobs</title>
    <link>${FIELD_JOBS_URL}</link>
    <item>
      <title><![CDATA[Field Sales Representative]]></title>
      <link>https://neptuneretailsolutions.pinpointhq.com/en/postings/field-sales-representative</link>
      <pubDate>Tue, 08 Jul 2026 12:30:00 +0000</pubDate>
      <description><![CDATA[Support in-store media activations across multiple retail accounts.]]></description>
    </item>
    <item>
      <title>Retail Merchandiser</title>
      <link>https://neptuneretailsolutions.pinpointhq.com/en/postings/retail-merchandiser</link>
      <pubDate>Wed, 09 Jul 2026 09:15:00 +0000</pubDate>
      <description><![CDATA[Execute promotional campaigns at partner stores.]]></description>
    </item>
    <item>
      <title>Ignore Non-Pinpoint Link</title>
      <link>https://example.com/jobs/ignore-me</link>
      <pubDate>Thu, 10 Jul 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[This should be ignored.]]></description>
    </item>
  </channel>
</rss>`

test('Neptune Retail Solutions stays pinned to the verified Quotient redirect, About Us careers shell, and Pinpoint field-jobs feed', () => {
  assert.equal(SOURCE, 'neptuneretailsolutions')
  assert.equal(COMPANY, 'Neptune Retail Solutions')
  assert.equal(VERIFIED_ON, '2026-08-03')
  assert.equal(LEGACY_QUOTIENT_URL, 'https://www.quotient.com/')
  assert.equal(HOMEPAGE_URL, 'https://neptuneretailsolutions.com/')
  assert.equal(ABOUT_URL, 'https://neptuneretailsolutions.com/about-us/')
  assert.equal(FIELD_JOBS_HANDOFF_URL, 'https://neptuneretailsolutions.pinpointhq.com/')
  assert.equal(FIELD_JOBS_URL, 'https://neptuneretailsolutions.pinpointhq.com/jobs')
  assert.equal(FIELD_JOBS_RSS_URL, 'https://neptuneretailsolutions.pinpointhq.com/jobs.rss')
  assert.equal(CORPORATE_JOBS_URL, 'https://neptuneretailsolutions.bamboohr.com/careers')
  assert.equal(hasOfficialNeptuneHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutUsSignal(aboutHtml), true)
  assert.equal(aboutPageLinksToOfficialJobSurfaces(aboutHtml), true)
})

test('extractFieldFeedItems parses the verified Pinpoint RSS feed and keeps only Neptune field-job entries', () => {
  const jobs = extractFieldFeedItems(feedXml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    jobId: 'field-sales-representative',
    requisitionId: 'field-sales-representative',
    title: 'Field Sales Representative',
    company: 'Neptune Retail Solutions',
    department: null,
    location: null,
    city: null,
    country: null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08T12:30:00.000Z',
    closingDate: null,
    jobDescription: 'Support in-store media activations across multiple retail accounts.',
    sourceUrl: 'https://neptuneretailsolutions.pinpointhq.com/en/postings/field-sales-representative',
    applyUrl: 'https://neptuneretailsolutions.pinpointhq.com/en/postings/field-sales-representative',
  })
  assert.equal(jobs[1].jobId, 'retail-merchandiser')
  assert.equal(jobs[1].title, 'Retail Merchandiser')
})

test('run validates the official Quotient-to-Neptune redirect and emits jobs from the public Pinpoint RSS feed', async () => {
  const requestedUrls = []
  const scraper = createNeptuneRetailSolutionsScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === LEGACY_QUOTIENT_URL) {
        return { status: 200, url: HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === FIELD_JOBS_RSS_URL) return feedXml
      throw new Error(`Unexpected feed URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LEGACY_QUOTIENT_URL,
    ABOUT_URL,
    FIELD_JOBS_RSS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'neptuneretailsolutions')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run fails closed when the Quotient redirect no longer resolves to Neptune', async () => {
  const scraper = createNeptuneRetailSolutionsScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === LEGACY_QUOTIENT_URL) {
          return { status: 200, url: LEGACY_QUOTIENT_URL, html: '<html><body><h1>Quotient</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchText: async () => feedXml,
    }),
    /Quotient legacy homepage/i,
  )
})
