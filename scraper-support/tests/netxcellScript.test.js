import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Next Gen Video Messaging System in India - Netxcell</title>
  </head>
  <body>
    <main>
      <h1>CAREERS</h1>
      <h3 class="jobheadding">Senior CPaaS Sales Manager / Enterprise sales Manager.</h3>
      <p class="jobcontent">
        We are looking for a seasoned Enterprise sales professional with a strong background in the
        telecom industry to drive our CPaaS sales.
        <br><i class="fa fa-map-marker" aria-hidden="true"></i>
        Hyderabad, Bangalore, Mumbai, Delhi (Preference for Local Candidates)
      </p>
      <a href="enterprise-sales-manager.php" class="">Apply</a>

      <h3 class="jobheadding">AR Calling Experience (Accounts Receivable Calling) - RCMS - Hyderabad</h3>
      <p class="jobcontent">
        Reviewing and analyzing claim form 1500 to ensure accurate billing information.
        <br><i class="fa fa-map-marker" aria-hidden="true"></i>
        Hyderabad
      </p>
      <a href="arcallingexperience.php" class="">Apply</a>

      <h3 class="jobheadding">Business Development Manager - e-Governance</h3>
      <p class="jobcontent">
        The Business Development Manager - e-Governance will play a crucial role in expanding our
        e-Governance projects.
        <br><i class="fa fa-map-marker" aria-hidden="true"></i>
        Andhra Pradesh (AP) or Telangana (TS)
      </p>
      <a href="business-development-mannager.php" class="">Apply</a>

      <h3 class="jobheadding">Linux Administrator</h3>
      <p class="jobcontent">
        The Linux Administrator will be responsible for managing and maintaining our Linux-based systems.
        <br><i class="fa fa-map-marker" aria-hidden="true"></i>
        Hyderabad
      </p>
      <a href="linux-administrator.php" class="">Apply</a>

      <footer>
        <p>Netxcell Limited, Plot# 92, 3rd Floor,Road No 2, LV Prasad Marg, Banjarahills, Hyderabad.</p>
      </footer>
    </main>
  </body>
</html>
`

const ENTERPRISE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Netxcell-Job Overview</title>
  </head>
  <body>
    <main>
      <h4 class="text-large margin-0px-bottom">
        <b class="text-deep-pink">Job Description:</b>
        Senior CPaaS Sales Manager / Enterprise sales Manager.
      </h4>
      <p class="margin-5px-bottom">
        <b class="text-deep-pink"><i class="fa fa-map-marker" aria-hidden="true"></i></b>
        Hyderabad, Bangalore, Mumbai, Delhi (Preference for Local Candidates)
      </p>
      <h4 class="text-deep-pink text-large font-weight-600 margin-0px-bottom">Position Overview:</h4>
      <p>
        We are looking for a seasoned Enterprise sales professional with a strong background in the
        telecom industry to drive our CPaaS sales.
      </p>
      <h4 class="text-deep-pink text-large font-weight-600 margin-5px-bottom">Key Responsibilities:</h4>
      <ul>
        <li>Develop and implement strategic sales plans to achieve sales targets.</li>
        <li>Identify and cultivate new business opportunities.</li>
      </ul>
      <h4 class="text-deep-pink text-large font-weight-600 margin-5px-bottom">Qualifications:</h4>
      <ul>
        <li>Bachelor's degree in a related field; MBA in Marketing is highly preferable.</li>
        <li>Minimum of 10 years of experience in CPaaS sales.</li>
      </ul>
      <h4 class="text-deep-pink text-large font-weight-600 margin-5px-bottom">Why Join Us ?</h4>
      <ul>
        <li>Opportunity to work with a leading provider of innovative communication solutions.</li>
      </ul>
      <div class="text-extra-dark-gray alt-font text-deep-pink text-large font-weight-600 margin-30px-bottom">
        Please fill the following form along with your resume to apply to Job.
      </div>
      <footer><p>Netxcell Limited</p></footer>
    </main>
  </body>
</html>
`

const AR_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Netxcell-Job Overview</title>
  </head>
  <body>
    <main>
      <h4 class="text-large margin-0px-bottom">
        <b class="text-deep-pink">Job Description:</b>
        AR Calling Experience (Accounts Receivable Calling) - RCMS
      </h4>
      <p class="margin-5px-bottom">
        <b class="text-deep-pink"><i class="fa fa-map-marker" aria-hidden="true"></i></b>
        Hyderabad
      </p>
      <h4 class="text-deep-pink text-large font-weight-600 margin-0px-bottom">Job Role:</h4>
      <ul>
        <li>Reviewing and analyzing claim form 1500 to ensure accurate billing information.</li>
        <li>Utilizing coding tools like CCI and McKesson to validate and optimize medical codes.</li>
      </ul>
      <h4 class="text-deep-pink text-large font-weight-600 margin-5px-bottom">Desired Candidate Profile:</h4>
      <ul>
        <li>Minimum of 2 years of experience in physician revenue cycle management and AR calling.</li>
        <li>Excellent communication skills.</li>
      </ul>
      <h4 class="text-deep-pink text-large font-weight-600 margin-5px-bottom">Perks and Benefits:</h4>
      <ul>
        <li>Provides Night Shift Allowance.</li>
        <li>Saturday and Sunday fixed week offs.</li>
      </ul>
      <div class="text-extra-dark-gray alt-font text-deep-pink text-large font-weight-600 margin-30px-bottom">
        Please fill the following form along with your resume to apply to Job.
      </div>
      <footer><p>Netxcell Limited</p></footer>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Roles</h1>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Platform Engineer"}
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/netxcell/script.js')
  } catch {
    assert.fail('Expected Netxcell scraper module at ../../scraper/netxcell/script.js')
  }
}

test('Netxcell helpers stay pinned to the verified first-party careers page and job detail structure', async () => {
  const netxcell = await loadModule()

  assert.equal(netxcell.SOURCE, 'netxcell')
  assert.equal(netxcell.COMPANY, 'Netxcell')
  assert.equal(netxcell.OFFICIAL_BRAND_NAME, 'Netxcell Limited')
  assert.equal(netxcell.VERIFIED_ON, '2026-07-16')
  assert.equal(netxcell.CAREERS_URL, 'https://www.netxcell.com/careers.php')
  assert.deepEqual(netxcell.DETAIL_PAGE_URLS, [
    'https://www.netxcell.com/enterprise-sales-manager.php',
    'https://www.netxcell.com/arcallingexperience.php',
    'https://www.netxcell.com/business-development-mannager.php',
    'https://www.netxcell.com/linux-administrator.php',
  ])
  assert.equal(netxcell.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(netxcell.hasOfficialJobDetailSignal(ENTERPRISE_DETAIL_HTML), true)
  assert.equal(netxcell.hasOfficialJobDetailSignal(AR_DETAIL_HTML), true)
  assert.equal(netxcell.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
  assert.deepEqual(netxcell.extractJobCards(CAREERS_HTML).map((job) => job.detailUrl), [
    'https://www.netxcell.com/enterprise-sales-manager.php',
    'https://www.netxcell.com/arcallingexperience.php',
    'https://www.netxcell.com/business-development-mannager.php',
    'https://www.netxcell.com/linux-administrator.php',
  ])
})

test('Netxcell validates the first-party careers page and maps detail pages into jobs', async () => {
  const netxcell = await loadModule()
  const requestedUrls = []

  const jobs = await netxcell.createNetxcellScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === netxcell.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://www.netxcell.com/enterprise-sales-manager.php') return ENTERPRISE_DETAIL_HTML
      if (url === 'https://www.netxcell.com/arcallingexperience.php') return AR_DETAIL_HTML

      throw new Error(`Unexpected Netxcell fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    netxcell.CAREERS_URL,
    'https://www.netxcell.com/enterprise-sales-manager.php',
    'https://www.netxcell.com/arcallingexperience.php',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior CPaaS Sales Manager / Enterprise sales Manager.',
    company: 'Netxcell',
    location: 'Hyderabad, Bangalore, Mumbai, Delhi (Preference for Local Candidates)',
    city: null,
    country: 'India',
    link: 'https://www.netxcell.com/enterprise-sales-manager.php',
    applyUrl: 'https://www.netxcell.com/enterprise-sales-manager.php',
    sourceUrl: 'https://www.netxcell.com/enterprise-sales-manager.php',
    source: 'netxcell',
    jobId: 'enterprise-sales-manager',
    requisitionId: null,
    department: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.match(jobs[0].jobDescription ?? '', /seasoned Enterprise sales professional/i)
  assert.match(jobs[0].jobDescription ?? '', /strategic sales plans/i)
  assert.match(jobs[0].minimumQualification ?? '', /MBA in Marketing/i)
  assert.match(jobs[0].preferredQualification ?? '', /innovative communication solutions/i)

  assert.deepEqual(jobs[1], {
    title: 'AR Calling Experience (Accounts Receivable Calling) - RCMS',
    company: 'Netxcell',
    location: 'Hyderabad',
    city: 'Hyderabad',
    country: 'India',
    link: 'https://www.netxcell.com/arcallingexperience.php',
    applyUrl: 'https://www.netxcell.com/arcallingexperience.php',
    sourceUrl: 'https://www.netxcell.com/arcallingexperience.php',
    source: 'netxcell',
    jobId: 'arcallingexperience',
    requisitionId: null,
    department: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: jobs[1].jobDescription,
    minimumQualification: jobs[1].minimumQualification,
    preferredQualification: jobs[1].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[1].scrapedAt,
  })
  assert.match(jobs[1].jobDescription ?? '', /claim form 1500/i)
  assert.match(jobs[1].minimumQualification ?? '', /2 years of experience/i)
  assert.match(jobs[1].preferredQualification ?? '', /Night Shift Allowance/i)
})

test('Netxcell fails closed when the verified careers page or job detail structure drifts', async () => {
  const netxcell = await loadModule()

  await assert.rejects(
    netxcell.createNetxcellScraper().run({
      fetchText: async (url) => {
        if (url === netxcell.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected Netxcell fixture URL: ${url}`)
      },
    }),
    /official careers page changed/i,
  )

  await assert.rejects(
    netxcell.createNetxcellScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === netxcell.CAREERS_URL) return CAREERS_HTML
        if (url === 'https://www.netxcell.com/enterprise-sales-manager.php') {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        throw new Error(`Unexpected Netxcell fixture URL: ${url}`)
      },
    }),
    /job detail page changed/i,
  )

  await assert.rejects(
    netxcell.createNetxcellScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === netxcell.CAREERS_URL) return PUBLIC_JOBS_HTML
        throw new Error(`Unexpected Netxcell fixture URL: ${url}`)
      },
    }),
    /official careers page changed/i,
  )
})
