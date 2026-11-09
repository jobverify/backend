import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/nike/script.js'

test('buildSearchUrl uses Nike public listing pages and bounded pagination', () => {
  assert.equal(buildSearchUrl(), 'https://careers.nike.com/jobs')
  assert.equal(buildSearchUrl({ page: 2 }), 'https://careers.nike.com/jobs/page/2')
  assert.equal(buildSearchUrl({ page: 0 }), 'https://careers.nike.com/jobs')
})

test('extractPaginationSummary reads Nike next pages from public listings', () => {
  const html = '<a href="/jobs/page/3" aria-label="Go to next page">Go to next page</a>'

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    nextPage: 3,
  })
})

test('extractSearchResults keeps only NIKE India jobs from public listings', () => {
  const html = `
    <li class="search-result-item" data-brand="NIKE">
      <a href="/senior-software-engineer/job/R-81234"><h3>Senior Software Engineer</h3></a>
      <span>R-81234</span>
      <span>Job Location Bengaluru, Karnataka, India</span>
      <span>Software Engineering</span>
      <span>NIKE</span>
    </li>
    <li class="search-result-item" data-brand="CONVERSE">
      <a href="/converse-engineer/job/R-81235"><h3>Converse Engineer</h3></a>
      <span>R-81235</span>
      <span>Job Location Bengaluru, Karnataka, India</span>
      <span>Software Engineering</span>
      <span>CONVERSE</span>
    </li>
    <li class="search-result-item" data-brand="NIKE">
      <a href="/oregon-engineer/job/R-81236"><h3>Oregon Engineer</h3></a>
      <span>R-81236</span>
      <span>Job Location Beaverton, Oregon, United States</span>
      <span>Software Engineering</span>
      <span>NIKE</span>
    </li>
    <li class="search-result-item" data-brand="NIKE">
      <a href="https://example.com/not-nike/job/R-81237"><h3>Unsafe Link</h3></a>
      <span>R-81237</span>
      <span>Job Location Bengaluru, Karnataka, India</span>
      <span>NIKE</span>
    </li>
  `

  assert.deepEqual(extractSearchResults(html), [{
    title: 'Senior Software Engineer',
    department: 'Software Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'R-81234',
    requisitionId: 'R-81234',
    sourceUrl: 'https://careers.nike.com/senior-software-engineer/job/R-81234',
  }])
})

test('extractSearchResults reads NIKE India jobs from Nike public preload state', () => {
  const html = `<script>
    window.__PRELOAD_STATE__ = {"jobSearch":{"jobs":[
      {"requisitionID":"R-81234","title":"Senior Software Engineer","brandName":"NIKE","originalURL":"senior-software-engineer/job/R-81234","locations":[{"city":"Bengaluru","state":"Karnataka","country":"India","locationText":"Bengaluru, Karnataka, India"}],"jobCardExtraFields":[{"attribute_name":"job_categories","value":["Software Engineering"]}]},
      {"requisitionID":"R-81235","title":"Converse Engineer","brandName":"CONVERSE","originalURL":"converse-engineer/job/R-81235","locations":[{"city":"Bengaluru","state":"Karnataka","country":"India","locationText":"Bengaluru, Karnataka, India"}]},
      {"requisitionID":"R-81236","title":"Oregon Engineer","brandName":"NIKE","originalURL":"oregon-engineer/job/R-81236","locations":[{"city":"Beaverton","state":"Oregon","country":"United States","locationText":"Beaverton, Oregon, United States"}]}
    ]}};
  </script>`

  assert.deepEqual(extractSearchResults(html), [{
    title: 'Senior Software Engineer',
    department: 'Software Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'R-81234',
    requisitionId: 'R-81234',
    sourceUrl: 'https://careers.nike.com/senior-software-engineer/job/R-81234',
  }])
})

test('extractJobDetail reads public metadata, JSON-LD, and same-domain apply links', () => {
  const html = `
    <meta property="og:title" content="Senior Software Engineer | Nike Careers" />
    <meta name="description" content="Build reliable services for athletes." />
    <a class="apply-button" href="/senior-software-engineer/job/R-81234/apply">Apply Now</a>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Software Engineer","description":"<p>Build reliable services for athletes.</p>","identifier":{"value":"R-81234"},"datePosted":"2026-07-01","employmentType":"FULL_TIME","hiringOrganization":{"name":"NIKE"},"jobLocation":{"address":{"addressLocality":"Bengaluru","addressRegion":"Karnataka","addressCountry":"IN"}},"occupationalCategory":"Software Engineering"}
    </script>
    <a href="https://example.com/apply">Apply externally</a>
  `
  const listing = {
    title: 'Fallback title',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'R-81234',
    requisitionId: 'R-81234',
    sourceUrl: 'https://careers.nike.com/senior-software-engineer/job/R-81234',
  }

  const detail = extractJobDetail(html, listing)

  assert.equal(detail.title, 'Senior Software Engineer')
  assert.equal(detail.department, 'Software Engineering')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.jobId, 'R-81234')
  assert.equal(detail.requisitionId, 'R-81234')
  assert.equal(detail.employmentType, 'FULL_TIME')
  assert.equal(detail.postingDate, '2026-07-01')
  assert.equal(detail.applyUrl, 'https://careers.nike.com/senior-software-engineer/job/R-81234/apply')
  assert.equal(detail.sourceUrl, listing.sourceUrl)
  assert.match(detail.jobDescription, /Build reliable services for athletes/i)
})
