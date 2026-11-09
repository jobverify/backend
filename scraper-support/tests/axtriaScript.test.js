import assert from 'node:assert/strict'
import test from 'node:test'

const loadAxtriaModule = async () => {
  try {
    return await import('../../scraper/axtria/script.js')
  } catch {
    return null
  }
}

const buildCareersHtml = () => `
<!doctype html>
<html>
  <body>
    <div class="career-bottom-tabs-manual-block">
      <div class="career-bottom-tabs-manual-left">
        <p class="text-2xl">
          Manager- Patient Analytics
        </p>
        <p class="text-lg">
          Any Axtria location
        </p>
      </div>
      <div class="career-bottom-tabs-manual-right">
        <a class="in-btn in-btn--filled-dark career-job-link" data-india-job="true" href="https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10624&amp;company=axtriaindiP&amp;st=DBD1FE2675EA51E52E390581B47D0C5D505A758F" target="_blank" rel="nofollow noopener">
          View Job
        </a>
      </div>
    </div>
    <div class="career-bottom-tabs-manual-block">
      <div class="career-bottom-tabs-manual-left">
        <p class="text-2xl">
          Senior Associate- Forecasting
        </p>
        <p class="text-lg">
          Gurugram
        </p>
      </div>
      <div class="career-bottom-tabs-manual-right">
        <a class="in-btn in-btn--filled-dark career-job-link" data-india-job="true" href="https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10570&amp;company=axtriaindiP&amp;st=A113E47AD8BAE583B28AC7CECADB67B756C08FEA" target="_blank" rel="nofollow noopener">
          View Job
        </a>
      </div>
    </div>
  </body>
</html>
`

const buildDetailHtml = ({
  title = 'Manager- Patient Analytics',
  positionSummary = 'Lead analytics workstreams for pharma clients.',
  workExperience = '',
} = {}) => `
<!doctype html>
<html>
  <head>
    <title>Career Opportunities: ${title} (10624)</title>
  </head>
  <body>
    <div class="content">
      <div class="joqReqDescription" tabindex="0" role="note">
        <div class="externalPosting">
          <div>
            <div style="padding:10.0px 0.0px;border:1.0px solid transparent">
              <div style="font-size:16.0px;word-wrap:break-word"><h2>Position Summary</h2></div>
              <div><p>${positionSummary}</p></div>
            </div>
            <div style="padding:10.0px 0.0px;border:1.0px solid transparent">
              <div style="font-size:16.0px;word-wrap:break-word"><h2>Work Experience</h2></div>
              <div><p>${workExperience}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const buildUnavailableDetailHtml = () => `
<!doctype html>
<html>
  <body>
    <div>
      JavaScript is turned off in your web browser. Turn it on to take full advantage of this site, then refresh the page.
      Loading...
      Skip to Main Content
      This job cannot be viewed at this time. It has either been deleted or is no longer available for application.
    </div>
  </body>
</html>
`

const buildErrorShellHtml = () => `
<!doctype html>
<html>
  <body>
    <div>
      &nbsp; SuccessFactors &nbsp; &nbsp;
      An error occurred while processing your request.
      Please go back to your original page and check the URL.
      Then try your request again.
      &nbsp; &nbsp;
    </div>
  </body>
</html>
`

test('extractSearchResults maps the Axtria static India job cards into shared scraper fields', async () => {
  const axtria = await loadAxtriaModule()
  assert.ok(axtria)

  const jobs = axtria.extractSearchResults(buildCareersHtml())

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Manager- Patient Analytics',
    company: 'Axtria',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: '10624',
    requisitionId: '10624',
    sourceUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10624&company=axtriaindiP&st=DBD1FE2675EA51E52E390581B47D0C5D505A758F',
    applyUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10624&company=axtriaindiP&st=DBD1FE2675EA51E52E390581B47D0C5D505A758F',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Axtria India opening for Manager- Patient Analytics in India.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, '10570')
  assert.equal(jobs[1].location, 'Gurugram, India')
  assert.equal(jobs[1].city, 'Gurugram')
})

test('run fetches the Axtria careers page and decorates jobs', async () => {
  const axtria = await loadAxtriaModule()
  assert.ok(axtria)

  const requestedUrls = []
  const scraper = axtria.createAxtriaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === axtria.CAREER_PAGE_URL) return buildCareersHtml()
      if (url.includes('jobId=10624')) {
        return buildDetailHtml({
          title: 'Manager- Patient Analytics',
          workExperience: 'Required Experience: 8+ years in patient analytics.',
        })
      }
      if (url.includes('jobId=10570')) {
        return buildDetailHtml({
          title: 'Senior Associate- Forecasting',
          workExperience: '',
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(axtria.buildSearchUrl(), axtria.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [
    axtria.CAREER_PAGE_URL,
    'https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10624&company=axtriaindiP&st=DBD1FE2675EA51E52E390581B47D0C5D505A758F',
    'https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10570&company=axtriaindiP&st=A113E47AD8BAE583B28AC7CECADB67B756C08FEA',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'axtria')
  assert.equal(jobs[0].link, 'https://career10.successfactors.com/sfcareer/jobreqcareerpvt?jobId=10624&company=axtriaindiP&st=DBD1FE2675EA51E52E390581B47D0C5D505A758F')
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('enrichJobFromDetailPage marks Axtria unavailable SuccessFactors shells as checked when no public experience is exposed', async () => {
  const axtria = await loadAxtriaModule()
  assert.ok(axtria)

  const enriched = axtria.enrichJobFromDetailPage({
    title: 'Manager- Patient Analytics',
    sourceUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareer?jobId=10624&company=axtriaindiP',
    applyUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareer?jobId=10624&company=axtriaindiP',
    experienceRequired: null,
    jobDescription: 'Axtria India opening for Manager- Patient Analytics in India.',
    publicExperienceChecked: false,
  }, buildUnavailableDetailHtml())

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('enrichJobFromDetailPage marks Axtria SuccessFactors error shells as checked when the public link is no longer usable', async () => {
  const axtria = await loadAxtriaModule()
  assert.ok(axtria)

  const enriched = axtria.enrichJobFromDetailPage({
    title: 'Senior Associate- Forecasting',
    sourceUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareer?jobId=10570&company=axtriaindiP',
    applyUrl: 'https://career10.successfactors.com/sfcareer/jobreqcareer?jobId=10570&company=axtriaindiP',
    experienceRequired: null,
    jobDescription: 'Axtria India opening for Senior Associate- Forecasting in Gurugram, India.',
    publicExperienceChecked: false,
  }, buildErrorShellHtml())

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.publicExperienceChecked, true)
})
