import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const firstJobsPageHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Search Jobs | Experian</title>
    <link rel="canonical" href="https://jobs.experian.com/jobs" />
  </head>
  <body class="page-job-results">
    <nav aria-label="Main navigation">
      <a href="/jobs">Search Jobs Home</a>
      <a href="https://www.experian.com/careers">Global Careers</a>
      <a href="https://www.experian.com/careers/tech-careers">Tech Careers</a>
    </nav>
    <div id="jobfilters" class="Horizontal search-filters-widget__filter-list">
      <div class="optionfiltergroup">
        <div class="option-type-header" role="button"><h3 class="option-type-header-text">Location / Local</h3></div>
        <ul class="option-display-list" id="location-filter-list">
          <li class="filter-option has-child-elements" data-option-id="341">
            <span class="filter-contents" role="checkbox" aria-label="Australia" aria-checked="false" tabindex="0">
              <span class="filter-text">Australia</span><span class="filter-count">(5)</span>
            </span>
          </li>
          <li class="filter-option has-child-elements" data-option-id="422">
            <span class="filter-contents" role="checkbox" aria-label="India" aria-checked="false" tabindex="0">
              <span class="filter-text">India</span><span class="filter-count">(38)</span>
            </span>
          </li>
          <li class="filter-option has-child-elements" data-option-id="1050">
            <span class="filter-contents" role="checkbox" aria-label="United States" aria-checked="false" tabindex="0">
              <span class="filter-text">United States</span><span class="filter-count">(22)</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
    <div class="attrax-pagination__results-count">
      <span class="attrax-pagination__total-results-hero">369 Jobs</span>
      <span class="attrax-pagination__total-results-pagination"><strong>369</strong> roles available</span>
    </div>
    <div class="attrax-list-widget__list attrax-list-widget__list--has-items">
      <div class="attrax-vacancy-tile sector-product-management attrax-vacancy-tile--mumbai attrax-vacancy-tile--india attrax-vacancy-tile--permanent attrax-vacancy-tile--hybrid attrax-vacancy-tile--full-time attrax-vacancy-tile--experian attrax-vacancy-tile--no attrax-vacancy-tile--midsenior-level attrax-vacancy-tile--no-author" data-jobid="3726">
        <a aria-level="3" class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/product-manager-in-mumbai-india-jid-3726" role="heading" tabindex="0">Product Manager</a>
        <div class="attrax-vacancy-tile__location-freetext attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Mumbai, India</p>
        </div>
        <div class="attrax-vacancy-tile__option-experience-level attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-experience-level-label attrax-vacancy-tile__item-label">Experience Level</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Mid-Senior Level</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-employment attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-employment-label attrax-vacancy-tile__item-label">Employment</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Permanent</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Mumbai</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-role-type attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-role-type-label attrax-vacancy-tile__item-label">Role Type</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Hybrid</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-schedule attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-schedule-label attrax-vacancy-tile__item-label">Schedule</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Full Time</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-department attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-department-label attrax-vacancy-tile__item-label">Department</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Product Management</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-brand attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-brand-label attrax-vacancy-tile__item-label">Brand</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Experian</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-remote-working-available attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-remote-working-available-label attrax-vacancy-tile__item-label">Remote working available</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">No</p></div>
        </div>
        <div class="attrax-vacancy-tile__description attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__description-label attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__description-value attrax-vacancy-tile__item-value">Experian is looking for smart product management professionals to be a part of our Credit Services business. In the role of Product Manager, you will be responsible for understanding existing solution</p>
        </div>
        <div class="attrax-vacancy-tile__reference attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__reference-label attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__reference-value attrax-vacancy-tile__item-value">54028518-b255-4252-b2af-0edd3058acbc</p>
        </div>
        <div class="attrax-vacancy-tile__expiry attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__expiry-label attrax-vacancy-tile__item-label">Expiry Date</p>
          <p class="attrax-vacancy-tile__expiry-value attrax-vacancy-tile__item-value">01/01/0001</p>
        </div>
      </div>
      <div class="attrax-vacancy-tile sector-product-development attrax-vacancy-tile--hyderabad attrax-vacancy-tile--india attrax-vacancy-tile--permanent attrax-vacancy-tile--hybrid attrax-vacancy-tile--full-time attrax-vacancy-tile--experian attrax-vacancy-tile--no attrax-vacancy-tile--not-applicable attrax-vacancy-tile--no-author" data-jobid="5055">
        <a aria-level="3" class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/agentic-ai-engineer-in-hyderabad-india-jid-5055" role="heading" tabindex="0">Agentic AI Engineer</a>
        <div class="attrax-vacancy-tile__location-freetext attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Hyderabad, India</p>
        </div>
        <div class="attrax-vacancy-tile__option-experience-level attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-experience-level-label attrax-vacancy-tile__item-label">Experience Level</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Not Applicable</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-employment attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-employment-label attrax-vacancy-tile__item-label">Employment</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Permanent</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Hyderabad</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-role-type attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-role-type-label attrax-vacancy-tile__item-label">Role Type</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Hybrid</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-schedule attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-schedule-label attrax-vacancy-tile__item-label">Schedule</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Full Time</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-department attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-department-label attrax-vacancy-tile__item-label">Department</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Product Development</p></div>
        </div>
        <div class="attrax-vacancy-tile__description attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__description-label attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__description-value attrax-vacancy-tile__item-value">Explore emerging technologies, products, and patterns; run proof of concepts and help assess suitability for enterprise adoption.Translate business challenges into clear technical approaches, consider</p>
        </div>
        <div class="attrax-vacancy-tile__reference attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__reference-label attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__reference-value attrax-vacancy-tile__item-value">a56c8e18-6f49-4ccb-98b6-8b674ba483e1</p>
        </div>
        <div class="attrax-vacancy-tile__expiry attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__expiry-label attrax-vacancy-tile__item-label">Expiry Date</p>
          <p class="attrax-vacancy-tile__expiry-value attrax-vacancy-tile__item-value">01/01/0001</p>
        </div>
      </div>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--new-york attrax-vacancy-tile--united-states-of-america" data-jobid="7001">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/senior-manager-in-new-york-united-states-jid-7001">Senior Manager</a>
        <div class="attrax-vacancy-tile__location-freetext attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">New York, United States</p>
        </div>
      </div>
    </div>
    <div class="attrax-pagination__container">
      <a href="javascript:pagination(1)">1</a>
      <a href="javascript:pagination(2)">2</a>
      <a href="javascript:pagination(25)">25</a>
    </div>
  </body>
</html>
`

const secondJobsPageHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Search Jobs | Experian</title>
    <link rel="canonical" href="https://jobs.experian.com/jobs" />
  </head>
  <body class="page-job-results">
    <nav aria-label="Main navigation">
      <a href="/jobs">Search Jobs Home</a>
      <a href="https://www.experian.com/careers">Global Careers</a>
    </nav>
    <div id="jobfilters" class="Horizontal search-filters-widget__filter-list">
      <li class="filter-option has-child-elements" data-option-id="422">
        <span class="filter-contents" role="checkbox" aria-label="India" aria-checked="false" tabindex="0">
          <span class="filter-text">India</span><span class="filter-count">(38)</span>
        </span>
      </li>
    </div>
    <div class="attrax-pagination__results-count">
      <span class="attrax-pagination__total-results-hero">369 Jobs</span>
      <span class="attrax-pagination__total-results-pagination"><strong>369</strong> roles available</span>
    </div>
    <div class="attrax-list-widget__list attrax-list-widget__list--has-items">
      <div class="attrax-vacancy-tile sector-analytics attrax-vacancy-tile--mumbai attrax-vacancy-tile--india attrax-vacancy-tile--permanent attrax-vacancy-tile--hybrid attrax-vacancy-tile--full-time attrax-vacancy-tile--experian attrax-vacancy-tile--no attrax-vacancy-tile--not-applicable attrax-vacancy-tile--no-author" data-jobid="5192">
        <a aria-level="3" class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/analytics-consultant-in-mumbai-india-jid-5192" role="heading" tabindex="0">Analytics Consultant</a>
        <div class="attrax-vacancy-tile__location-freetext attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__item-label">Location</p>
          <p class="attrax-vacancy-tile__item-value">Mumbai, India</p>
        </div>
        <div class="attrax-vacancy-tile__option-experience-level attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-experience-level-label attrax-vacancy-tile__item-label">Experience Level</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Not Applicable</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-employment attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-employment-label attrax-vacancy-tile__item-label">Employment</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Permanent</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Mumbai</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-role-type attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-role-type-label attrax-vacancy-tile__item-label">Role Type</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Hybrid</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-schedule attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-schedule-label attrax-vacancy-tile__item-label">Schedule</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Full Time</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-department attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-department-label attrax-vacancy-tile__item-label">Department</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Analytics</p></div>
        </div>
        <div class="attrax-vacancy-tile__description attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__description-label attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__description-value attrax-vacancy-tile__item-value">Partner with clients to turn data into decisions and translate analytical findings into usable product and risk actions.</p>
        </div>
        <div class="attrax-vacancy-tile__reference attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__reference-label attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__reference-value attrax-vacancy-tile__item-value">c06e3189-7d8d-49cf-9dd6-37e459e65042</p>
        </div>
      </div>
    </div>
    <div class="attrax-pagination__container">
      <a href="javascript:pagination(1)">1</a>
      <a href="javascript:pagination(2)">2</a>
      <a href="javascript:pagination(25)">25</a>
    </div>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Product Manager job in Mumbai, India | Experian</title>
  </head>
  <body class="page-job-details">
    <div class="vacancy-options-widget" data-type="VacancyOptionsWidget">
      <ol>
        <li class="Location-wrapper">
          <label class="Location">Location</label>
          Mumbai
        </li>
        <li class="Department-wrapper">
          <label class="Department">Department</label>
          Product Management
        </li>
        <li class="Employment-wrapper">
          <label class="Employment">Employment</label>
          Permanent
        </li>
        <li class="RoleType-wrapper">
          <label class="RoleType">Role Type</label>
          Hybrid
        </li>
        <li class="Schedule-wrapper">
          <label class="Schedule">Schedule</label>
          Full Time
        </li>
      </ol>
    </div>
    <div class="vacancy-buttons-widget">
      <a class="jobApplyBtn btn btn-default" href="/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&amp;vacancyId=3726" rel="nofollow">Apply</a>
    </div>
    <div class="cop-widget dynamic-widget description-widget" data-type="DescriptionWidget">
      <div aria-label="Job description">
        <br/><div class='jobad-jobdescription'>Role Overview</div><br/>
        <p>Experian is looking for smart product management professionals to be a part of our Credit Services business. In the role of Product Manager, you will be responsible for understanding existing solutions and helping market those.</p>
        <p><strong>What you&apos;ll need to bring to the party</strong></p>
        <ul>
          <li>Work on existing solutions and provide regular training to the sales teams.</li>
          <li>Review and upgrade existing products when necessary.</li>
          <li>Work on new product design and align with Technology, Legal, Compliance, Marketing and support teams.</li>
          <li>Extensive reporting and trend analysis of the lending market.</li>
        </ul>
        <br/><div class='jobad-qualifications'>Experience and Skills</div><br/>
        <ul>
          <li>MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry</li>
          <li>Experience of working closely with Business or Credit Risk teams of a Bank/NBFC and supporting the function with data led solutions</li>
          <li>A business insights mindset with hands on experience using data to solve business objectives</li>
          <li>Experience with Business Analytics Unit of a Bank/NBFC will be relevant</li>
          <li>Added advantage if you are well versed with BI tools like Tableau, Qlik etc.</li>
          <li>An understanding of credit scores as a developer and/or user will be relevant</li>
          <li>Should have good comprehension skills, ability to multi-task and excellent presentation skills</li>
        </ul>
        <br/><div class='jobad-companydescription'>About Experian</div><br/>
        <p>Experian unlocks the power of data to create opportunities for consumers, businesses and society.</p>
        <p>Role Location: Mumbai</p>
        <p><strong>Experian will never ask candidates to make any payment</strong> as part of the recruitment process.</p>
        <p><a href="https://www.experian.com/careers/" rel="noopener noreferrer">Find out what its like to work for Experian by clicking here</a></p>
      </div>
    </div>
  </body>
</html>
`

const loadExperianIndiaModule = async () => {
  try {
    return await import('../../scraper/experianindia/script.js')
  } catch {
    assert.fail('Expected Experian India scraper module at ../../scraper/experianindia/script.js')
  }
}

test('Experian India helpers stay pinned to the verified company-owned jobs and detail page contracts', async () => {
  const experianIndia = await loadExperianIndiaModule()

  assert.equal(experianIndia.SOURCE, 'experianindia')
  assert.equal(experianIndia.COMPANY_NAME, 'Experian India')
  assert.equal(experianIndia.OFFICIAL_BRAND_NAME, 'Experian')
  assert.equal(experianIndia.VERIFIED_AT, '2026-07-15')
  assert.equal(experianIndia.HOMEPAGE_URL, 'https://www.experian.com/')
  assert.equal(experianIndia.GLOBAL_CAREERS_URL, 'https://www.experian.com/careers')
  assert.equal(experianIndia.JOBS_PAGE_URL, 'https://jobs.experian.com/jobs')
  assert.equal(
    experianIndia.VERIFIED_JOB_URL,
    'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
  )
  assert.equal(
    experianIndia.VERIFIED_APPLY_URL,
    'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726',
  )
  assert.equal(experianIndia.INDIA_LOCATION_FILTER_ID, '422')
  assert.equal(experianIndia.VERIFIED_INDIA_LOCATION_COUNT, 38)
  assert.equal(experianIndia.VERIFIED_TOTAL_JOBS_COUNT, 369)
  assert.equal(experianIndia.buildJobsPageUrl(1), 'https://jobs.experian.com/jobs')
  assert.equal(experianIndia.buildJobsPageUrl(2), 'https://jobs.experian.com/jobs?page=2')
  assert.equal(experianIndia.hasOfficialJobsPageSignal(firstJobsPageHtml), true)
  assert.equal(experianIndia.hasOfficialDetailPageSignal(detailPageHtml), true)
  assert.deepEqual(experianIndia.extractIndiaLocationFilter(firstJobsPageHtml), { id: '422', count: 38 })
  assert.equal(experianIndia.extractTotalResults(firstJobsPageHtml), 369)
  assert.equal(experianIndia.extractTotalPages(firstJobsPageHtml), 25)
})

test('Experian India extracts only India Attrax vacancies and normalizes shared scraper fields', async () => {
  const experianIndia = await loadExperianIndiaModule()

  assert.deepEqual(experianIndia.extractSearchResults(firstJobsPageHtml), [
    {
      title: 'Product Manager',
      company: 'Experian India',
      department: 'Product Management',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '3726',
      requisitionId: '54028518-b255-4252-b2af-0edd3058acbc',
      sourceUrl: 'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
      applyUrl: 'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
      employmentType: 'Permanent',
      experienceRequired: 'Mid-Senior Level',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Experian is looking for smart product management professionals to be a part of our Credit Services business. In the role of Product Manager, you will be responsible for understanding existing solution',
    },
    {
      title: 'Agentic AI Engineer',
      company: 'Experian India',
      department: 'Product Development',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '5055',
      requisitionId: 'a56c8e18-6f49-4ccb-98b6-8b674ba483e1',
      sourceUrl: 'https://jobs.experian.com/job/agentic-ai-engineer-in-hyderabad-india-jid-5055',
      applyUrl: 'https://jobs.experian.com/job/agentic-ai-engineer-in-hyderabad-india-jid-5055',
      employmentType: 'Permanent',
      experienceRequired: 'Not Applicable',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Explore emerging technologies, products, and patterns; run proof of concepts and help assess suitability for enterprise adoption.Translate business challenges into clear technical approaches, consider',
    },
  ])

  const [pageTwoJob] = experianIndia.extractSearchResults(secondJobsPageHtml)
  assert.equal(pageTwoJob.jobId, '5192')
  assert.equal(pageTwoJob.title, 'Analytics Consultant')
  assert.equal(pageTwoJob.location, 'Mumbai, India')
  assert.equal(pageTwoJob.department, 'Analytics')
  assert.equal(pageTwoJob.employmentType, 'Permanent')
})

test('extractJobDetail enriches Experian India detail pages with workflow apply links and qualification fields', async () => {
  const experianIndia = await loadExperianIndiaModule()
  const [listing] = experianIndia.extractSearchResults(firstJobsPageHtml)

  const job = experianIndia.extractJobDetail(detailPageHtml, listing)

  assert.deepEqual(job, {
    ...listing,
    applyUrl: 'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726',
    minimumQualification:
      'MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry',
    requiredSkills: [
      'MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry',
      'Experience of working closely with Business or Credit Risk teams of a Bank/NBFC and supporting the function with data led solutions',
      'A business insights mindset with hands on experience using data to solve business objectives',
      'Experience with Business Analytics Unit of a Bank/NBFC will be relevant',
      'Added advantage if you are well versed with BI tools like Tableau, Qlik etc.',
      'An understanding of credit scores as a developer and/or user will be relevant',
      'Should have good comprehension skills, ability to multi-task and excellent presentation skills',
    ],
    jobDescription:
      "Role Overview Experian is looking for smart product management professionals to be a part of our Credit Services business. In the role of Product Manager, you will be responsible for understanding existing solutions and helping market those. What you'll need to bring to the party Work on existing solutions and provide regular training to the sales teams. Review and upgrade existing products when necessary. Work on new product design and align with Technology, Legal, Compliance, Marketing and support teams. Extensive reporting and trend analysis of the lending market. Experience and Skills MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry Experience of working closely with Business or Credit Risk teams of a Bank/NBFC and supporting the function with data led solutions A business insights mindset with hands on experience using data to solve business objectives Experience with Business Analytics Unit of a Bank/NBFC will be relevant Added advantage if you are well versed with BI tools like Tableau, Qlik etc. An understanding of credit scores as a developer and/or user will be relevant Should have good comprehension skills, ability to multi-task and excellent presentation skills About Experian Experian unlocks the power of data to create opportunities for consumers, businesses and society. Role Location: Mumbai Experian will never ask candidates to make any payment as part of the recruitment process. Find out what its like to work for Experian by clicking here",
  })
})

test('run verifies the Experian India jobs surface, crawls paginated India listings, and enriches detail pages', async () => {
  const experianIndia = await loadExperianIndiaModule()
  const requestedUrls = []

  const secondDetailPageHtml = detailPageHtml
    .replaceAll('Product Manager', 'Analytics Consultant')
    .replaceAll('product-manager', 'analytics-consultant')
    .replaceAll('3726', '5192')
    .replaceAll('Mumbai, India', 'Mumbai, India')
    .replaceAll('Product Management', 'Analytics')
    .replace('https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726', 'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=5192')
    .replace('Experian is looking for smart product management professionals to be a part of our Credit Services business. In the role of Product Manager, you will be responsible for understanding existing solutions and helping market those.', 'Partner with clients to turn data into decisions and translate analytical findings into usable product and risk actions.')
    .replace('Work on existing solutions and provide regular training to the sales teams.', 'Translate analytical findings into clear commercial and product recommendations.')
    .replace('Review and upgrade existing products when necessary.', 'Design analytical approaches that align with business and risk objectives.')
    .replace('Work on new product design and align with Technology, Legal, Compliance, Marketing and support teams.', 'Collaborate across product, analytics, and stakeholder teams to land measurable outcomes.')
    .replace('Extensive reporting and trend analysis of the lending market.', 'Communicate trends, opportunities, and actions to internal and client audiences.')
    .replace(
      'MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry',
      'Strong analytical foundation with experience in client-facing analytics or consulting roles',
    )
    .replace(
      'Experience of working closely with Business or Credit Risk teams of a Bank/NBFC and supporting the function with data led solutions',
      'Experience partnering with business stakeholders and translating needs into analytical workstreams',
    )
    .replace(
      'A business insights mindset with hands on experience using data to solve business objectives',
      'Hands on experience using data to solve business objectives',
    )
    .replace(
      'Experience with Business Analytics Unit of a Bank/NBFC will be relevant',
      'Experience with financial services analytics programs is helpful',
    )
    .replace(
      'Added advantage if you are well versed with BI tools like Tableau, Qlik etc.',
      'Comfort with BI tools such as Tableau or Qlik is a plus',
    )
    .replace(
      'An understanding of credit scores as a developer and/or user will be relevant',
      'Understanding of credit and risk analytics is useful',
    )
    .replace(
      'Should have good comprehension skills, ability to multi-task and excellent presentation skills',
      'Strong communication and presentation skills are required',
    )

  const jobs = await experianIndia.createExperianIndiaScraper({
    maxPages: 2,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === experianIndia.JOBS_PAGE_URL) return firstJobsPageHtml
      if (url === experianIndia.buildJobsPageUrl(2)) return secondJobsPageHtml
      if (url === experianIndia.VERIFIED_JOB_URL) return detailPageHtml
      if (url === 'https://jobs.experian.com/job/agentic-ai-engineer-in-hyderabad-india-jid-5055') {
        return detailPageHtml
          .replaceAll('Product Manager', 'Agentic AI Engineer')
          .replaceAll('product-manager', 'agentic-ai-engineer')
          .replaceAll('3726', '5055')
          .replaceAll('Mumbai', 'Hyderabad')
          .replaceAll('Product Management', 'Product Development')
          .replace('MBA from reputed institute / MA Economics with 4-7 years of experience in the banking and financial services industry', 'Strong software engineering background with experience in AI platforms and product delivery')
      }
      if (url === 'https://jobs.experian.com/job/analytics-consultant-in-mumbai-india-jid-5192') return secondDetailPageHtml

      throw new Error(`Unexpected Experian India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://jobs.experian.com/jobs',
    'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
    'https://jobs.experian.com/job/agentic-ai-engineer-in-hyderabad-india-jid-5055',
    'https://jobs.experian.com/jobs?page=2',
    'https://jobs.experian.com/job/analytics-consultant-in-mumbai-india-jid-5192',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'experianindia')
  assert.equal(jobs[0].company, 'Experian India')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(
    jobs[2].applyUrl,
    'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=5192',
  )
})

test('run fails closed when the verified Experian India jobs page contract drifts materially', async () => {
  const experianIndia = await loadExperianIndiaModule()

  await assert.rejects(
    experianIndia.createExperianIndiaScraper().run({
      fetchText: async () => firstJobsPageHtml.replace('https://www.experian.com/careers', 'https://example.com/careers'),
    }),
    /verified jobs page|trusted first-party Attrax surface|India location filter/i,
  )
})
