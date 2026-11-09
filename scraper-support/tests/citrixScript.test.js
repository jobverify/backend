import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T16:00:00.000Z'
const CITRIX_BRAND_UID = '52b9daa103e374ed61d42e7d1d80b7ad'
const DETAIL_URL = 'https://careers.cloud.com/jobs/principal-account-technology-strategist-bangalore-karnataka-india-11c58380-1ac6-4de3-a931-5a6881616168'

const officialSearchHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Career Search - Cloud Software Group</title>
  </head>
  <body>
    <script>
      window.js_vars = {
        links: {
          job_search: { url: 'https://careers.cloud.com/jobs/search' }
        }
      }
    </script>
    <form action="https://careers.cloud.com/jobs/search" method="get">
      <div class="block-job-search-results" data-controller="jobs--search">
        <input
          type="checkbox"
          name="country_codes[]"
          value="IN"
          checked="checked"
        />
        <input
          type="checkbox"
          name="dropdown_field_3_uids[]"
          value="${CITRIX_BRAND_UID}"
          checked="checked"
        />
        <div class="job-search-results-active-filters">
          <span class="badge bg-primary active-filter">India</span>
          <span class="badge bg-primary active-filter">Citrix</span>
        </div>
        <div id="jobs_search_results_verified" data-jobs--search-target="jobsSearchResults">
          <div class="row job-search-results-card-row">
            <article class="col-12 job-search-results-card-col" aria-labelledby="link_job_title_1_0_0">
              <div class="card job-search-results-card">
                <div class="card-body job-search-results-card-body">
                  <h3 class="card-title job-search-results-card-title">
                    <a id="link_job_title_1_0_0" href="${DETAIL_URL}">
                      Principal Account Technology Strategist
                    </a>
                  </h3>
                  <div class="job-component-details">
                    <div class="job-component-list">
                      <ul>
                        <li class="job-component-icon-and-text job-component-workplace-type">
                          <span data-value="remote">Remote</span>
                        </li>
                      </ul>
                    </div>
                    <div class="job-component-list job-component-list-location">
                      <ul>
                        <li class="job-component-icon-and-text job-component-location">
                          <span>Bangalore, Karnātaka, India</span>
                        </li>
                      </ul>
                    </div>
                    <div class="job-component-list">
                      <ul>
                        <li class="job-component-icon-and-text job-component-dropdown-field-3">
                          <span>Citrix</span>
                        </li>
                        <li class="job-component-icon-and-text job-component-dropdown-field-4">
                          <span>Sales</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <p class="card-text job-search-results-summary" id="summary_1_0_0">
                    IC5 - Principal Account Technical Strategist
                  </p>
                </div>
                <div class="card-footer job-search-results-footer">
                  <a id="link_read_more_1_0_0" href="${DETAIL_URL}">
                    Read more
                  </a>
                </div>
              </div>
            </article>
          </div>
          <div class="bottom-pagination">
            <div class="table-counts" role="alert" aria-live="polite">
              <p>Displaying <b>1</b> entry</p>
            </div>
          </div>
        </div>
      </div>
    </form>
  </body>
</html>
`

const officialDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Principal Account Technology Strategist - Bangalore, Karnātaka, India</title>
    <link rel="canonical" href="${DETAIL_URL}" />
    <meta property="og:url" content="${DETAIL_URL}" />
  </head>
  <body>
    <script>
      window.js_vars = {
        job: { uid: '534d0442cbee34c39649d7efa3260fba' },
        third_party_libraries: {
          google_tag_manager: {
            data_layer: {
              page: { title: 'Sales Job Page' },
              job: {
                uid: '534d0442cbee34c39649d7efa3260fba',
                ats_uid: 'R104238',
                departments: ['Account Technology Strategist'],
                categories: ['Sales & Customer Success'],
                title: 'Principal Account Technology Strategist'
              }
            }
          }
        }
      }
    </script>
    <h3><a class="button button1" href="#applycta">Apply Now</a></h3>
    <strong>Req ID:</strong> <span class="editor-placeholder">R104238</span>
    <div class="block-job-description">
      <h3 class="job-title">Principal Account Technology Strategist</h3>
      <div class="job-component-details">
        <div class="job-component-list">
          <ul>
            <li class="job-component-icon-and-text job-component-workplace-type">
              <span data-value="remote">Remote</span>
            </li>
          </ul>
        </div>
        <div class="job-component-list job-component-list-location">
          <ul>
            <li class="job-component-icon-and-text job-component-location">
              <span>Bangalore, Karnātaka, India</span>
            </li>
          </ul>
        </div>
        <div class="job-component-list">
          <ul>
            <li class="job-component-icon-and-text job-component-dropdown-field-3">
              <span>Citrix</span>
            </li>
          </ul>
        </div>
      </div>
      <div
        class="block-call-to-action"
        data-call-to-action--form-kind-value="apply_url"
      >
        <turbo-frame
          src="/pages/f8b9ee318598cd0109759408a4995e21/blocks/768f5574b50b052b1c41b7097d70fc8c?job_uid=534d0442cbee34c39649d7efa3260fba&amp;postfix=1_1"
        ></turbo-frame>
      </div>
      <div id="job_description_5bd35060843718294d0048fe54796a12" class="job-description">
        <p><b>IC5 - Principal Account Technical Strategist</b></p>
        <p><b>Job Description</b></p>
        <p>
          The Principal Account Technology Strategist (ATS) is responsible for
          identifying and matching technologies with a customer’s business issues.
        </p>
        <div><p><b>Required Experience/Skills</b></p></div>
        <ul>
          <li>They must have a solid understanding of Citrix's competitive domain and technologies.</li>
          <li>12+ years of Sales Engineering, Consulting, or Customer Success experience.</li>
        </ul>
      </div>
    </div>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org/",
        "@type": "JobPosting",
        "title": "Principal Account Technology Strategist",
        "description": "<p><b>IC5 - Principal Account Technical Strategist</b></p><p><b>Job Description</b></p><p>The Principal Account Technology Strategist (ATS) is responsible for identifying and matching technologies with a customer’s business issues.</p><p><b>Required Experience/Skills</b></p><ul><li>They must have a solid understanding of Citrix's competitive domain and technologies.</li><li>12+ years of Sales Engineering, Consulting, or Customer Success experience.</li></ul>",
        "datePosted": "2026-01-28T08:35:12Z",
        "employmentType": "FULL_TIME",
        "validThrough": "2026-10-11T15:15:58Z",
        "directApply": false,
        "jobLocation": [
          {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Bangalore",
              "addressRegion": "Karnātaka",
              "addressCountry": "IN"
            }
          }
        ],
        "jobLocationType": "TELECOMMUTE"
      }
    </script>
  </body>
</html>
`

const loadCitrixModule = async () => {
  try {
    return await import('../../scraper/citrix/script.js')
  } catch {
    assert.fail('Expected Citrix scraper module at ../../scraper/citrix/script.js')
  }
}

test('Citrix builds the official Cloud Software Group India and Citrix search URL', async () => {
  const citrix = await loadCitrixModule()

  assert.equal(citrix.CAREERS_URL, 'https://careers.cloud.com/jobs/search')
  assert.equal(citrix.COMPANY_DOMAIN, 'cloud.com')
  assert.equal(citrix.CITRIX_BRAND_UID, CITRIX_BRAND_UID)
  assert.equal(
    citrix.buildSearchUrl(),
    'https://careers.cloud.com/jobs/search?country_codes%5B%5D=IN&dropdown_field_3_uids%5B%5D=52b9daa103e374ed61d42e7d1d80b7ad',
  )
  assert.equal(
    citrix.buildSearchUrl(2),
    'https://careers.cloud.com/jobs/search?country_codes%5B%5D=IN&dropdown_field_3_uids%5B%5D=52b9daa103e374ed61d42e7d1d80b7ad&page=2',
  )
})

test('Citrix recognizes the verified first-party search surface and extracts India result cards', async () => {
  const citrix = await loadCitrixModule()

  assert.equal(citrix.hasOfficialSearchSurface(officialSearchHtml), true)

  const cards = citrix.extractSearchResults(officialSearchHtml)

  assert.equal(cards.length, 1)
  assert.deepEqual(cards[0], {
    title: 'Principal Account Technology Strategist',
    sourceUrl: DETAIL_URL,
    location: 'Bangalore, Karnātaka, India',
    remoteStatus: 'Remote',
    brand: 'Citrix',
    department: 'Sales',
    summary: 'IC5 - Principal Account Technical Strategist',
  })
  assert.deepEqual(citrix.extractPagination(officialSearchHtml), {
    displayedCount: 1,
    totalCount: 1,
    hasNext: false,
  })
})

test('Citrix extracts verified detail metadata from the official detail page', async () => {
  const citrix = await loadCitrixModule()

  const detail = citrix.extractJobDetail(officialDetailHtml)

  assert.equal(detail.requisitionId, 'R104238')
  assert.equal(detail.jobId, 'R104238')
  assert.equal(detail.title, 'Principal Account Technology Strategist')
  assert.equal(detail.location, 'Bangalore, Karnātaka, India')
  assert.equal(detail.remoteStatus, 'Remote')
  assert.equal(detail.brand, 'Citrix')
  assert.equal(detail.postingDate, '2026-01-28T08:35:12Z')
  assert.equal(detail.closingDate, '2026-10-11T15:15:58Z')
  assert.equal(detail.employmentType, 'FULL_TIME')
  assert.equal(detail.applyUrl, DETAIL_URL)
  assert.match(detail.jobDescription, /Principal Account Technology Strategist/)
  assert.match(detail.jobDescription, /Required Experience\/Skills/)
})

test('Citrix run fetches the official search page and detail page and normalizes the India job', async () => {
  const citrix = await loadCitrixModule()
  const requestedUrls = []

  const jobs = await citrix.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === citrix.buildSearchUrl()) {
        return officialSearchHtml
      }
      if (url === DETAIL_URL) {
        return officialDetailHtml
      }
      throw new Error(`Unexpected Citrix fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    citrix.buildSearchUrl(),
    DETAIL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Principal Account Technology Strategist',
    company: 'Citrix',
    location: 'Bangalore, Karnātaka, India',
    city: 'Bangalore',
    country: 'India',
    link: DETAIL_URL,
    applyUrl: DETAIL_URL,
    sourceUrl: DETAIL_URL,
    source: 'citrix',
    jobId: 'R104238',
    requisitionId: 'R104238',
    department: 'Sales',
    employmentType: 'FULL_TIME',
    experienceRequired: null,
    jobDescription: '<p><b>IC5 - Principal Account Technical Strategist</b></p><p><b>Job Description</b></p><p>The Principal Account Technology Strategist (ATS) is responsible for identifying and matching technologies with a customer’s business issues.</p><p><b>Required Experience/Skills</b></p><ul><li>They must have a solid understanding of Citrix\'s competitive domain and technologies.</li><li>12+ years of Sales Engineering, Consulting, or Customer Success experience.</li></ul>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-01-28T08:35:12Z',
    closingDate: '2026-10-11T15:15:58Z',
    remoteStatus: 'Remote',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})
