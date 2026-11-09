import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  INDIA_SEARCH_URL,
  createSanofiScraper,
  extractJobFromDetailPage,
  extractPageCount,
  extractSearchResults,
  hasOfficialIndiaCareersSignal,
} from './script.js'

const indiaLandingHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers in India | Sanofi Careers</title>
  </head>
  <body>
    <h1>Sanofi Careers: India Shape a bold tomorrow</h1>
    <a href="/en/job/mumbai/ebi-business-partner/2649/41764220480">EBI Business Partner Mumbai, India</a>
    <a href="/en/search-jobs/india/20873/1/1">View all Sanofi roles in India</a>
  </body>
</html>
`

const liveStyleIndiaLandingHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers in India | Sanofi Careers</title>
  </head>
  <body>
    <a href="/en/search-jobs">Search Jobs</a>
    <div class="section40-copy">
      <h2 class="section40-copy__headline">Grow your career with us in India</h2>
      <p>This is where careers soar, expertise sharpens, and global impact amplifies.</p>
    </div>
    <div class="job-list section40-joblist">
      <ul>
        <li><a href="/en/job/mumbai/ebi-business-partner/2649/41764220480">EBI Business Partner Mumbai, India</a></li>
      </ul>
    </div>
  </body>
</html>
`

const searchPageOneHtml = `
<!doctype html>
<html>
  <head>
    <title>Search our Job Opportunities at Sanofi</title>
  </head>
  <body>
    <div class="total-headline">
      <h1><em>2 india jobs</em></h1>
    </div>
    <div id="search-results-list">
      <ul>
        <li>
          <button type="button" class="js-save-job-btn" data-job-id="41764220480">Save for Later</button>
          <a href="/en/job/mumbai/ebi-business-partner/2649/41764220480" data-job-id="41764220480">
            <h2>EBI Business Partner</h2>
            <span class="job-location"><strong>Location: </strong>Mumbai, India</span>
            <span class="job-category"><strong>Category: </strong>Ethics &amp; Business Integrity</span>
          </a>
        </li>
      </ul>
    </div>
    <nav id="pagination-bottom" class="pagination">
      <label class="pagination-current-label" for="pagination-current-bottom"><b>Enter number to jump to a different page. You are currently on page 1 / 2.</b>Page</label>
      <a class="next" href="/search-jobs/india/20873/1/1&amp;p=2" rel="nofollow">Next</a>
    </nav>
  </body>
</html>
`

const searchPageTwoHtml = `
<!doctype html>
<html>
  <head>
    <title>Search our Job Opportunities at Sanofi</title>
  </head>
  <body>
    <div class="total-headline">
      <h1><em>2 india jobs</em></h1>
    </div>
    <div id="search-results-list">
      <ul>
        <li>
          <button type="button" class="js-save-job-btn" data-job-id="40282817856">Save for Later</button>
          <a href="/en/job/hyderabad/principal-statistical-programmer/2649/40282817856" data-job-id="40282817856">
            <h2>Principal Statistical Programmer</h2>
            <span class="job-location"><strong>Location: </strong>Hyderabad, India</span>
            <span class="job-category"><strong>Category: </strong>Digital Data &amp; Technology</span>
          </a>
        </li>
        <li>
          <button type="button" class="js-save-job-btn" data-job-id="41747792768">Save for Later</button>
          <a href="/en/job/hyderabad/hyperautomation-fullstack-developer/2649/41747792768" data-job-id="41747792768">
            <h2>Hyperautomation Fullstack Developer</h2>
            <span class="job-location"><strong>Location: </strong>Multiple locations</span>
            <span class="job-category"><strong>Category: </strong>Digital Data &amp; Technology</span>
          </a>
        </li>
      </ul>
    </div>
    <nav id="pagination-bottom" class="pagination">
      <label class="pagination-current-label" for="pagination-current-bottom"><b>Enter number to jump to a different page. You are currently on page 2 / 2.</b>Page</label>
    </nav>
  </body>
</html>
`

const ebiDetailHtml = `
<!doctype html>
<html class="custom_fields.LocationCountry-India custom_fields.JobPostingEndDate-2026-08-10">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-07-08",
        "description": "<p><b>Job title</b>:<i> <b>EBI Business Partner</b></i></p><p><b>About the job</b></p><p>Lead ethics and business integrity partnership across India operations.</p><p><b>About you</b></p><p>Strong compliance and stakeholder management background.</p>",
        "employmentType": "Regular",
        "identifier": "R2862050",
        "title": "EBI Business Partner",
        "url": "https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480",
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Mumbai",
              "addressCountry": "India"
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <a href="https://jobs.sanofi.com/sys/apply/job/application/2649/41764220480?languageCode=en" rel="nofollow" data-apply-mobile="true">Apply now</a>
  </body>
</html>
`

const principalDetailHtml = `
<!doctype html>
<html class="custom_fields.LocationCountry-India custom_fields.JobPostingEndDate-2026-08-12">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-07-07",
        "description": "<p><b>Job title</b>:<i> <b>Principal Statistical Programmer</b></i></p><p><b>About the job</b></p><p>Build statistical programming workflows for Hyderabad teams.</p><p><b>About you</b></p><p>Advanced programming expertise.</p>",
        "employmentType": "Regular",
        "identifier": "R2861703",
        "title": "Principal Statistical Programmer",
        "url": "https://jobs.sanofi.com/en/job/hyderabad/principal-statistical-programmer/2649/40282817856",
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Hyderabad",
              "addressCountry": "India"
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <a href="https://jobs.sanofi.com/sys/apply/job/application/2649/40282817856?languageCode=en" rel="nofollow" data-apply-mobile="true">Apply now</a>
  </body>
</html>
`

const hyperautomationDetailHtml = `
<!doctype html>
<html class="custom_fields.LocationCountry-India custom_fields.JobPostingEndDate-2026-08-20">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-07-24",
        "description": "<p><b>About the job</b></p><p>Build end-to-end automation solutions for global operations.</p><p><b>About you</b></p><p>Strong fullstack automation background.</p>",
        "employmentType": "Regular",
        "identifier": "R2866087",
        "title": "Hyperautomation Fullstack Developer",
        "url": "https://jobs.sanofi.com/en/job/hyderabad/hyperautomation-fullstack-developer/2649/41747792768",
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Hyderabad",
              "addressCountry": "India"
            }
          },
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Budapest",
              "addressCountry": "Hungary"
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <a href="https://jobs.sanofi.com/sys/apply/job/application/2649/41747792768?languageCode=en" rel="nofollow" data-apply-mobile="true">Apply now</a>
  </body>
</html>
`

test('search extraction keeps first-party India Sanofi results with page-count context', () => {
  assert.equal(CAREERS_PAGE_URL, 'https://jobs.sanofi.com/en/india')
  assert.equal(INDIA_SEARCH_URL, 'https://jobs.sanofi.com/en/search-jobs/india/20873/1/1')
  assert.equal(hasOfficialIndiaCareersSignal(indiaLandingHtml), true)
  assert.equal(hasOfficialIndiaCareersSignal(liveStyleIndiaLandingHtml), true)
  assert.equal(extractPageCount(searchPageOneHtml), 2)
  assert.deepEqual(extractSearchResults(searchPageOneHtml), [
    {
      title: 'EBI Business Partner',
      department: 'Ethics & Business Integrity',
      location: 'Mumbai, India',
      jobId: '41764220480',
      sourceUrl: 'https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480',
    },
  ])
  assert.deepEqual(extractSearchResults(searchPageTwoHtml), [
    {
      title: 'Principal Statistical Programmer',
      department: 'Digital Data & Technology',
      location: 'Hyderabad, India',
      jobId: '40282817856',
      sourceUrl: 'https://jobs.sanofi.com/en/job/hyderabad/principal-statistical-programmer/2649/40282817856',
    },
    {
      title: 'Hyperautomation Fullstack Developer',
      department: 'Digital Data & Technology',
      location: 'Multiple locations',
      jobId: '41747792768',
      sourceUrl: 'https://jobs.sanofi.com/en/job/hyderabad/hyperautomation-fullstack-developer/2649/41747792768',
    },
  ])
})

test('detail extraction maps Sanofi JSON-LD and apply URL into scraper fields', () => {
  assert.deepEqual(
    extractJobFromDetailPage(
      {
        title: 'EBI Business Partner',
        department: 'Ethics & Business Integrity',
        location: 'Mumbai, India',
        jobId: '41764220480',
        sourceUrl: 'https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480',
      },
      ebiDetailHtml,
    ),
    {
      title: 'EBI Business Partner',
      company: 'Sanofi',
      department: 'Ethics & Business Integrity',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '41764220480',
      requisitionId: 'R2862050',
      sourceUrl: 'https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480',
      applyUrl: 'https://jobs.sanofi.com/sys/apply/job/application/2649/41764220480?languageCode=en',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-08',
      closingDate: new Date('2026-08-10T00:00:00.000Z'),
      jobDescription: 'Lead ethics and business integrity partnership across India operations.',
      remoteStatus: 'On-site',
    },
  )
})

test('run walks the verified Sanofi India listing pages and enriches detail pages', async () => {
  const requestedUrls = []
  const scraper = createSanofiScraper({ maxJobs: 5 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) return indiaLandingHtml
      if (url === INDIA_SEARCH_URL) return searchPageOneHtml
      if (url === 'https://jobs.sanofi.com/en/search-jobs/india/20873/1/2') return searchPageTwoHtml
      if (url === 'https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480') return ebiDetailHtml
      if (url === 'https://jobs.sanofi.com/en/job/hyderabad/principal-statistical-programmer/2649/40282817856') return principalDetailHtml
      if (url === 'https://jobs.sanofi.com/en/job/hyderabad/hyperautomation-fullstack-developer/2649/41747792768') return hyperautomationDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_PAGE_URL,
    INDIA_SEARCH_URL,
    'https://jobs.sanofi.com/en/search-jobs/india/20873/1/2',
    'https://jobs.sanofi.com/en/job/mumbai/ebi-business-partner/2649/41764220480',
    'https://jobs.sanofi.com/en/job/hyderabad/principal-statistical-programmer/2649/40282817856',
    'https://jobs.sanofi.com/en/job/hyderabad/hyperautomation-fullstack-developer/2649/41747792768',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sanofi')
  assert.equal(jobs[0].company, 'Sanofi')
  assert.equal(jobs[0].jobId, '41764220480')
  assert.equal(jobs[1].jobId, '40282817856')
  assert.equal(jobs[2].jobId, '41747792768')
  assert.equal(jobs[2].location, 'Hyderabad, India')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
