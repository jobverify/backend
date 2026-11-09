import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'
const OFFICIAL_CAREERS_PAGE_URL = 'https://careers.expleo.com/en/'
const INDIA_JOBS_ROOT_URL = 'https://expleo-jobs-in-en.icims.com/'
const SEARCH_WRAPPER_URL = 'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793'
const SEARCH_IFRAME_URL = 'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793&in_iframe=1'
const SEARCH_PAGE_URL_PAGE_2 = 'https://expleo-jobs-in-en.icims.com/jobs/search?pr=1&in_iframe=1'
const DETAIL_URL = 'https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job'
const DETAIL_FETCH_URL = `${DETAIL_URL}?in_iframe=1`
const APPLY_URL = 'https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job?apply=yes&hashed=-336148331&mode=apply'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Expleo | Career : Grow Your Skills and Potential</title>
    <meta
      name="description"
      content="We're a game-changer network and talent incubator, valuing personality as much as technical skills. Our motto: Think bold, act reliable."
    />
    <link rel="canonical" href="https://careers.expleo.com/en/" />
  </head>
  <body>
    <nav>
      <button aria-label="Find jobs">Find jobs</button>
    </nav>
    <main>
      <h2>Search jobs in your country</h2>
      <ul>
        <li><a href="https://expleo-jobs-in-en.icims.com/" target="_blank">India</a></li>
        <li><a href="https://expleo-jobs-fr-fr.icims.com/" target="_blank">France</a></li>
      </ul>
      <section>
        <h2>Everything you are. <br>Anything you want to be.</h2>
      </section>
    </main>
  </body>
</html>
`

const searchWrapperHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>ICIMS</title>
  </head>
  <body>
    <header class="header">
      <div class="nav-item"><a href="javascript:void(0)">FIND JOBS</a></div>
      <div class="dropdown-list">
        <a href="https://expleo-jobs-in-en.icims.com/" target="_blank">India</a>
      </div>
    </header>
    <script type="text/javascript">
      icimsAddOnload(function() {
        var icimsFrame = document.createElement('iframe');
        icimsFrame.id = 'icims_content_iframe';
        icimsFrame.name = 'icims_content_iframe';
        icimsFrame.src = 'https:\\/\\/expleo-jobs-in-en.icims.com\\/jobs\\/search?hashed=-435712793&in_iframe=1';
      });
    </script>
  </body>
</html>
`

const listingPageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Listings at Expleo</title>
    <meta
      name="description"
      content="Find your next role. Explore current positions at Expleo across all categories and locations. See a position you like? Contact us and apply today!"
    />
    <link rel="canonical" href="https://expleo-jobs-in-en.icims.com/jobs/search" />
    <link rel="next" href="https://expleo-jobs-in-en.icims.com/jobs/search?pr=1&amp;in_iframe=1" />
  </head>
  <body>
    <label for="jsb_f_location_s">Location</label>
    <select id="jsb_f_location_s" name="searchLocation">
      <option value="13228-13245-Bangalore">IN-KA-Bangalore</option>
      <option value="13228-13248-Pune">IN-MH-Pune</option>
      <option value="13228-13259-Chennai">IN-TN-Chennai</option>
    </select>

    <ul class="container-fluid iCIMS_JobsTable">
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-6 header right">
            <span class="sr-only field-label">Job Post Information* : Posted Date</span>
            <span title="7/14/2026 2:50 AM">19 hours ago<span class="sr-only">(7/14/2026 2:50 AM)</span></span>
          </div>
          <div class="col-xs-12 title">
            <a
              href="https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job?in_iframe=1"
              class="iCIMS_Anchor"
              title="54246 - CAE Modeller"
            >
              <span class="sr-only field-label">Title</span>
              <h3>CAE Modeller</h3>
            </a>
          </div>
          <div class="col-xs-12 description">
            CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )
          </div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>IN-TN-Chennai</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job area</dt>
                <dd class="iCIMS_JobHeaderData"><span>Engineers &amp; Technicians</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Employment type</dt>
                <dd class="iCIMS_JobHeaderData"><span>Permanent</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Industry</dt>
                <dd class="iCIMS_JobHeaderData"><span>Automotive</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Workplace</dt>
                <dd class="iCIMS_JobHeaderData"><span>On-Site</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-54246</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>

      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-6 header right">
            <span class="sr-only field-label">Job Post Information* : Posted Date</span>
            <span title="7/14/2026 2:20 AM">20 hours ago<span class="sr-only">(7/14/2026 2:20 AM)</span></span>
          </div>
          <div class="col-xs-12 title">
            <a
              href="https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?in_iframe=1"
              class="iCIMS_Anchor"
              title="54134 - ETL tester"
            >
              <span class="sr-only field-label">Title</span>
              <h3>ETL tester</h3>
            </a>
          </div>
          <div class="col-xs-12 description">
            Strong ETL testing experience with banking data validation and SQL.
          </div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>IN-KA-Bangalore</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job area</dt>
                <dd class="iCIMS_JobHeaderData"><span>IT &amp; Digital</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Employment type</dt>
                <dd class="iCIMS_JobHeaderData"><span>Permanent</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Industry</dt>
                <dd class="iCIMS_JobHeaderData"><span>Banking &amp; Financial Services</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Workplace</dt>
                <dd class="iCIMS_JobHeaderData"><span>Hybrid</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-54134</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </body>
</html>
`

const listingPageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Listings at Expleo</title>
    <meta
      name="description"
      content="Find your next role. Explore current positions at Expleo across all categories and locations. See a position you like? Contact us and apply today!"
    />
    <link rel="canonical" href="https://expleo-jobs-in-en.icims.com/jobs/search?pr=1" />
    <link rel="prev" href="https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793&amp;in_iframe=1" />
  </head>
  <body>
    <ul class="container-fluid iCIMS_JobsTable">
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-6 header right">
            <span class="sr-only field-label">Job Post Information* : Posted Date</span>
            <span title="7/2/2026 4:49 AM">2 weeks ago<span class="sr-only">(7/2/2026 4:49 AM)</span></span>
          </div>
          <div class="col-xs-12 title">
            <a
              href="https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job?in_iframe=1"
              class="iCIMS_Anchor"
              title="53470 - Project Lead"
            >
              <span class="sr-only field-label">Title</span>
              <h3>Project Lead</h3>
            </a>
          </div>
          <div class="col-xs-12 description">
            Lead cross-functional project delivery for automotive engineering workstreams.
          </div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>IN-MH-Pune</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job area</dt>
                <dd class="iCIMS_JobHeaderData"><span>Engineers &amp; Technicians</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Employment type</dt>
                <dd class="iCIMS_JobHeaderData"><span>Permanent</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Industry</dt>
                <dd class="iCIMS_JobHeaderData"><span>Automotive</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Workplace</dt>
                <dd class="iCIMS_JobHeaderData"><span>Hybrid</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-53470</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CAE Modeller in Chennai, Tamil Nadu | Careers at Chennai II, TN, India</title>
    <meta
      name="description"
      content="Chennai II, TN, India is now hiring a CAE Modeller in Chennai, Tamil Nadu."
    />
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "CAE Modeller",
        "employmentType": "FULL_TIME",
        "datePosted": "2026-07-14T04:00:00.000Z",
        "description": "<h2>Overview</h2><p>CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )</p><h2>Responsibilities</h2><p><strong>Key Responsibilities:</strong></p><ul><li>Proficient to build crash model</li><li>Proficient to mesh all kind of parts</li><li>Proficient to create connections and contacts by using LS-Dyna</li></ul><h2>Qualifications</h2><p>Bachelor’s/ Master’s Degree in Engineering in Mechanical / Automobile Engineering.</p><h2>Essential skills</h2><p><strong>Required Skills:</strong></p><ul><li>Strong hands-on experience in LS-DYNA</li><li>Familiarity with pre/post tools like ANSA, Meta Post, Animator</li></ul><h2>Experience</h2><p>3 to 8 Years in OEM and Tier 1 Automotive</p>"
      }
    </script>
  </head>
  <body>
    <div class="iCIMS_profilePicture">
      <div class="iCIMS_userMenuName">Returning candidate?</div>
      <div class="iCIMS_userMenuLink">
        <a href="https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/login?loginOnly=1&amp;redirect=job&amp;in_iframe=1&amp;hashed=-435712793">Log back in!</a>
      </div>
    </div>

    <div class="iCIMS_JobContainer">
      <div class="iCIMS_JobContent">
        <div class="container-fluid iCIMS_JobsTable">
          <div class="row">
            <div class="col-xs-12 title">
              <div id="iCIMS_Header" tabindex="-1">
                <h1 class="iCIMS_Header">CAE Modeller</h1>
              </div>
            </div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                  <dd class="iCIMS_JobHeaderData"><span>IN-TN-Chennai</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Job area</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Engineers &amp; Technicians</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Employment type</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Permanent</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Industry</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Automotive</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Workplace</dt>
                  <dd class="iCIMS_JobHeaderData"><span>On-Site</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">ID</dt>
                  <dd class="iCIMS_JobHeaderData"><span>2026-54246</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div class="iCIMS_JobOptions">
          <h2 class="iCIMS_SubHeader iCIMS_SubHeader_Job">Options</h2>
          <div id="jobOptionsMobile" class="iCIMS_JobOptionsMobile iCIMS_JobOptionsMobile_Options3">
            <a
              href="https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job?mode=apply&amp;apply=yes&amp;in_iframe=1&amp;hashed=-336148331"
              class="iCIMS_Anchor iCIMS_Action_Button iCIMS_ApplyOnlineButton iCIMS_PrimaryButton"
              title="Apply now"
            >
              <div class="iCIMS_Action_ButtonText"><span class="iCIMS_LongLabel">Apply now</span></div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadExpleoModule = async () => {
  try {
    return await import('../../scraper/expleo/script.js')
  } catch {
    assert.fail('Expected Expleo scraper module at ../../scraper/expleo/script.js')
  }
}

test('Expleo helpers stay pinned to the verified first-party careers and India iCIMS handoff surfaces', async () => {
  const expleo = await loadExpleoModule()

  assert.equal(expleo.SOURCE, 'expleo')
  assert.equal(expleo.COMPANY, 'Expleo')
  assert.equal(expleo.OFFICIAL_BRAND_NAME, 'Expleo')
  assert.equal(expleo.VERIFIED_ON, '2026-08-02')
  assert.equal(expleo.OFFICIAL_CAREERS_PAGE_URL, OFFICIAL_CAREERS_PAGE_URL)
  assert.equal(expleo.INDIA_JOBS_ROOT_URL, INDIA_JOBS_ROOT_URL)
  assert.equal(expleo.SEARCH_WRAPPER_URL, SEARCH_WRAPPER_URL)
  assert.equal(expleo.SEARCH_IFRAME_URL, SEARCH_IFRAME_URL)
  assert.equal(expleo.ICIMS_USER_AGENT, 'Mozilla/5.0')
  assert.doesNotMatch(expleo.ICIMS_USER_AGENT, /Chrome|Safari|Windows NT/i)
  assert.equal(expleo.buildSearchUrl(), SEARCH_IFRAME_URL)
  assert.equal(expleo.buildSearchUrl(1), SEARCH_PAGE_URL_PAGE_2)
  assert.equal(
    expleo.buildDetailUrl({ jobId: '54246', slug: 'cae-modeller' }),
    DETAIL_URL,
  )
  assert.equal(
    expleo.buildDetailFetchUrl({ jobId: '54246', slug: 'cae-modeller' }),
    DETAIL_FETCH_URL,
  )
  assert.equal(expleo.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(
    expleo.extractIndiaJobsRootUrl(officialCareersHtml),
    INDIA_JOBS_ROOT_URL,
  )
  assert.equal(expleo.hasOfficialSearchWrapperSignal(searchWrapperHtml), true)
  assert.equal(
    expleo.extractSearchIframeUrl(searchWrapperHtml),
    SEARCH_IFRAME_URL,
  )
  assert.equal(expleo.hasOfficialListingsPageSignal(listingPageOneHtml), true)
  assert.equal(
    expleo.extractNextPageUrl(listingPageOneHtml),
    SEARCH_PAGE_URL_PAGE_2,
  )
})

test('extractJobCards normalizes India Expleo iCIMS listing cards from the verified iframe search surface', async () => {
  const expleo = await loadExpleoModule()
  const jobs = expleo.extractJobCards(listingPageOneHtml)

  assert.deepEqual(jobs, [
    {
      title: 'CAE Modeller',
      company: 'Expleo',
      department: 'Engineers & Technicians',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: '54246',
      requisitionId: '2026-54246',
      sourceUrl: DETAIL_URL,
      applyUrl: DETAIL_URL,
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )',
      remoteStatus: 'On-Site',
    },
    {
      title: 'ETL tester',
      company: 'Expleo',
      department: 'IT & Digital',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '54134',
      requisitionId: '2026-54134',
      sourceUrl: 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job',
      applyUrl: 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Strong ETL testing experience with banking data validation and SQL.',
      remoteStatus: 'Hybrid',
    },
  ])
})

test('extractJobDetail reads Expleo iCIMS detail metadata, JSON-LD description, and canonical apply URL', async () => {
  const expleo = await loadExpleoModule()
  const detail = expleo.extractJobDetail(detailHtml, {
    title: 'CAE Modeller',
    company: 'Expleo',
    department: 'Engineers & Technicians',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '54246',
    requisitionId: '2026-54246',
    sourceUrl: DETAIL_URL,
    applyUrl: DETAIL_URL,
    employmentType: 'Permanent',
    jobDescription: 'CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )',
    remoteStatus: 'On-Site',
  })

  assert.deepEqual(detail, {
    title: 'CAE Modeller',
    company: 'Expleo',
    department: 'Engineers & Technicians',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '54246',
    requisitionId: '2026-54246',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Permanent',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Bachelor’s/ Master’s Degree in Engineering in Mechanical / Automobile Engineering.',
      'Strong hands-on experience in LS-DYNA',
      'Familiarity with pre/post tools like ANSA, Meta Post, Animator',
    ],
    postingDate: '2026-07-14T04:00:00.000Z',
    closingDate: null,
    jobDescription: 'CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post ) Key Responsibilities: Proficient to build crash model Proficient to mesh all kind of parts Proficient to create connections and contacts by using LS-Dyna Bachelor’s/ Master’s Degree in Engineering in Mechanical / Automobile Engineering. Required Skills: Strong hands-on experience in LS-DYNA Familiarity with pre/post tools like ANSA, Meta Post, Animator 3 to 8 Years in OEM and Tier 1 Automotive',
    remoteStatus: 'On-Site',
  })
})

test('run validates the verified Expleo careers handoff, paginates the India iCIMS iframe listings, and decorates jobs', async () => {
  const expleo = await loadExpleoModule()
  const requestedUrls = []

  const jobs = await expleo.createExpleoScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === OFFICIAL_CAREERS_PAGE_URL) return officialCareersHtml
      if (url === SEARCH_WRAPPER_URL) return searchWrapperHtml
      if (url === SEARCH_IFRAME_URL) return listingPageOneHtml
      if (url === SEARCH_PAGE_URL_PAGE_2) return listingPageTwoHtml
      if (url === DETAIL_FETCH_URL) return detailHtml
      if (url === 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?in_iframe=1') {
        return detailHtml
          .replaceAll('CAE Modeller', 'ETL tester')
          .replaceAll('2026-54246', '2026-54134')
          .replaceAll('IN-TN-Chennai', 'IN-KA-Bangalore')
          .replaceAll('Engineers &amp; Technicians', 'IT &amp; Digital')
          .replaceAll('Permanent', 'Permanent')
          .replaceAll('On-Site', 'Hybrid')
          .replaceAll('https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/', 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/')
          .replaceAll('hashed=-336148331', 'hashed=-229991100')
          .replaceAll(
            'CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )',
            'Strong ETL testing experience with banking data validation and SQL.',
          )
          .replaceAll(
            'Bachelor’s/ Master’s Degree in Engineering in Mechanical / Automobile Engineering.',
            'Bachelor’s degree in Computer Science or related field.',
          )
          .replaceAll(
            'Strong hands-on experience in LS-DYNA',
            'Strong ETL testing and SQL validation experience',
          )
          .replaceAll(
            'Familiarity with pre/post tools like ANSA, Meta Post, Animator',
            'Knowledge of data warehousing and reconciliation workflows',
          )
          .replaceAll(
            '3 to 8 Years in OEM and Tier 1 Automotive',
            '4 to 8 Years in banking data transformation programs',
          )
          .replaceAll('2026-07-14T04:00:00.000Z', '2026-07-14T02:20:00.000Z')
      }
      if (url === 'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job?in_iframe=1') {
        return detailHtml
          .replaceAll('CAE Modeller', 'Project Lead')
          .replaceAll('2026-54246', '2026-53470')
          .replaceAll('IN-TN-Chennai', 'IN-MH-Pune')
          .replaceAll('https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/', 'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/')
          .replaceAll('hashed=-336148331', 'hashed=-101010101')
          .replaceAll(
            'CAE Modeller for Crash/NVH Integration (ANSA - LS-DYNA / LS-Prepost / Meta Post )',
            'Lead cross-functional project delivery for automotive engineering workstreams.',
          )
          .replaceAll(
            'Strong hands-on experience in LS-DYNA',
            'Hands-on project planning and risk management experience',
          )
          .replaceAll(
            'Familiarity with pre/post tools like ANSA, Meta Post, Animator',
            'Strong stakeholder communication across engineering teams',
          )
          .replaceAll(
            '3 to 8 Years in OEM and Tier 1 Automotive',
            '8+ Years delivering complex automotive engineering programs',
          )
          .replaceAll('On-Site', 'Hybrid')
          .replaceAll('2026-07-14T04:00:00.000Z', '2026-07-02T04:49:00.000Z')
      }
      throw new Error(`Unexpected Expleo fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    OFFICIAL_CAREERS_PAGE_URL,
    SEARCH_WRAPPER_URL,
    SEARCH_IFRAME_URL,
    DETAIL_FETCH_URL,
    'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?in_iframe=1',
    SEARCH_PAGE_URL_PAGE_2,
    'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job?in_iframe=1',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'CAE Modeller',
        location: 'Chennai, India',
        city: 'Chennai',
        jobId: '54246',
        sourceUrl: DETAIL_URL,
        applyUrl: APPLY_URL,
        source: 'expleo',
        link: APPLY_URL,
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'ETL tester',
        location: 'Bangalore, India',
        city: 'Bangalore',
        jobId: '54134',
        sourceUrl: 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job',
        applyUrl: 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?apply=yes&hashed=-229991100&mode=apply',
        source: 'expleo',
        link: 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?apply=yes&hashed=-229991100&mode=apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Project Lead',
        location: 'Pune, India',
        city: 'Pune',
        jobId: '53470',
        sourceUrl: 'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job',
        applyUrl: 'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job?apply=yes&hashed=-101010101&mode=apply',
        source: 'expleo',
        link: 'https://expleo-jobs-in-en.icims.com/jobs/53470/project-lead/job?apply=yes&hashed=-101010101&mode=apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('run fails closed when the Expleo first-party careers page, wrapper handoff, iframe listings page, or detail contract drift', async () => {
  const expleo = await loadExpleoModule()

  await assert.rejects(
    expleo.createExpleoScraper().run({
      fetchText: async (url) => {
        if (url === OFFICIAL_CAREERS_PAGE_URL) {
          return officialCareersHtml.replace('Search jobs in your country', 'Search opportunities')
        }
        throw new Error(`Unexpected Expleo fixture URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    expleo.createExpleoScraper().run({
      fetchText: async (url) => {
        if (url === OFFICIAL_CAREERS_PAGE_URL) return officialCareersHtml
        if (url === SEARCH_WRAPPER_URL) {
          return searchWrapperHtml.replace(
            'https:\\/\\/expleo-jobs-in-en.icims.com\\/jobs\\/search?hashed=-435712793&in_iframe=1',
            'https:\\/\\/expleo-jobs-in-en.icims.com\\/jobs\\/search?hashed=other&in_iframe=1',
          )
        }
        throw new Error(`Unexpected Expleo fixture URL: ${url}`)
      },
    }),
    /verified india iCIMS wrapper/i,
  )

  await assert.rejects(
    expleo.createExpleoScraper().run({
      fetchText: async (url) => {
        if (url === OFFICIAL_CAREERS_PAGE_URL) return officialCareersHtml
        if (url === SEARCH_WRAPPER_URL) return searchWrapperHtml
        if (url === SEARCH_IFRAME_URL) {
          return listingPageOneHtml.replace('container-fluid iCIMS_JobsTable', 'container-fluid JobsTable')
        }
        throw new Error(`Unexpected Expleo fixture URL: ${url}`)
      },
    }),
    /verified india iCIMS listings page/i,
  )

  await assert.rejects(
    expleo.createExpleoScraper().run({
      fetchText: async (url) => {
        if (url === OFFICIAL_CAREERS_PAGE_URL) return officialCareersHtml
        if (url === SEARCH_WRAPPER_URL) return searchWrapperHtml
        if (url === SEARCH_IFRAME_URL) return listingPageOneHtml
        if (url === DETAIL_FETCH_URL) {
          return detailHtml.replace('mode=apply&amp;apply=yes', 'mode=view')
        }
        if (url === 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/job?in_iframe=1') {
          return detailHtml.replaceAll('CAE Modeller', 'ETL tester')
            .replaceAll('2026-54246', '2026-54134')
            .replaceAll('IN-TN-Chennai', 'IN-KA-Bangalore')
            .replaceAll('https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/', 'https://expleo-jobs-in-en.icims.com/jobs/54134/etl-tester/')
        }
        throw new Error(`Unexpected Expleo fixture URL: ${url}`)
      },
    }),
    /verified Expleo iCIMS detail page/i,
  )
})
