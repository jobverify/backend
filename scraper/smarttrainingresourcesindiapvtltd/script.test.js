import assert from 'node:assert/strict'
import test from 'node:test'

const loadSmartTrainingResourcesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SMART Training Resources India Pvt Ltd scraper module at ./script.js')
  }
}

const officialSiteShellHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Best Career Development Centre in Chennai | Smart Resources India Pvt Ltd</title>
      <meta
        name="description"
        content="Smart Resources India Pvt Ltd is Chennai's best career development centre offering job placement, resume building, interview coaching & professional training. Build your dream career today!"
      />
      <link rel="canonical" href="https://smartica.co.in/" />
      <meta property="og:site_name" content="Smart Resources India Pvt Ltd" />
      <meta property="og:image:alt" content="SMART Training Resources India Pvt Ltd" />
      <script type="module" crossorigin src="/assets/index-0303e848.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const verifiedCareersBundle = `
  function AppRoutes(){
    return u.jsx(a4,{children:u.jsxs(r4,{children:[
      u.jsx(qa,{path:"/",element:u.jsx(N6,{})}),
      u.jsx(qa,{path:"/careers",element:u.jsx(B6,{})})
    ]})})
  }
  const CareersPage=()=>{
    const [form,setForm]=g.useState({firstName:"",lastName:"",email:"",phone:"",resume:""});
    g.useEffect(()=>{Jc.get("https://admin.smartica.co.in/api/careers-pages?_sort=id:DESC")},[]);
    return u.jsx("button",{children:"Apply Now"})
  };
`

const careersApiPayload = {
  data: [
    {
      id: 18,
      attributes: {
        location: 'Chennai ',
        description: '<p>Own day-to-day business cycle and coordinate training delivery.</p>',
        experience: '0 - 3 Years',
        department: 'Operations',
        workType: 'Full Time',
        publishedAt: '2024-04-17T09:31:34.092Z',
        jobRole: 'Operations',
        compensation: '3 - 5 LPA',
        shortDescription: 'Full Time, Base Location: Chennai (Also willing to travel PAN India), Experience: 0 - 3 Years',
      },
    },
    {
      id: 8,
      attributes: {
        location: 'Chennai',
        description: '<p>Plan and deliver classes in programming languages and software tools.</p>',
        experience: '0 - 3 Years',
        department: 'Trainer',
        workType: 'Full Time',
        publishedAt: '2024-03-25T12:19:56.203Z',
        jobRole: 'Technical Trainer ',
        compensation: '3 - 5 LPA',
        shortDescription: 'Full Time, Base Location: Chennai (Also willing to travel PAN India), Experience: 0 - 3 Years',
      },
    },
  ],
}

test('SMART Training Resources helpers stay aligned to the verified first-party shell and careers bundle', async () => {
  const smartTrainingResources = await loadSmartTrainingResourcesModule()

  assert.equal(smartTrainingResources.SOURCE, 'smarttrainingresourcesindiapvtltd')
  assert.equal(smartTrainingResources.COMPANY, 'SMART Training Resources India Pvt Ltd')
  assert.equal(smartTrainingResources.HOMEPAGE_URL, 'https://smartica.co.in/')
  assert.equal(smartTrainingResources.CAREERS_URL, 'https://smartica.co.in/careers')
  assert.equal(
    smartTrainingResources.CAREERS_API_URL,
    'https://admin.smartica.co.in/api/careers-pages?_sort=id:DESC',
  )
  assert.equal(smartTrainingResources.hasOfficialSiteShell(officialSiteShellHtml), true)
  assert.equal(
    smartTrainingResources.extractBundleUrl(officialSiteShellHtml),
    'https://smartica.co.in/assets/index-0303e848.js',
  )
  assert.equal(smartTrainingResources.hasVerifiedCareersBundle(verifiedCareersBundle), true)
  assert.equal(smartTrainingResources.hasOfficialSiteShell('<html><title>Placeholder</title></html>'), false)
  assert.equal(smartTrainingResources.hasVerifiedCareersBundle('const routes = []'), false)
})

test('extractJobsFromPayload maps SMART Training Resources API records into normalized public jobs', async () => {
  const smartTrainingResources = await loadSmartTrainingResourcesModule()

  assert.deepEqual(smartTrainingResources.extractJobsFromPayload(careersApiPayload), [
    {
      title: 'Operations',
      company: 'SMART Training Resources India Pvt Ltd',
      department: 'Operations',
      location: 'Chennai',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '18',
      requisitionId: '18',
      sourceUrl: 'https://smartica.co.in/careers',
      applyUrl: 'https://smartica.co.in/careers',
      employmentType: 'Full Time',
      experienceRequired: '0 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2024-04-17T09:31:34.092Z',
      closingDate: null,
      jobDescription: 'Full Time, Base Location: Chennai (Also willing to travel PAN India), Experience: 0 - 3 Years Own day-to-day business cycle and coordinate training delivery.',
      salary: '3 - 5 LPA',
    },
    {
      title: 'Technical Trainer',
      company: 'SMART Training Resources India Pvt Ltd',
      department: 'Trainer',
      location: 'Chennai',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '8',
      requisitionId: '8',
      sourceUrl: 'https://smartica.co.in/careers',
      applyUrl: 'https://smartica.co.in/careers',
      employmentType: 'Full Time',
      experienceRequired: '0 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2024-03-25T12:19:56.203Z',
      closingDate: null,
      jobDescription: 'Full Time, Base Location: Chennai (Also willing to travel PAN India), Experience: 0 - 3 Years Plan and deliver classes in programming languages and software tools.',
      salary: '3 - 5 LPA',
    },
  ])
})

test('run verifies the first-party SMART shell, bundle, and API before returning jobs', async () => {
  const smartTrainingResources = await loadSmartTrainingResourcesModule()
  const requests = []

  const jobs = await smartTrainingResources.createSmartTrainingResourcesIndiaScraper().run({
    fetchText: async (url) => {
      requests.push({ url, type: 'text' })

      if (url === smartTrainingResources.HOMEPAGE_URL) return officialSiteShellHtml
      if (url === smartTrainingResources.CAREERS_URL) return officialSiteShellHtml
      if (url === 'https://smartica.co.in/assets/index-0303e848.js') return verifiedCareersBundle

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requests.push({ url, type: 'json' })

      if (url === smartTrainingResources.CAREERS_API_URL) return careersApiPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { url: 'https://smartica.co.in/', type: 'text' },
    { url: 'https://smartica.co.in/careers', type: 'text' },
    { url: 'https://smartica.co.in/assets/index-0303e848.js', type: 'text' },
    { url: 'https://admin.smartica.co.in/api/careers-pages?_sort=id:DESC', type: 'json' },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'smarttrainingresourcesindiapvtltd')
  assert.equal(jobs[0].link, 'https://smartica.co.in/careers')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run fails closed when the verified SMART site shell or careers bundle drifts', async () => {
  const smartTrainingResources = await loadSmartTrainingResourcesModule()

  await assert.rejects(
    smartTrainingResources.createSmartTrainingResourcesIndiaScraper().run({
      fetchText: async () => '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>',
      fetchJson: async () => careersApiPayload,
    }),
    /verified official smartica site shell/i,
  )

  await assert.rejects(
    smartTrainingResources.createSmartTrainingResourcesIndiaScraper().run({
      fetchText: async (url) => {
        if (url === smartTrainingResources.HOMEPAGE_URL) return officialSiteShellHtml
        if (url === smartTrainingResources.CAREERS_URL) return officialSiteShellHtml
        return 'const routes = []'
      },
      fetchJson: async () => careersApiPayload,
    }),
    /verified first-party careers bundle/i,
  )
})
