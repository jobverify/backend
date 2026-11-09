import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_URL = 'https://www.magnasoft.com/careers/'
const JOBS_BOARD_URL = 'https://magnasoft.zohorecruit.in/jobs/Careers'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Magnasoft</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Talk to Us</p>
      <p>Contact Us</p>
      <script>
        rec_embed_js.load({
          site:"https://magnasoft.zohorecruit.in",
          empty_job_msg:"No current Openings"
        });
      </script>
    </main>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Magnasoft Consulting India Pvt. Ltd.</title>
  </head>
  <body>
    <input type="hidden" value="[{&#34;Industry&#34;:&#34;Technology&#34;,&#34;Remote_Job&#34;:false,&#34;Job_Type&#34;:&#34;Full time&#34;,&#34;Job_Opening_Name&#34;:&#34;AIML Engineer&#34;,&#34;Posting_Title&#34;:&#34;AIML Engineer&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;Is_Locked&#34;:false,&#34;id&#34;:&#34;148491000003493001&#34;,&#34;City&#34;:&#34;Bangalore South&#34;,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:false},{&#34;Industry&#34;:&#34;Communications&#34;,&#34;Remote_Job&#34;:true,&#34;Job_Type&#34;:&#34;Full time&#34;,&#34;Job_Opening_Name&#34;:&#34;Account Executive - Telecom (US Candidates only)&#34;,&#34;Posting_Title&#34;:&#34;Account Executive - Telecom (US Candidates only)&#34;,&#34;Country&#34;:null,&#34;Is_Locked&#34;:false,&#34;id&#34;:&#34;148491000003293016&#34;,&#34;City&#34;:null,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:false},{&#34;Industry&#34;:&#34;Technology&#34;,&#34;Remote_Job&#34;:false,&#34;Job_Type&#34;:&#34;Full time&#34;,&#34;Job_Opening_Name&#34;:&#34;Principle AI Engineer&#34;,&#34;Posting_Title&#34;:&#34;Principle AI Engineer&#34;,&#34;Country&#34;:&#34;India&#34;,&#34;Is_Locked&#34;:false,&#34;id&#34;:&#34;148491000003359004&#34;,&#34;City&#34;:&#34;Bengaluru&#34;,&#34;Publish&#34;:true,&#34;Keep_on_Career_Site&#34;:false}]" id="jobs">
    <input type="hidden" value="{&#34;list_url&#34;:&#34;https://magnasoft.zohorecruit.in/jobs/Careers&#34;}" id="meta">
    <div>Magnasoft Consulting India Pvt. Ltd.</div>
  </body>
</html>
`

const loadMagnasoftModule = async () => {
  try {
    return await import('../../scraper/magnasoftconsultingindia/script.js')
  } catch {
    assert.fail('Expected Magnasoft Consulting India scraper module at ../../scraper/magnasoftconsultingindia/script.js')
  }
}

test('Magnasoft Consulting India validates the first-party shell and extracts India jobs from the Zoho board payload', async () => {
  const magnasoft = await loadMagnasoftModule()

  assert.equal(magnasoft.SOURCE, 'magnasoftconsultingindia')
  assert.equal(magnasoft.COMPANY, 'Magnasoft Consulting India')
  assert.equal(magnasoft.VERIFIED_ON, '2026-08-03')
  assert.equal(magnasoft.CAREERS_URL, CAREERS_URL)
  assert.equal(magnasoft.JOBS_BOARD_URL, JOBS_BOARD_URL)
  assert.equal(magnasoft.hasOfficialCareersShellSignal(careersHtml), true)
  assert.equal(magnasoft.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(magnasoft.extractHiddenInputValue(jobsBoardHtml, 'jobs') != null, true)

  assert.deepEqual(magnasoft.extractBoardJobs(jobsBoardHtml), [
    {
      title: 'AIML Engineer',
      company: 'Magnasoft Consulting India',
      department: 'Technology',
      location: 'Bangalore South, India',
      city: 'Bangalore South',
      country: 'India',
      jobId: '148491000003493001',
      requisitionId: '148491000003493001',
      sourceUrl: 'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003493001/AIML-Engineer?source=CareerSite',
      applyUrl: 'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003493001/AIML-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Principle AI Engineer',
      company: 'Magnasoft Consulting India',
      department: 'Technology',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '148491000003359004',
      requisitionId: '148491000003359004',
      sourceUrl: 'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003359004/Principle-AI-Engineer?source=CareerSite',
      applyUrl: 'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003359004/Principle-AI-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Magnasoft Consulting India scraper returns only the India jobs from the verified Zoho board', async () => {
  const magnasoft = await loadMagnasoftModule()
  const requestedUrls = []

  const jobs = await magnasoft.createMagnasoftConsultingIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === JOBS_BOARD_URL) return jobsBoardHtml
      throw new Error(`Unexpected Magnasoft Consulting India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_BOARD_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'magnasoftconsultingindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
