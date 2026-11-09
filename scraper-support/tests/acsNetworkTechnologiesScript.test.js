import assert from 'node:assert/strict'
import test from 'node:test'

const loadAcsNetworkTechnologiesModule = async () => {
  try {
    return await import('../../scraper/acsnetworktechnologies/script.js')
  } catch {
    return null
  }
}

const listingPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Jobs in Acs Networks & Technologies Dehradun | ID-1140592-Recruiters in Dehradun</title>
  </head>
  <body>
    <h1>Acs Networks & Technologies Dehradun, Uttarakhand</h1>
    <h2>6 current job vacancies at Acs Networks & Technologies</h2>
    <div class="sjc-list" id="more_results">
      <div class="sjc-iteam pr_list" data-url="https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm">
        <div class="sjci">
          <div class="sjci-heading">
            <a href="https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm" class="job-name">Team Leader Sales</a>
            <p class="job-cname">ACS Network & Technology Private Limited</p>
          </div>
          <ul class="sjci-need">
            <li>2 - 3 yrs</li>
            <li>3.0 Lac/Yr</li>
            <li><span>Dehradun</span></li>
          </ul>
          <div class="sjci-skils">
            <div class="sk_list">Team Building <span>Online Sales</span> <span>Cold Calling</span></div>
          </div>
        </div>
      </div>
      <div class="sjc-iteam pr_list" data-url="https://www.placementindia.com/job-detail/sales-executive-in-acs-network-technologies-pvt-ltd-at-dehradun-sahastradhara-road-dehradun-1257006.htm">
        <div class="sjci">
          <div class="sjci-heading">
            <a href="https://www.placementindia.com/job-detail/sales-executive-in-acs-network-technologies-pvt-ltd-at-dehradun-sahastradhara-road-dehradun-1257006.htm" class="job-name">Direct Walk-In For Sales Executive (0-1 Years)</a>
            <p class="job-cname">ACS Network & technologies Pvt. Ltd.</p>
          </div>
          <ul class="sjci-need">
            <li>0 - 1 yrs</li>
            <li>2.5 Lac/Yr</li>
            <li><span>Dehradun</span> <a role="button" class="more_city">+1 <span class="tooltiptext"> Sahastradhara Road  Dehradun</span></a></li>
          </ul>
          <div class="sjci-skils">
            <div class="sk_list">Software Sales</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html>
  <body>
    <div class="jdl-header">
      <div class="job-title">
        <h1 class="jd-title">Team Leader Sales</h1>
        <div class="jd-cname">
          <a href="https://www.placementindia.com/job-recruiters/acs-networks-technologies-dehradun-1140592-ffid/">
            <span>ACS Network & Technology Private Limited</span>
          </a>
        </div>
      </div>
      <ul class="jd-mfl">
        <li>2 - 3 Years</li>
        <li>10 Openings</li>
        <li>2.3 - 3.0 Lac/Yr</li>
        <li>Face-to-Face interview</li>
        <li class="location"><a class="gray">Dehradun</a></li>
      </ul>
      <div class="key-skils-box">
        <div class="key_hed">Key Skills</div>
        <p class="ks-list">
          <span class="ks"><a>Team Building</a></span>
          <span class="ks"><a>Online Sales</a></span>
          <span class="ks"><a>Cold Calling</a></span>
        </p>
      </div>
    </div>
    <div class="jdl-body">
      <h2 class="jdlb-t1">Job Description</h2>
      <div class="dyn_text_sec">
        About the Role: <br /><br />
        As our Sales Team Lead, you'll orchestrate a powerhouse team of sales representatives.<br /><br />
        Key Responsibilities:<br /><br />
        Lead with Impact.
        <ul class="jr">
          <li><p class="lbl">Experience</p><p class="val">2 - 3 Years</p></li>
          <li><p class="lbl">No. of Openings</p><p class="val">10</p></li>
          <li><p class="lbl">Education</p><p class="val">Graduate (B.B.A, B.Com)</p></li>
          <li><p class="lbl">Role</p><p class="val">Team Leader Sales</p></li>
          <li><p class="lbl">Industry Type</p><p class="val">Call Centre / BPO /  ITES / LPO</p></li>
          <li><p class="lbl">Job Country</p><p class="val">India</p></li>
          <li><p class="lbl">Type of Job</p><p class="val">Full Time</p></li>
          <li><p class="lbl">Work Location Type</p><p class="val">Work from Office</p></li>
          <li><p class="lbl">Face Interview Location</p><p class="val">Khasra No. 65, 1st Floor, ACS Networks & Technologies Pvt. Ltd</p></li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const buildConnectTimeoutError = () => {
  const error = new TypeError('fetch failed')
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error (attempted address: www.placementindia.com:443, timeout: 10000ms)',
  }
  return error
}

test('extractSearchResults maps ACS recruiter cards into shared scraper fields', async () => {
  const acsNetworkTechnologies = await loadAcsNetworkTechnologiesModule()
  assert.ok(acsNetworkTechnologies)

  assert.equal(acsNetworkTechnologies.SOURCE, 'acsnetworktechnologies')
  assert.equal(acsNetworkTechnologies.COMPANY, 'ACS Network & Technologies')
  assert.equal(acsNetworkTechnologies.VERIFIED_ON, '2026-08-15')
  assert.equal(
    acsNetworkTechnologies.isVerifiedAcsNetworkTechnologiesUnavailableError(buildConnectTimeoutError()),
    true,
  )
  assert.equal(acsNetworkTechnologies.hasOfficialRecruiterPageSignal(listingPageHtml), true)

  const jobs = acsNetworkTechnologies.extractSearchResults(listingPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Team Leader Sales',
    company: 'ACS Network & Technology Private Limited',
    department: null,
    location: 'Dehradun, India',
    city: 'Dehradun',
    country: 'India',
    jobId: '1265304',
    requisitionId: '1265304',
    sourceUrl: 'https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm',
    applyUrl: 'https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm',
    employmentType: null,
    experienceRequired: '2 - 3 yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Team Building', 'Online Sales', 'Cold Calling'],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    salary: '3.0 Lac/Yr',
  })
  assert.equal(jobs[1].title, 'Direct Walk-In For Sales Executive (0-1 Years)')
  assert.equal(jobs[1].jobId, '1257006')
  assert.equal(jobs[1].location, 'Dehradun, Sahastradhara Road Dehradun, India')
  assert.deepEqual(jobs[1].requiredSkills, ['Software Sales'])

  const currentCardMarkup = listingPageHtml.replace(/<p class="job-cname">[\s\S]*?<\/p>/g, '')
  assert.equal(acsNetworkTechnologies.hasOfficialRecruiterPageSignal(currentCardMarkup), true)
  assert.equal(
    acsNetworkTechnologies.extractSearchResults(currentCardMarkup)[0].company,
    'ACS Network & Technologies',
  )
})

test('the observed ACS employer spelling alias retains its verified recruiter cards', async () => {
  const acs = await loadAcsNetworkTechnologiesModule()
  const jobs = acs.extractSearchResults(listingPageHtml.replaceAll('ACS Network & Technology Private Limited', 'ACS Network & Technoloiges'))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'ACS Network & Technoloiges')
  assert.equal(jobs[0].jobId, '1265304')
})

test('extractJobDetails enriches ACS detail pages with recruiter metadata', async () => {
  const acsNetworkTechnologies = await loadAcsNetworkTechnologiesModule()
  assert.ok(acsNetworkTechnologies)

  const detail = acsNetworkTechnologies.extractJobDetails(detailPageHtml)

  assert.deepEqual(detail, {
    title: 'Team Leader Sales',
    company: 'ACS Network & Technology Private Limited',
    location: 'Dehradun, India',
    city: 'Dehradun',
    country: 'India',
    experienceRequired: '2 - 3 Years',
    employmentType: 'Full Time',
    minimumQualification: 'Graduate (B.B.A, B.Com)',
    preferredQualification: null,
    requiredSkills: ['Team Building', 'Online Sales', 'Cold Calling'],
    jobDescription: "About the Role: As our Sales Team Lead, you'll orchestrate a powerhouse team of sales representatives. Key Responsibilities: Lead with Impact.",
    remoteStatus: 'On-site',
    openings: '10',
    industry: 'Call Centre / BPO / ITES / LPO',
    interviewType: 'Face-to-Face interview',
    interviewLocation: 'Khasra No. 65, 1st Floor, ACS Networks & Technologies Pvt. Ltd',
    salary: '2.3 - 3.0 Lac/Yr',
  })
})

test('ACS recruiter discovery rejects promoted jobs from other employers and unowned detail URLs', async () => {
  const acs = await loadAcsNetworkTechnologiesModule()
  const promoted = listingPageHtml.replace('ACS Network & Technology Private Limited</p>', 'Bhoomi Enterprises</p>')
  assert.deepEqual(acs.extractSearchResults(promoted).map(job => job.jobId), ['1257006'])
  const quoted = promoted.replaceAll('class="job-cname"', "class='job-cname extra'")
  assert.deepEqual(acs.extractSearchResults(quoted).map(job => job.jobId), ['1257006'])
  const unknownOwner = listingPageHtml.replace(/<p class="job-cname">[\s\S]*?<\/p>/g, '')
    .replaceAll('team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm',
      'telesales-executive-in-another-employer-at-delhi-1265304.htm')
  assert.deepEqual(acs.extractSearchResults(unknownOwner).map(job => job.jobId), ['1257006'])
  const foreignHost = listingPageHtml.replaceAll('https://www.placementindia.com/job-detail/team-leader',
    'https://another-employer.example/job-detail/team-leader')
  assert.deepEqual(acs.extractSearchResults(foreignHost).map(job => job.jobId), ['1257006'])
})

test('ACS detail ownership mismatches cannot be relabeled as the recruiter company', async () => {
  const acs = await loadAcsNetworkTechnologiesModule()
  const jobs = await acs.createAcsNetworkTechnologiesScraper().run({ fetchText: async url => {
    if (url === acs.CAREER_PAGE_URL) return listingPageHtml
    return url.includes('1265304') ? detailPageHtml.replaceAll('ACS Network & Technology Private Limited', 'Bhoomi Enterprises')
      .replace('class="jd-cname"', "class='extra jd-cname'") : detailPageHtml
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['1257006'])
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('run fetches the ACS recruiter page, enriches each job with detail metadata, and decorates output fields', async () => {
  const acsNetworkTechnologies = await loadAcsNetworkTechnologiesModule()
  assert.ok(acsNetworkTechnologies)

  const requestedTexts = []
  const scraper = acsNetworkTechnologies.createAcsNetworkTechnologiesScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === acsNetworkTechnologies.CAREER_PAGE_URL) return listingPageHtml
      if (url === 'https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm') return detailPageHtml
      if (url === 'https://www.placementindia.com/job-detail/sales-executive-in-acs-network-technologies-pvt-ltd-at-dehradun-sahastradhara-road-dehradun-1257006.htm') return detailPageHtml.replaceAll('Team Leader Sales', 'Direct Walk-In For Sales Executive (0-1 Years)')
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    acsNetworkTechnologies.CAREER_PAGE_URL,
    'https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm',
    'https://www.placementindia.com/job-detail/sales-executive-in-acs-network-technologies-pvt-ltd-at-dehradun-sahastradhara-road-dehradun-1257006.htm',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'acsnetworktechnologies')
  assert.equal(jobs[0].link, 'https://www.placementindia.com/job-detail/team-leader-sales-in-acs-network-technology-private-limited-at-dehradun-1265304.htm')
  assert.equal(jobs[0].minimumQualification, 'Graduate (B.B.A, B.Com)')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(jobs[0].salary, '2.3 - 3.0 Lac/Yr')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run returns [] when the verified PlacementIndia recruiter page times out in the current runtime', async () => {
  const acsNetworkTechnologies = await loadAcsNetworkTechnologiesModule()
  assert.ok(acsNetworkTechnologies)

  const requestedUrls = []
  const scraper = acsNetworkTechnologies.createAcsNetworkTechnologiesScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw buildConnectTimeoutError()
    },
  })

  assert.deepEqual(requestedUrls, [acsNetworkTechnologies.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
