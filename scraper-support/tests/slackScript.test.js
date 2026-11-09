import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'
const INDIA_JOB_URL = 'https://salesforce.wd12.myworkdayjobs.com/Slack/job/India---Bangalore/Technical-Success-Architect---Slack_JR356029-1'
const US_JOB_URL = 'https://salesforce.wd12.myworkdayjobs.com/Slack/job/California---San-Francisco/Staff-Data-Scientist-_JR355021-2'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Slack</title>
    <link rel="canonical" href="https://slack.com/intl/en-in/careers" />
  </head>
  <body>
    <main>
      <h1>Careers at Slack</h1>
      <h2>Work with us</h2>
      <section>
        <h3>Career opportunities</h3>
        <p>Explore our open roles for working totally remotely, from the office or somewhere in between.</p>
      </section>
      <section aria-label="Job filters">
        <h3>Filter job listings</h3>
        <div>
          <select class="jobs-filter--mobile--location jobs-filter--mobile__selection mobile-location-selected" data-default-value="all-locations">
            <option value="all-locations" selected>All locations</option>
            <option value="california-remote">California - Remote</option>
            <option value="california-san-francisco">California - San Francisco</option>
            <option value="georgia-atlanta">Georgia - Atlanta</option>
            <option value="india-bangalore">India - Bangalore</option>
            <option value="india-hyderabad">India - Hyderabad</option>
            <option value="netherlands-amsterdam">Netherlands - Amsterdam</option>
            <option value="new-york-new-york">New York - New York</option>
            <option value="washington-seattle">Washington - Seattle</option>
            <option value="washington-seattle-metro-remote">Washington - Seattle Metro - Remote</option>
          </select>
        </div>
        <div>
          <span>All departments</span>
          <ul data-filter-name="departments">
            <li>Product</li>
            <li>Sales</li>
            <li>Software Engineering</li>
          </ul>
        </div>
      </section>
      <section aria-label="Open positions">
        <p>11Open positions</p>
        <div class="job-listing" data-filter-namespace="careers" data-filter-tags="all-departments, all-locations, all-types, customer-success, technical-success-architect-slack, regular, india-bangalore, india-hyderabad">
          <div class="job-listing__category">
            <div class="job-listing__category-line"></div>
            <span class="job-listing__category-title">Customer Success</span>
          </div>
          <table class="job-listing__table">
            <tbody>
              <tr class="for-mobile-only" data-filter-tags="all-departments, all-locations, customer-success, technical-success-architect-slack, regular, india-bangalore, india-hyderabad">
                <td class="for-mobile-only">
                  <p class="job-listing__table-title">Technical Success Architect - Slack</p>
                  <p class="job-listing__table-location">2 locations</p>
                  <p class="job-listing__table-link">
                    <a class="o-section--feature__link" data-job-id="JR356029" href="${INDIA_JOB_URL}" target="_blank" aria-label="Apply for Technical Success Architect - Slack 2 locations">Apply</a>
                  </p>
                </td>
              </tr>
              <tr class="for-desktop-only--table-row" data-filter-tags="all-departments, all-locations, customer-success, technical-success-architect-slack, regular, india-bangalore, india-hyderabad">
                <td class="job-listing__table--title-col for-desktop-only--table-cell"><p>Technical Success Architect - Slack</p></td>
                <td class="job-listing__table--department-col for-desktop-only--table-cell"><p>Customer Success</p></td>
                <td class="job-listing__table--location-col for-desktop-only--table-cell"><p>2 locations</p></td>
                <td class="job-listing__table--link-col for-desktop-only--table-cell"><a data-job-id="JR356029" href="${INDIA_JOB_URL}">Apply</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="job-listing" data-filter-namespace="careers" data-filter-tags="all-departments, all-locations, all-types, data-science, staff-data-scientist, regular, california-san-francisco">
          <div class="job-listing__category">
            <div class="job-listing__category-line"></div>
            <span class="job-listing__category-title">Data Science</span>
          </div>
          <table class="job-listing__table">
            <tbody>
              <tr class="for-mobile-only" data-filter-tags="all-departments, all-locations, data-science, staff-data-scientist, regular, california-san-francisco">
                <td class="for-mobile-only">
                  <p class="job-listing__table-title">Staff Data Scientist</p>
                  <p class="job-listing__table-location">California - San Francisco</p>
                  <p class="job-listing__table-link">
                    <a class="o-section--feature__link" data-job-id="JR355021" href="${US_JOB_URL}" target="_blank" aria-label="Apply for Staff Data Scientist California - San Francisco">Apply</a>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </body>
</html>
`

const INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "India",
            "addressLocality": "India - Bangalore"
          }
        },
        "applicantLocationRequirements": {
          "@type": "Country",
          "name": "India"
        },
        "jobLocationType": "TELECOMMUTE",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "611 salesforce.com India Private Limited"
        },
        "identifier": {
          "@type": "PropertyValue",
          "name": "Technical Success Architect - Slack",
          "value": "JR356029"
        },
        "datePosted": "2026-08-13",
        "employmentType": "FULL_TIME",
        "title": "Technical Success Architect - Slack",
        "description": "Slack is on a mission to make your working life simpler, more pleasant and more productive. We are looking for a Technical Success Architect to help customers adopt Slack at scale using APIs, integrations, and JavaScript."
      }
    </script>
  </body>
</html>
`

const NON_INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "United States",
            "addressLocality": "California - San Francisco"
          }
        },
        "identifier": {
          "@type": "PropertyValue",
          "name": "Technical Success Architect",
          "value": "JR356029"
        },
        "datePosted": "2026-08-13",
        "employmentType": "FULL_TIME",
        "title": "Technical Success Architect",
        "description": "Salesforce role without the Slack brand signal."
      }
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/slack/script.js')
  } catch {
    assert.fail('Expected Slack scraper module at ../../scraper/slack/script.js')
  }
}

test('Slack pins the verified first-party careers page, India listing tags, and Workday detail contract', async () => {
  const slack = await loadModule()

  assert.equal(slack.SOURCE, 'slack')
  assert.equal(slack.COMPANY, 'Slack')
  assert.equal(slack.OFFICIAL_BRAND_NAME, 'Slack')
  assert.equal(slack.VERIFIED_ON, '2026-08-14')
  assert.equal(slack.CAREERS_PAGE_URL, 'https://slack.com/intl/en-in/careers')
  assert.equal(slack.OFFICIAL_CAREERS_PAGE_URL, 'https://slack.com/careers')
  assert.equal(slack.PUBLIC_JOB_BOARD_HOSTNAME, 'salesforce.wd12.myworkdayjobs.com')
  assert.equal(slack.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.deepEqual(slack.extractLocationOptions(OFFICIAL_CAREERS_HTML), [
    'California - Remote',
    'California - San Francisco',
    'Georgia - Atlanta',
    'India - Bangalore',
    'India - Hyderabad',
    'Netherlands - Amsterdam',
    'New York - New York',
    'Washington - Seattle',
    'Washington - Seattle Metro - Remote',
  ])
  assert.deepEqual(slack.extractPublicJobUrls(OFFICIAL_CAREERS_HTML), [
    INDIA_JOB_URL,
    US_JOB_URL,
  ])
  assert.deepEqual(slack.extractIndiaRoleSummaries(OFFICIAL_CAREERS_HTML), [
    {
      title: 'Technical Success Architect - Slack',
      department: 'Customer Success',
      locationLabel: '2 locations',
      locations: ['India - Bangalore', 'India - Hyderabad'],
      locationSlugs: ['india-bangalore', 'india-hyderabad'],
      url: INDIA_JOB_URL,
      jobId: 'JR356029',
    },
  ])
  assert.deepEqual(slack.extractJobFromDetail(
    slack.extractIndiaRoleSummaries(OFFICIAL_CAREERS_HTML)[0],
    INDIA_DETAIL_HTML,
  ), {
    title: 'Technical Success Architect - Slack',
    company: 'Slack',
    department: 'Customer Success',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'JR356029',
    requisitionId: 'JR356029',
    sourceUrl: INDIA_JOB_URL,
    applyUrl: INDIA_JOB_URL,
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-13',
    closingDate: null,
    jobDescription: 'Slack is on a mission to make your working life simpler, more pleasant and more productive. We are looking for a Technical Success Architect to help customers adopt Slack at scale using APIs, integrations, and JavaScript.',
    locations: ['Bangalore', 'Hyderabad'],
  })
})

test('Slack returns the verified India requisition linked from the first-party careers page', async () => {
  const slack = await loadModule()
  const requestedUrls = []

  const jobs = await slack.createSlackScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === slack.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML
      if (url === INDIA_JOB_URL) return INDIA_DETAIL_HTML
      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [slack.CAREERS_PAGE_URL, INDIA_JOB_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Technical Success Architect - Slack',
      company: 'Slack',
      department: 'Customer Success',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'JR356029',
      requisitionId: 'JR356029',
      sourceUrl: INDIA_JOB_URL,
      applyUrl: INDIA_JOB_URL,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-13',
      closingDate: null,
      jobDescription: 'Slack is on a mission to make your working life simpler, more pleasant and more productive. We are looking for a Technical Success Architect to help customers adopt Slack at scale using APIs, integrations, and JavaScript.',
      locations: ['Bangalore', 'Hyderabad'],
      source: 'slack',
      link: INDIA_JOB_URL,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Slack fails closed when the careers page or India role detail contracts drift', async () => {
  const slack = await loadModule()

  await assert.rejects(
    slack.createSlackScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified official slack careers page/i,
  )

  await assert.rejects(
    slack.createSlackScraper().run({
      fetchText: async (url) => {
        if (url === slack.CAREERS_PAGE_URL) {
          return OFFICIAL_CAREERS_HTML.replace(/india-bangalore, india-hyderabad/g, 'california-san-francisco')
            .replace(new RegExp(INDIA_JOB_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), US_JOB_URL)
        }
        return INDIA_DETAIL_HTML
      },
    }),
    /verified slack india role listing changed materially/i,
  )

  await assert.rejects(
    slack.createSlackScraper().run({
      fetchText: async (url) => {
        if (url === slack.CAREERS_PAGE_URL) return OFFICIAL_CAREERS_HTML
        if (url === INDIA_JOB_URL) return NON_INDIA_DETAIL_HTML
        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /verified slack india role detail page changed materially/i,
  )
})
