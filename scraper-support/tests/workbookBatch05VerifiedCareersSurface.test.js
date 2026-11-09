import assert from 'node:assert/strict'
import test from 'node:test'

import { createVerifiedCareersSurfaceScraper } from '../../scraper/snapmint/verifiedCareersSurface.js'

const html = `
  <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"JobPosting","title":"India Platform Engineer","identifier":{"value":"IN-42"},"url":"/apply/IN-42","datePosted":"2026-07-25","employmentType":"FULL_TIME","description":"Build dependable systems.","jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bengaluru","addressRegion":"Karnataka","addressCountry":"India"}}},
      {"@type":"JobPosting","title":"US Platform Engineer","url":"/apply/US-42","jobLocation":{"address":{"addressCountry":"United States"}}},
      {"@type":"JobPosting","title":"External role","url":"https://example.test/apply/42","jobLocation":{"address":{"addressCountry":"India"}}}
    ]}
  </script>
`

test('batch 05 verified-surface parser returns only same-origin India JobPosting records', async () => {
  const careersUrl = 'https://careers.example.test/openings'
  const scraper = createVerifiedCareersSurfaceScraper({
    company: 'Example India',
    careersUrl,
    source: 'exampleindia',
  })

  const jobs = await scraper.run({
    fetchHtml: async (url) => {
      assert.equal(url, careersUrl)
      return html
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'India Platform Engineer',
    company: 'Example India',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://careers.example.test/apply/IN-42',
    sourceUrl: 'https://careers.example.test/apply/IN-42',
    applyUrl: 'https://careers.example.test/apply/IN-42',
    source: 'exampleindia',
    jobId: 'IN-42',
    requisitionId: 'IN-42',
    department: null,
    employmentType: 'FULL_TIME',
    postingDate: '2026-07-25',
    closingDate: null,
    jobDescription: 'Build dependable systems.',
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.ok(!Number.isNaN(Date.parse(jobs[0].scrapedAt)))
})

test('batch 05 verified-surface parser stays empty when its narrow public contract is absent', async () => {
  const scraper = createVerifiedCareersSurfaceScraper({
    company: 'Example India',
    careersUrl: 'https://careers.example.test/openings',
    source: 'exampleindia',
  })

  assert.deepEqual(await scraper.run({ fetchHtml: async () => '<h1>Careers</h1>' }), [])
})
