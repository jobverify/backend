import assert from 'node:assert/strict'
import test from 'node:test'

const loadCrimsonInteractiveModule = async () => {
  try {
    return await import('../../scraper/crimsoninteractive/script.js')
  } catch (error) {
    assert.fail(
      `Expected Crimson Interactive scraper module at ../../scraper/crimsoninteractive/script.js (${error.code || error.message})`,
    )
  }
}

const opportunitiesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Strengthen your career your way with Crimson Interactive</title>
    <meta property="og:title" content="Strengthen your career your way with Crimson Interactive" />
  </head>
  <body>
    <nav>
      <ul class="main-menu">
        <li class="has-children">
          <a href="">Careers</a>
          <ul class="sub-menu">
            <li><a class="" href="opportunities.html">Opportunities</a></li>
          </ul>
        </li>
      </ul>
    </nav>
    <section class="banner-opportunity">
      <h2>Opportunities</h2>
      <p>Ample opportunities await Crimsonites!</p>
      <div class="mt-40">
        <!-- <a class="btn btn-default icon-arrow-right" href="https://crimsoniteam.freshteam.com/jobs" target="_blank">View Openings</a> -->
      </div>
    </section>
    <section class="jobsites">
      <h2>Our Openings are Available on</h2>
      <p>Openings differ from platform to platform. For opening outside India, please refer to local job sites.</p>
      <a href="https://www.naukri.com/crimson-interactive-pvt-ltd-jobs" target="_blank">Naukri</a>
      <a href="https://angel.co/company/crimson-interactive-ai/jobs" target="_blank">AngelList</a>
      <a href="https://www.iimjobs.com/" target="_blank">IIMJobs</a>
    </section>
    <section class="contact">
      <a href="mailto:joinus@crimsoni.com">joinus@crimsoni.com</a>
      <a href="mailto:expathr@crimsoni.com">expathr@crimsoni.com</a>
    </section>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html>
  <head>
    <title> Careers </title>
    <meta property="og:title" content="Careers - Crimson Interactive Inc" />
    <meta property="og:description" content="#2 Jobs - Beijing|Mumbai" />
  </head>
  <body>
    <header class="header">
      <nav class="navbar banner-title">
        <span><a href="https://crimsoniteam.freshteam.com/jobs" class="navbar-brand">Logo</a></span>
        <h4 class="brand-text">Careers</h4>
        <ul class="nav-links">
          <li><a href="https://www.crimsoni.com/">Home</a></li>
          <li><a href="https://www.crimsoni.com/life-at-crimson.htm">Life@Crimson</a></li>
          <li><a href="https://www.crimsoni.com/about-us.htm">About us</a></li>
          <li><a href="https://www.crimsoni.com/contact-us.htm">Contact us</a></li>
        </ul>
      </nav>
    </header>
    <div class="index-banner">
      <h1 class="custom"><span class="color-font-join">Join</span> <span class="color-font">Us</span></h1>
      Apply and become a Crimsonite yourself! We are always on the lookout for great talent and we have opportunities that may interest you.
    </div>
    <form class="job-search-form" action="/jobs/search" method="get">
      <select name="branch_id" id="branch_id">
        <option value="">Choose Location</option>
        <option value="4000011558">Beijing</option>
        <option value="4000004626">Mumbai</option>
      </select>
      <label class="remote-location-only">Remote jobs only</label>
    </form>
    <div class="content">
      <h3 class="page-title">Open Positions</h3>
      <div class="job-role-list">
        <ul>
          <li>
            <input type="radio" name="accordion" />
            <div class="role-title">
              <h5>
                Marketing
                <span class="mobile-role-count">- 2 Open Roles</span>
              </h5>
              <div class="role-count">2 Open Roles</div>
            </div>
            <div class="hidden-content">
              <ul class="job-list">
                <li class="heading">
                  <div class="row">
                    <div class="job-list-info">
                      <a href="/jobs/aDAPTG_8FV2U/content-writer" class="job-title">Content Writer</a>
                      <a href="/jobs/aDAPTG_8FV2U/content-writer" class="job-desc text">
                        We are a leading international company that provide language solutions to academic researchers.
                      </a>
                    </div>
                    <div class="job-location">
                      <a href="/jobs/aDAPTG_8FV2U/content-writer" class="location-info">
                        Beijing, Beijing
                        <br/>
                        Full Time
                      </a>
                    </div>
                  </div>
                </li>
                <li class="heading">
                  <div class="row">
                    <div class="job-list-info">
                      <a href="/jobs/bB3YdZU2hjig/reactjs-developer" class="job-title">ReactJS Developer</a>
                      <a href="/jobs/bB3YdZU2hjig/reactjs-developer" class="job-desc text">
                        We are looking for React JS Professionals! Technologies required:- React js &gt; 16.8 and Next.js.
                      </a>
                    </div>
                    <div class="job-location">
                      <a href="/jobs/bB3YdZU2hjig/reactjs-developer" class="location-info">
                        Mumbai, Maharashtra
                        <br/>
                        Full Time
                      </a>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const reactJsDeveloperDetailHtml = `
<!doctype html>
<html>
  <head>
    <title> Careers </title>
    <meta property="og:title" content="Hiring for ReactJS Developer for Mumbai" />
    <meta property="og:description" content="Posted by : Crimson Interactive Inc | CMS,REACTJS,HTML" />
  </head>
  <body>
    <div class="job-details">
      <div class="job-details-header" id="job-details-header">
        <div class="content">
          <a class="link-back" href="/jobs">
            <i class="icon-arrow-left"></i>Marketing
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">ReactJS Developer</h1>
              <div class="stick-hide-in-mobile text-color">
                Mumbai, Maharashtra
                &nbsp; | &nbsp; Full Time
              </div>
            </div>
            <div class="col-xs-4 pull-xs-right text-right">
              <a href="#applicant-form" class="btn btn-primary btn-custom">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <p>We are looking for React JS Professionals!</p>
        <p><strong><u>Technologies required:-</u></strong></p>
        <p>1] React js &gt; 16.8</p>
        <p>2] Next.js</p>
        <p><strong><u>Responsibilities:-</u></strong></p>
        <ul type="disc">
          <li>Developing the latest user-facing features using React.js</li>
          <li>Designing a modern highly responsive web-based user interface</li>
        </ul>
        <p><strong><u>Technical skills:-</u></strong></p>
        <ul type="disc">
          <li>Strong proficiency in JavaScript, including DOM manipulation and the JavaScript object model</li>
          <li>Thorough understanding of React.js and its core principles</li>
        </ul>
      </div>
      Liquid error: undefined method \`public_fields' for nil:NilClass
    </div>
  </body>
</html>
`

test('Crimson Interactive constants stay pinned to the verified shell page and public Freshteam board', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()

  assert.equal(crimsonInteractive.SOURCE, 'crimsoninteractive')
  assert.equal(crimsonInteractive.COMPANY, 'Crimson Interactive')
  assert.equal(crimsonInteractive.COUNTRY_FILTER, 'India')
  assert.equal(crimsonInteractive.OPPORTUNITIES_URL, 'https://www.crimsoni.com/opportunities.html')
  assert.equal(crimsonInteractive.LISTING_URL, 'https://crimsoniteam.freshteam.com/jobs')
  assert.equal(
    crimsonInteractive.DETAIL_URL_PATTERN,
    'https://crimsoniteam.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(crimsonInteractive.hasOfficialOpportunitiesSignal(opportunitiesHtml), true)
  assert.equal(crimsonInteractive.hasOfficialJobsBoardSignal(listingHtml), true)
  assert.equal(
    crimsonInteractive.buildDetailUrl('bB3YdZU2hjig', 'reactjs-developer'),
    'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer',
  )
})

test('extractListingJobs parses the direct Crimson Freshteam board and preserves job metadata', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()

  const listings = crimsonInteractive.extractListingJobs(listingHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Content Writer',
    summary: 'We are a leading international company that provide language solutions to academic researchers.',
    department: 'Marketing',
    detailUrl: 'https://crimsoniteam.freshteam.com/jobs/aDAPTG_8FV2U/content-writer',
    jobId: 'aDAPTG_8FV2U',
    requisitionId: 'aDAPTG_8FV2U',
    slug: 'content-writer',
    locationText: 'Beijing, Beijing',
    employmentType: 'Full Time',
    remoteFlag: null,
  })
  assert.deepEqual(listings[1], {
    title: 'ReactJS Developer',
    summary: 'We are looking for React JS Professionals! Technologies required:- React js > 16.8 and Next.js.',
    department: 'Marketing',
    detailUrl: 'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer',
    jobId: 'bB3YdZU2hjig',
    requisitionId: 'bB3YdZU2hjig',
    slug: 'reactjs-developer',
    locationText: 'Mumbai, Maharashtra',
    employmentType: 'Full Time',
    remoteFlag: null,
  })
})

test('isIndiaListing ignores title or summary hints when the structured Freshteam location is outside India', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()

  assert.equal(
    crimsonInteractive.isIndiaListing({
      title: 'Business Associate based out of Mumbai',
      summary: 'Work with India stakeholders',
      locationText: 'Tokyo, Tokyo',
    }),
    false,
  )
  assert.equal(
    crimsonInteractive.isIndiaListing({
      title: 'Client Servicing - Business Associate - Brazil',
      summary: 'India market experience preferred',
      locationText: 'Brazil',
    }),
    false,
  )
  assert.equal(
    crimsonInteractive.isIndiaListing({
      title: 'ReactJS Developer',
      summary: 'Build product UI',
      locationText: 'Mumbai, Maharashtra',
    }),
    true,
  )
})

test('extractJobDetail keeps the public Freshteam detail page as the apply surface and strips trailing Liquid errors', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()
  const listings = crimsonInteractive.extractListingJobs(listingHtml)
  const detail = crimsonInteractive.extractJobDetail(reactJsDeveloperDetailHtml, listings[1])

  assert.deepEqual(detail, {
    title: 'ReactJS Developer',
    company: 'Crimson Interactive',
    department: 'Marketing',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'bB3YdZU2hjig',
    requisitionId: 'bB3YdZU2hjig',
    sourceUrl: 'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer',
    applyUrl: 'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'We are looking for React JS Professionals!',
      'Technologies required:-',
      '1] React js > 16.8',
      '2] Next.js',
      'Responsibilities:-',
      'Developing the latest user-facing features using React.js',
      'Designing a modern highly responsive web-based user interface',
      'Technical skills:-',
      'Strong proficiency in JavaScript, including DOM manipulation and the JavaScript object model',
      'Thorough understanding of React.js and its core principles',
    ].join(' '),
    remoteStatus: 'On-site',
  })
  assert.doesNotMatch(detail.jobDescription, /Liquid error/i)
})

test('run validates the opportunities shell, filters the Freshteam board to India roles, and decorates jobs', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()
  const requestedUrls = []

  const jobs = await crimsonInteractive.createCrimsonInteractiveScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === crimsonInteractive.OPPORTUNITIES_URL) return opportunitiesHtml
      if (url === crimsonInteractive.LISTING_URL) return listingHtml
      if (url === 'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer') {
        return reactJsDeveloperDetailHtml
      }

      throw new Error(`Unexpected Crimson Interactive fixture URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    crimsonInteractive.OPPORTUNITIES_URL,
    crimsonInteractive.LISTING_URL,
    'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'crimsoninteractive')
  assert.equal(jobs[0].company, 'Crimson Interactive')
  assert.equal(jobs[0].jobId, 'bB3YdZU2hjig')
  assert.equal(jobs[0].link, 'https://crimsoniteam.freshteam.com/jobs/bB3YdZU2hjig/reactjs-developer')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('Crimson Interactive scraper fails closed when the verified shell or Freshteam board signatures drift', async () => {
  const crimsonInteractive = await loadCrimsonInteractiveModule()

  await assert.rejects(
    crimsonInteractive.createCrimsonInteractiveScraper().run({
      fetchText: async (url) => {
        if (url === crimsonInteractive.OPPORTUNITIES_URL) {
          return opportunitiesHtml.replace(
            'https://www.naukri.com/crimson-interactive-pvt-ltd-jobs',
            'https://example.com/jobs',
          )
        }

        throw new Error(`Unexpected Crimson Interactive fixture URL: ${url}`)
      },
    }),
    /verified opportunities shell/i,
  )

  await assert.rejects(
    crimsonInteractive.createCrimsonInteractiveScraper().run({
      fetchText: async (url) => {
        if (url === crimsonInteractive.OPPORTUNITIES_URL) return opportunitiesHtml
        if (url === crimsonInteractive.LISTING_URL) {
          return listingHtml.replace('Crimson Interactive Inc', 'Different Company')
        }

        throw new Error(`Unexpected Crimson Interactive fixture URL: ${url}`)
      },
    }),
    /verified public freshteam board/i,
  )
})
