import assert from 'node:assert/strict'
import test from 'node:test'

const loadDecIndustriesModule = async () => {
  try {
    return await import('../../scraper/decindustries/script.js')
  } catch {
    assert.fail('Expected DEC Industries scraper module at ../../scraper/decindustries/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DEC Industries Pvt Ltd</title>
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const indexBundle = `
const routes = [];
const careersPage = lazy(() => import("./CareersPage-xyz789.js"));
export { routes, careersPage };
`

const careersBundle = `
const g=[["path",{d:"M10 20",key:"sc7q7i"}]],x=c("funnel",g),s=[
  {
    id:"senior-structural-engineer",
    title:"Senior Structural Engineer (PEB)",
    location:"HEAD OFFICE, NALLAKUNTA, HYDERABAD",
    schedule:"Full time",
    jobNumber:"DEC-ENG-2026-001",
    segmentation:"Experienced Professionals",
    description:\`Lead flagship structural design work for steel buildings.\`,
    responsibilities:["Lead PEB structural design.","Coordinate consultants and clients."],
    offer:["Competitive compensation.","Health insurance coverage."],
    qualifications:["B.Tech in Civil Engineering.","8+ years of PEB experience."]
  },
  {
    id:"site-engineer",
    title:"Site Engineer (Civil & Erection)",
    location:"PROJECT SITES (PAN-INDIA)",
    schedule:"Full time / On-Site",
    jobNumber:"DEC-PROJ-2026-108",
    segmentation:"Project Execution",
    description:\`Oversee safe execution of civil and erection work at DEC project sites.\`,
    responsibilities:["Supervise anchor bolt casting.","Track site progress reports."],
    offer:["Site allowances provided.","Travel reimbursement."],
    qualifications:["Diploma in Civil Engineering.","3-6 years of erection experience."]
  }
],j=()=>{};
`

test('DEC Industries extracts public jobs from the careers bundle', async () => {
  const decIndustries = await loadDecIndustriesModule()

  assert.equal(decIndustries.HOMEPAGE_URL, 'https://decindustries.in/')
  assert.equal(decIndustries.CAREERS_URL, 'https://decindustries.in/careers')
  assert.equal(decIndustries.extractIndexBundlePath(homepageHtml), '/assets/index-abc123.js')
  assert.equal(decIndustries.extractCareersBundlePath(indexBundle), './CareersPage-xyz789.js')

  const jobs = decIndustries.extractJobsFromCareersBundle(careersBundle)

  assert.equal(jobs.length, 2)

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      department: job.department,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      company: job.company,
      country: job.country,
    })),
    [
      {
        title: 'Senior Structural Engineer (PEB)',
        location: 'HEAD OFFICE, NALLAKUNTA, HYDERABAD',
        jobId: 'DEC-ENG-2026-001',
        requisitionId: 'senior-structural-engineer',
        department: 'Experienced Professionals',
        sourceUrl: 'https://decindustries.in/careers/senior-structural-engineer',
        applyUrl: 'https://decindustries.in/careers/senior-structural-engineer/apply',
        employmentType: 'Full-time',
        company: 'DEC Industries',
        country: 'India',
      },
      {
        title: 'Site Engineer (Civil & Erection)',
        location: 'PROJECT SITES (PAN-INDIA)',
        jobId: 'DEC-PROJ-2026-108',
        requisitionId: 'site-engineer',
        department: 'Project Execution',
        sourceUrl: 'https://decindustries.in/careers/site-engineer',
        applyUrl: 'https://decindustries.in/careers/site-engineer/apply',
        employmentType: 'Full-time',
        company: 'DEC Industries',
        country: 'India',
      },
    ],
  )

  assert.match(jobs[0].description, /JOB DESCRIPTION:/)
  assert.match(jobs[0].description, /KEY RESPONSIBILITIES:/)
  assert.match(jobs[0].description, /JOB QUALIFICATIONS:/)
})

test('DEC Industries run discovers the public careers bundle and returns runnable jobs', async () => {
  const decIndustries = await loadDecIndustriesModule()
  const requestedUrls = []

  const jobs = await decIndustries.createDecIndustriesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === decIndustries.HOMEPAGE_URL) return homepageHtml
      if (url === 'https://decindustries.in/assets/index-abc123.js') return indexBundle
      if (url === 'https://decindustries.in/assets/CareersPage-xyz789.js') return careersBundle

      throw new Error(`Unexpected DEC Industries fixture URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      decIndustries.HOMEPAGE_URL,
      'https://decindustries.in/assets/index-abc123.js',
      'https://decindustries.in/assets/CareersPage-xyz789.js',
    ],
  )

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'decindustries')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].link, jobs[1].applyUrl)
})
