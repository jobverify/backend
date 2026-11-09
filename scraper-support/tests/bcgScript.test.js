import assert from 'node:assert/strict'
import test from 'node:test'

const SEARCH_RESULTS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Jobs | BCG Careers</title>
  </head>
  <body>
    <script>
      var phApp = phApp || {};
      phApp.ddo = {
        "eagerLoadRefineSearch": {
          "totalHits": 1,
          "hits": 1,
          "jobs": [
            {
              "reqId": "58414",
              "jobId": "58414",
              "title": "Office Operations Coordinator",
              "country": "India",
              "cityStateCountry": "Gurgaon, India",
              "location": "Gurgaon, India",
              "category": "Operations",
              "type": "Permanent",
              "descriptionTeaser": "Coordinate office operations and facilities.",
              "postedDate": "2026-07-01T00:00:00.000+0000",
              "applyUrl": "https://experiencedtalent.bcg.com/careerhub/explore/jobs/58414",
              "ml_skills": ["facility management", "vendor coordination"]
            }
          ],
          "aggregations": [
            { "field": "country", "value": { "India": 85 } }
          ]
        }
      };
    </script>
  </body>
</html>
`

const JOB_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://careers.bcg.com/global/en/job/58414/Office-Operations-Coordinator" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Office Operations Coordinator",
        "description": "<p>Support office operations and workplace services.</p><p><strong>Required Skills</strong></p><ul><li>Facilities coordination</li><li>Vendor management</li></ul>",
        "datePosted": "2026-07-02",
        "employmentType": "FULL_TIME",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Gurgaon",
            "addressRegion": "Haryana",
            "addressCountry": "India"
          }
        }
      }
    </script>
    <script>
      var phApp = phApp || {};
      phApp.ddo = {
        "jobDetail": {
          "data": {
            "job": {
              "jobId": "58414",
              "reqId": "58414",
              "title": "Office Operations Coordinator",
              "category": "Operations",
              "type": "Permanent",
              "applyUrl": "https://experiencedtalent.bcg.com/careerhub/explore/jobs/58414",
              "ml_Description": "<p>Support office operations and workplace services.</p>",
              "experience_sentences": ["5+ years experience in office operations."],
              "education_sentences": ["Bachelor's degree required."],
              "skills_sentences": ["Facilities coordination", "Vendor management"],
              "postedDate": "2026-07-02"
            }
          }
        }
      };
    </script>
  </head>
  <body></body>
</html>
`

const loadBcgModule = async () => {
  try {
    return await import('../../scraper/bcg/script.js')
  } catch {
    assert.fail('Expected BCG scraper module at ../../scraper/bcg/script.js')
  }
}

test('buildSearchResultsPageUrl keeps BCG listings on the official Phenom route', async () => {
  const { buildSearchResultsPageUrl } = await loadBcgModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.bcg.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(20),
    'https://careers.bcg.com/global/en/search-results?from=20',
  )
})

test('run keeps BCG jobs on the official Phenom route and decorates shared runner fields', async () => {
  const { buildSearchResultsPageUrl, run } = await loadBcgModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) return SEARCH_RESULTS_HTML
      if (url === 'https://careers.bcg.com/global/en/job/58414/Office-Operations-Coordinator') {
        return JOB_DETAIL_HTML
      }
      throw new Error(`Unexpected BCG fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.bcg.com/global/en/search-results',
    'https://careers.bcg.com/global/en/job/58414/Office-Operations-Coordinator',
    'https://careers.bcg.com/global/en/search-results',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual({ ...jobs[0], scrapedAt: 'ignored' }, {
    jobId: '58414',
    requisitionId: '58414',
    title: 'Office Operations Coordinator',
    company: 'BCG',
    department: 'Operations',
    location: 'Gurgaon, India',
    city: 'Gurgaon',
    country: 'India',
    link: 'https://experiencedtalent.bcg.com/careerhub/explore/jobs/58414',
    applyUrl: 'https://experiencedtalent.bcg.com/careerhub/explore/jobs/58414',
    sourceUrl: 'https://careers.bcg.com/global/en/job/58414/Office-Operations-Coordinator',
    source: 'bcg',
    sourceListingComplete: false,
    sourceListingTeaser: 'Coordinate office operations and facilities.',
    sourceDetailComplete: true,
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: '5+ years',
    publicExperienceChecked: true,
    jobDescription: 'Support office operations and workplace services.',
    minimumQualification: "Bachelor's degree required.",
    preferredQualification: null,
    requiredSkills: ['Facilities coordination', 'Vendor management'],
    postingDate: '2026-07-02',
    scrapedAt: 'ignored',
  })
  assert.ok(typeof jobs[0].scrapedAt === 'string' && jobs[0].scrapedAt.length > 0)
})
