import assert from 'node:assert/strict'
import test from 'node:test'

const loadNeeyamoModule = async () => {
  try {
    return await import('../../scraper/neeyamo/script.js')
  } catch (error) {
    assert.fail(`Expected Neeyamo scraper module at ../../scraper/neeyamo/script.js (${error.code || error.message})`)
  }
}

const listingHtml = `
<!doctype html>
<html>
  <body>
    <div class="view-content">
      <div data-drupal-views-infinite-scroll-content-wrapper class="views-infinite-scroll-content-wrapper clearfix">
        <h3>Sales &amp; Business Development</h3>
        <div class="views-row">
          <div class="views-field views-field-rendered-entity">
            <span class="field-content">
              <article role="article" about="/job-postings/sales-executive-manila-philippines" class="node node--type-careers clearfix job-details-teaser-container">
                <div class="field-careers-details">
                  <a href="/job-postings/sales-executive-manila-philippines">
                    <div class="field-careers-title">Sales Executive for Manila, Philippines</div>
                    <span class="arrow-icon-link"></span>
                    <div class="field-careers-location">
                      <div class="field field--name-field-careers-location field--type-entity-reference field--label-hidden field__item">Philippines</div>
                    </div>
                  </a>
                </div>
              </article>
            </span>
          </div>
        </div>
        <div class="views-row">
          <div class="views-field views-field-rendered-entity">
            <span class="field-content">
              <article role="article" about="/job-postings/sales-manager" class="node node--type-careers clearfix job-details-teaser-container">
                <div class="field-careers-details">
                  <a href="/job-postings/sales-manager">
                    <div class="field-careers-title">Sales Manager</div>
                    <span class="arrow-icon-link"></span>
                    <div class="field-careers-location">
                      <div class="field field--name-field-careers-location field--type-entity-reference field--label-hidden field__item">India</div>
                    </div>
                  </a>
                </div>
              </article>
            </span>
          </div>
        </div>
        <h3>Global Payroll</h3>
        <div class="views-row">
          <div class="views-field views-field-rendered-entity">
            <span class="field-content">
              <article role="article" about="/job-postings/latam-payroll-specialist" class="node node--type-careers clearfix job-details-teaser-container">
                <div class="field-careers-details">
                  <a href="/job-postings/latam-payroll-specialist">
                    <div class="field-careers-title">LATAM Payroll Specialist</div>
                    <span class="arrow-icon-link"></span>
                    <div class="field-careers-location">
                      <div class="field field--name-field-careers-location field--type-entity-reference field--label-hidden field__item">Mexico</div>
                    </div>
                  </a>
                </div>
              </article>
            </span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <head>
    <meta name="description" content="Neeyamo is seeking a dynamic and experienced Sales professional to lead and grow our global sales team for pre-employment background screening services." />
  </head>
  <body>
    <div class="careers-department">
      <div class="field field--name-field-careers-department field--type-entity-reference field--label-hidden field__item">Sales &amp; Business Development</div>
    </div>
    <h1>Sales Manager</h1>
    <div class="careers-city">
      <div class="field field--name-field-careers-city field--type-entity-reference field--label-hidden field__item">Pune</div>
    </div>
    <div class="apply-now">
      <a aria-label="Sales Manager" href="#apply-now" class="apply-now-button btn btn-primary btn-no-arrow">Apply Now</a>
    </div>

    <div class="careers-sections">
      <div class="tab-content">
        <div class="careers-tab-pane" id="tab-0">
          <p>Neeyamo is seeking a dynamic and experienced Sales professional to lead and grow our global sales team for pre-employment background screening services.</p>
        </div>
        <div class="careers-tab-pane" id="tab-1">
          <h2>Core Responsibilities</h2>
          <ul>
            <li>Lead and manage a team of 3 to 4 sales professionals covering global markets.</li>
            <li>Develop and execute effective sales strategies to meet and exceed team revenue targets.</li>
          </ul>
        </div>
        <div class="careers-tab-pane" id="tab-2">
          <h2>Experience and Skills</h2>
          <ul>
            <li>MBA preferred.</li>
            <li>5-10 years of total experience, including at least 2 years in a sales leadership role.</li>
            <li>Proven experience working with global clients and international markets.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="container apply-now-text" id="apply-now">
      <p class="h2 text-align-center">Apply Now For Your Dream Job</p>
    </div>
    <div class="apply-now-container">
      <div class="apply-now-form">
        <div class="job-application-form">
          <span id="webform-submission-job-application-node-1610-form-ajax-content"></span>
          <div id="webform-submission-job-application-node-1610-form-ajax" class="webform-ajax-form-wrapper">
            <form class="webform-submission-form webform-submission-job-application-form" action="/job-postings/sales-manager" method="post">
              <fieldset class="js-form-item js-form-type-email form-type-email js-form-item-job-application-email form-item-job-application-email form-group">
                <label for="edit-job-application-email" class="js-form-required form-required">Reply to me on</label>
                <input data-drupal-selector="edit-job-application-email" type="email" id="edit-job-application-email" name="job_application_email" value="" />
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const expectedDescription = [
  'Neeyamo is seeking a dynamic and experienced Sales professional to lead and grow our global sales team for pre-employment background screening services.',
  'Core Responsibilities',
  'Lead and manage a team of 3 to 4 sales professionals covering global markets.',
  'Develop and execute effective sales strategies to meet and exceed team revenue targets.',
  'Experience and Skills',
  'MBA preferred.',
  '5-10 years of total experience, including at least 2 years in a sales leadership role.',
  'Proven experience working with global clients and international markets.',
].join(' ')

test('extractSearchResults keeps only Neeyamo India listings and uses the detail page fragment apply URL', async () => {
  const neeyamo = await loadNeeyamoModule()

  const jobs = neeyamo.extractSearchResults({
    listingHtml,
    detailHtmlByUrl: {
      'https://www.neeyamo.com/job-postings/sales-manager': detailHtml,
    },
  })

  assert.deepEqual(jobs, [{
    title: 'Sales Manager',
    company: 'Neeyamo',
    department: 'Sales & Business Development',
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: 'sales-manager',
    requisitionId: 'sales-manager',
    sourceUrl: 'https://www.neeyamo.com/job-postings/sales-manager',
    applyUrl: 'https://www.neeyamo.com/job-postings/sales-manager#apply-now',
    employmentType: null,
    experienceRequired: '5-10 years of total experience, including at least 2 years in a sales leadership role.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: expectedDescription,
    remoteStatus: 'On-site',
  }])
})

test('run fetches the Neeyamo careers page, post-filters India roles, and only then loads the India detail page', async () => {
  const neeyamo = await loadNeeyamoModule()
  const requestedUrls = []
  const scraper = neeyamo.createNeeyamoScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === neeyamo.LISTING_URL) return listingHtml
      if (url === 'https://www.neeyamo.com/job-postings/sales-manager') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    neeyamo.LISTING_URL,
    'https://www.neeyamo.com/job-postings/sales-manager',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'neeyamo')
  assert.equal(jobs[0].company, 'Neeyamo')
  assert.equal(jobs[0].link, 'https://www.neeyamo.com/job-postings/sales-manager#apply-now')
  assert.equal(jobs[0].applyUrl, 'https://www.neeyamo.com/job-postings/sales-manager#apply-now')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
