import assert from 'node:assert/strict'
import test from 'node:test'

const loadCelebalModule = async () => {
  try {
    return await import('../../scraper/celebaltechnologies/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers - Celebal Technologies</title>
    <meta name="description" content="Empower the future you imagine">
  </head>
  <body>
    <main>
      <h1>Empower the future you imagine</h1>
      <section>
        <h2>Open Positions</h2>
        <p>7<!-- --> jobs available</p>
      </section>
      <a href="/careers/data-scientist-fresher">Data Scientist (Fresher)</a>
      <a href="/careers/data-engineer-fresher">Data Engineer (Fresher)</a>
      <a href="/careers/data-engineer">Data Engineer</a>
      <nav aria-label="pagination">
        <button disabled>‹</button>
        <button>1</button>
        <button>2</button>
        <button>3</button>
        <button>›</button>
      </nav>
    </main>
    <script src="/_next/static/chunks/223-layout.js" defer></script>
    <script src="/_next/static/chunks/9835-jobs.js" defer></script>
    <script src="/_next/static/chunks/pages/careers-page.js" defer></script>
  </body>
</html>
`

const jobsBundleJs = `
"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[9835],{89835:(e,n,i)=>{i.d(n,{L:()=>a});let a=[
  {id:"data-scientist-fresher",title:"Data Scientist (Fresher)",area:"Data Science",exp:"",location:"Houston | Calgary | Jaipur| Bogotá",skills:["Statistics & Probability"," Machine Learning & AI","Data Analysis & Visualization"],workMode:"Internship + Fulltime",description:"Aspiring Data Scientist with a strong foundation in Python, SQL, statistics, and machine learning fundamentals.",responsibilities:["Collaborate with client stakeholders.","Develop data science solutions using Azure services."],qualifications:["B.Tech/BCA or any Graduation","Strong statistics fundamentals"]},
  {id:"data-engineer-fresher",title:"Data Engineer (Fresher)",area:"Data Engineer",exp:"",location:"Houston | Calgary | Jaipur| Bogotá",skills:["Python","SQL","Apache Spark"],workMode:"Internship + Fulltime",description:"Fresh graduate with a strong foundation in Python, SQL, and data engineering concepts.",responsibilities:["Build ETL workflows.","Assist with cloud data platform delivery."],qualifications:["B.Tech/BCA or any Graduation","Familiarity with Azure Data Factory"]},
  {id:"data-engineer",title:"Data Engineer",area:"Data Engineer",exp:"2-5 Years",location:"Jaipur, Noida, Gurgaon, Bengaluru, Pune, Hyderabad",skills:["Azure Databricks","Azure Data Factory","Azure Data Lake Storage"],workMode:"Work from Office",description:"As a Data Architect you will work with multiple teams to deliver solutions on the Azure Cloud.",responsibilities:["Build scalable application-level data platforms.","Improve recent implementations."],qualifications:["B.Tech/BCA or any Graduation","Experience with Databricks and Spark"]},
  {id:"fullstack-developer-python-ai",title:"Fullstack Developer - Python with AI",area:"Software Development and Design",exp:"5+ years",location:"Jaipur, Noida, Gurgaon, Bengaluru, Pune, Hyderabad",skills:["React.js","Next.js","LangChain and LangGraph"],workMode:"Work from Office",description:"We are looking for a highly skilled Fullstack Developer – Python with AI to join our dynamic team.",responsibilities:["Build responsive user interfaces using <strong>React.js and Next.js</strong>.","Develop robust backend services and APIs using <strong>Python</strong>."],qualifications:["B.Tech/BCA or any Graduation","Experience with AWS and/or Azure"]},
  {id:"technical-project-manager",title:"Technical Project Manager",area:"Software Development and Design",exp:"5-12 Years",location:"Gurgaon",skills:["Agile/Scrum","Stakeholder Management","Project Planning"],workMode:"Work from Office",description:"We are seeking a senior Product / AI-Tech Project Manager with a strong background in AI and MLOps.",responsibilities:["Drive product development and end-to-end delivery.","Lead client-facing delivery discussions."],qualifications:["B.Tech/BCA or any Graduation","Hands-on expertise with Azure Services and Databricks"]},
  {id:"sap-mm",title:"SAP MM",area:"SAP",exp:"4-10 Years",location:"Noida,Jaipur",skills:["SAP MM","Procure-to-Pay (P2P)","Inventory Management"],workMode:"Work from Office",description:"We are looking for a skilled SAP MM consultant with 4 to 10 years of experience to join our team in Noida.",responsibilities:["Configure and support <strong>SAP MM</strong> modules.","Participate in upgrades, testing, and user training."],qualification:["B.Tech/BCA or any Graduation","Knowledge of SAP HANA"]},
  {id:"account-executive-canada",title:"Account Executive",area:"Sales",exp:"4-6 Years",location:"Calgary, Toronto",skills:["B2B Sales","Forecasting"],workMode:"Work from Office",description:"Drive enterprise account growth across Canada.",responsibilities:["Own pipeline generation.","Close strategic deals."],qualifications:["MBA preferred"]}
]}}]);
`

const layoutChunkJs = `"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[223],{1:()=>{}}]);`

test('Celebal verifies the official careers page shell and discovers the public chunk URLs', async () => {
  const celebal = await loadCelebalModule()
  assert.ok(celebal, 'Expected Celebal Technologies scraper module at ../../scraper/celebaltechnologies/script.js')

  assert.equal(celebal.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(celebal.extractAdvertisedJobCount(careersHtml), 7)
  assert.deepEqual(celebal.extractVisibleListingIds(careersHtml), [
    'data-scientist-fresher',
    'data-engineer-fresher',
    'data-engineer',
  ])
  assert.deepEqual(celebal.extractChunkUrls(careersHtml), [
    'https://celebaltech.com/_next/static/chunks/223-layout.js',
    'https://celebaltech.com/_next/static/chunks/9835-jobs.js',
    'https://celebaltech.com/_next/static/chunks/pages/careers-page.js',
  ])
})

test('Celebal parses the first-party Next.js jobs bundle and keeps India roles from page 1, 2, and 3', async () => {
  const celebal = await loadCelebalModule()
  assert.ok(celebal, 'Expected Celebal Technologies scraper module at ../../scraper/celebaltechnologies/script.js')

  const rawRoles = celebal.parseJobsBundle(jobsBundleJs)

  assert.equal(rawRoles.length, 7)
  assert.equal(rawRoles[0].id, 'data-scientist-fresher')
  assert.equal(rawRoles[3].id, 'fullstack-developer-python-ai')
  assert.equal(rawRoles[5].id, 'sap-mm')
  assert.deepEqual(celebal.extractIndiaCities(rawRoles[0].location), ['Jaipur'])
  assert.deepEqual(
    celebal.extractIndiaCities(rawRoles[2].location),
    ['Jaipur', 'Noida', 'Gurugram', 'Bengaluru', 'Pune', 'Hyderabad'],
  )
  assert.equal(celebal.isIndiaRoleLocation(rawRoles[6].location), false)

  const normalized = celebal.normalizeRole(rawRoles[0], {
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(normalized, {
    jobId: 'data-scientist-fresher',
    requisitionId: 'data-scientist-fresher',
    title: 'Data Scientist (Fresher)',
    company: 'Celebal Technologies',
    department: 'Data Science',
    location: 'Houston | Calgary | Jaipur, India | Bogotá',
    city: 'Jaipur',
    country: 'India',
    sourceNativeLocation: 'Houston | Calgary | Jaipur| Bogotá',
    sourceWorkMode: 'Internship + Fulltime',
    remoteStatus: null,
    link: 'https://celebaltech.com/careers/data-scientist-fresher',
    applyUrl: 'https://celebaltech.com/careers/data-scientist-fresher',
    sourceUrl: 'https://celebaltech.com/careers/data-scientist-fresher',
    source: 'celebaltechnologies',
    employmentType: 'Internship + Full-time',
    experienceRequired: null,
    jobDescription: 'Aspiring Data Scientist with a strong foundation in Python, SQL, statistics, and machine learning fundamentals.\n\nResponsibilities: Collaborate with client stakeholders. Develop data science solutions using Azure services.\n\nQualifications: B.Tech/BCA or any Graduation Strong statistics fundamentals',
    minimumQualification: 'B.Tech/BCA or any Graduation',
    preferredQualification: 'Strong statistics fundamentals',
    requiredSkills: [
      'Statistics & Probability',
      'Machine Learning & AI',
      'Data Analysis & Visualization',
    ],
    postingDate: null,
    closingDate: null,
    scrapedAt: '2026-07-14T00:00:00.000Z',
  })
})

test('Celebal run consumes the verified careers shell plus first-party jobs bundle and returns only India roles', async () => {
  const celebal = await loadCelebalModule()
  assert.ok(celebal, 'Expected Celebal Technologies scraper module at ../../scraper/celebaltechnologies/script.js')

  const requestedUrls = []
  const scraper = celebal.createCelebalTechnologiesScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === celebal.CAREERS_URL) {
        return careersHtml
      }

      if (url === 'https://celebaltech.com/_next/static/chunks/223-layout.js') {
        return layoutChunkJs
      }

      if (url === 'https://celebaltech.com/_next/static/chunks/9835-jobs.js') {
        return jobsBundleJs
      }

      if (url === 'https://celebaltech.com/_next/static/chunks/pages/careers-page.js') {
        return layoutChunkJs
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    celebal.CAREERS_URL,
    'https://celebaltech.com/_next/static/chunks/223-layout.js',
    'https://celebaltech.com/_next/static/chunks/9835-jobs.js',
    celebal.CAREERS_URL,
    'https://celebaltech.com/_next/static/chunks/223-layout.js',
    'https://celebaltech.com/_next/static/chunks/9835-jobs.js',
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].company, 'Celebal Technologies')
  assert.equal(jobs[0].source, 'celebaltechnologies')
  assert.equal(jobs[0].link, 'https://celebaltech.com/careers/data-scientist-fresher')
  assert.equal(jobs[3].title, 'Fullstack Developer - Python with AI')
  assert.equal(jobs[4].city, 'Gurugram')
  assert.equal(jobs[5].location, 'Noida, Jaipur, India')
  assert.ok(jobs.every((job) => job.country === 'India'))
})

test('Celebal fails closed when the verified careers shell drifts or the public jobs bundle no longer matches the official contract', async () => {
  const celebal = await loadCelebalModule()
  assert.ok(celebal, 'Expected Celebal Technologies scraper module at ../../scraper/celebaltechnologies/script.js')

  await assert.rejects(
    celebal.createCelebalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === celebal.CAREERS_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Open roles</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers surface/i,
  )

  await assert.rejects(
    celebal.createCelebalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === celebal.CAREERS_URL) {
          return careersHtml.replace('7<!-- --> jobs available', '9<!-- --> jobs available')
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/223-layout.js') {
          return layoutChunkJs
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/9835-jobs.js') {
          return jobsBundleJs
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/pages/careers-page.js') {
          return layoutChunkJs
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /advertised job count/i,
  )

  await assert.rejects(
    celebal.createCelebalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === celebal.CAREERS_URL) {
          return careersHtml
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/223-layout.js') {
          return layoutChunkJs
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/9835-jobs.js') {
          return '"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[9835],{89835:(e,n,i)=>{i.d(n,{L:()=>[]});let a=[]}}]);'
        }

        if (url === 'https://celebaltech.com/_next/static/chunks/pages/careers-page.js') {
          return layoutChunkJs
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party jobs bundle/i,
  )
})
