import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ABOUT_URL,
  CAREERS_URL,
  COMPANY,
  CONTACT_URL,
  CUTSHORT_COMPANY_URL,
  HOMEPAGE_URL,
  JOBS_URL,
  LINKEDIN_COMPANY_URL,
  SOURCE,
  createPantheonDigitalScraper,
  extractCompanyPageData,
  hasOfficialAboutSignal,
  hasOfficialContactSignal,
  hasOfficialCutshortSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Pantheon Digital | Web, Software &amp; Digital Marketing Agency in Delhi NCR</title>
      <meta property="og:description" content="Empowering your business with end-to-end digital solutions" />
    </head>
    <body>
      <header>
        <img alt="Pantheon Digitals Logo" src="/Logo.svg" />
        <a href="/Projects">Projects</a>
        <a href="/About">About Us</a>
        <a href="/Contact_Us">Contact Us</a>
      </header>
      <main>
        <p>Initializing Digital Excellence</p>
        <p>We deliver the best customer experience</p>
        <p>We build websites, apps, and custom software that help your business grow.</p>
        <a href="/Book-a-call">Book a Free Call</a>
      </main>
      <footer>
        <a href="https://www.instagram.com/pantheondigitals/">Instagram</a>
        <a href="https://x.com/PantheonDigi">X</a>
      </footer>
    </body>
  </html>
`

const aboutHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>About Pantheon Digital | Technology, Products &amp; Customer Growth | Pantheon Digital</title>
      <meta
        name="description"
        content="Pantheon Digital builds websites, apps, software products, and growth systems for modern businesses."
      />
    </head>
    <body>
      <h1>About Us</h1>
      <p>Initializing Digital Excellence</p>
      <p>We deliver the best customer experience</p>
      <p>We build websites, apps, and custom software that help your business grow.</p>
      <a href="/Book-a-call">Book a Free Call</a>
      <a href="/Contact_Us">Contact Us</a>
    </body>
  </html>
`

const contactHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Pantheon Digital</title>
      <meta
        name="description"
        content="Empowering your business with end-to-end digital solutions—web development, branding, marketing, and software."
      />
    </head>
    <body>
      <main>
        <h1>Contact Us</h1>
        <p>Pantheon Digital</p>
        <p>Empowering your business with end-to-end digital solutions</p>
        <p>This page could not be found.</p>
      </main>
    </body>
  </html>
`

const currentContactHtml = `
  <html>
    <head>
      <title>Contact Us | Pantheon Digital | Pantheon Digital</title>
      <meta name="description" content="Get in touch with Pantheon Digital. Book a discovery call, request a software or web development quote, or connect with our Saket, New Delhi team." />
      <meta property="og:title" content="Contact Us | Pantheon Digital" />
      <meta property="og:url" content="https://pantheondigitals.com/contact-us" />
      <meta property="og:site_name" content="Pantheon Digital" />
    </head>
    <body><h1>Contact Us</h1><a href="/About">About</a></body>
  </html>
`

const cutshortPageData = {
  pageData: {
    company: {
      name: 'pantheon digital',
      alias: 'pantheon-digital-96-46NMdJSa',
      founded: 2017,
      type: 3,
      size: 'service_2',
      stage: '3',
      links: {
        website: 'https://pantheondigitals.com',
        about: 'https://pantheondigitals.com/about',
        linkedin: 'https://linkedin.com/company/pantheon-digitals',
        instagram: 'https://instagram.com/pantheondigitals',
        twitter: 'https://twitter.com/pantheondigi',
      },
    },
    companyJobs: {
      jobs: [
        {
          _id: '68639d50a9c58fa0ff1a5f6d',
          publicUrl: 'https://cutshort.io/job/International-Sales-Executive-Delhi-pantheon-digital-CJhfL7as',
          headline: 'International Sales Executive',
          allSkills: ['International sales', 'Business Process Outsourcing (BPO)', 'Lead Generation'],
          locations: ['Delhi'],
          locationsText: 'Delhi',
          companyId: {
            alias: 'pantheon-digital-96-46NMdJSa',
            name: 'pantheon digital',
            _id: '6729d8c7191b8d0026810824',
          },
          expRange: {
            min: 1,
            max: 3,
            minVanity: 1,
            maxVanity: 3,
          },
          sanitizedComment: `
            <p><strong>Sales Role in Australian Energy Process</strong></p>
            <ul>
              <li>Company: Pantheon Digital Pvt. Ltd</li>
              <li>Shift Timing: 05:00 Am to 02:00 Pm</li>
            </ul>
            <p>We at Pantheon Digital are expanding our remote sales team.</p>
          `,
          roleTypes: ['full_time'],
          hiringIntentShownOn: '2025-10-29T08:04:22.045Z',
          authApplyUrl: 'https://cutshort.io/profile/view/j/68639d50a9c58fa0ff1a5f6d',
        },
      ],
      page: 1,
      totalPages: 1,
    },
  },
}

const cutshortData = {
  success: true,
  data: cutshortPageData,
  status: 200,
}

const cutshortHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>pantheon digital careers | 1 pantheon digital Jobs in India | Cutshort</title>
      <meta
        name="description"
        content="Apply to 1 jobs at pantheon digital. Apply for new pantheon digital job vacancies online at Cutshort."
      />
    </head>
    <body>
      <h1>pantheon digital</h1>
      <a href="https://pantheondigitals.com">https://pantheondigitals.com</a>
      <a href="https://linkedin.com/company/pantheon-digitals">LinkedIn</a>
      <h2>Jobs at pantheon digital</h2>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        dehydratedState: {
          queries: [
            {
              queryKey: ['companyPageData', 'pantheon-digital-96-46NMdJSa'],
              state: {
                data: cutshortData,
              },
            },
          ],
        },
      },
    },
    page: '/company/[slug]',
    query: {
      slug: 'pantheon-digital-96-46NMdJSa',
    },
  })}</script>
    </body>
  </html>
`

test('Pantheon Digital verified signals and structured Cutshort payload stay anchored to the official public surfaces', () => {
  assert.equal(SOURCE, 'pantheondigitalpvtltd')
  assert.equal(COMPANY, 'Pantheon Digital Pvt Ltd')
  assert.equal(HOMEPAGE_URL, 'https://pantheondigitals.com/')
  assert.equal(ABOUT_URL, 'https://pantheondigitals.com/About')
  assert.equal(CONTACT_URL, 'https://pantheondigitals.com/Contact_Us')
  assert.equal(CAREERS_URL, 'https://pantheondigitals.com/careers')
  assert.equal(JOBS_URL, 'https://pantheondigitals.com/jobs')
  assert.equal(CUTSHORT_COMPANY_URL, 'https://cutshort.io/company/pantheon-digital-96-46NMdJSa')
  assert.equal(LINKEDIN_COMPANY_URL, 'https://linkedin.com/company/pantheon-digitals')

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(hasOfficialContactSignal(contactHtml), true)
  assert.equal(hasOfficialContactSignal(currentContactHtml), true)
  assert.equal(hasOfficialCutshortSignal(cutshortHtml), true)
  assert.deepEqual(extractCompanyPageData(cutshortHtml), cutshortPageData.pageData)
})

test('run returns normalized Pantheon Digital jobs from the official Cutshort company page', async () => {
  const requestedUrls = []

  const jobs = await createPantheonDigitalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === ABOUT_URL) return aboutHtml
      if (url === CONTACT_URL) return contactHtml
      if (url === CUTSHORT_COMPANY_URL) return cutshortHtml
      if (url === CAREERS_URL || url === JOBS_URL) {
        throw new Error(`HTTP 404 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    ABOUT_URL,
    CONTACT_URL,
    CAREERS_URL,
    JOBS_URL,
    CUTSHORT_COMPANY_URL,
  ])

  assert.deepEqual(jobs, [
    {
      title: 'International Sales Executive',
      company: 'Pantheon Digital Pvt Ltd',
      location: 'Delhi, India',
      city: 'Delhi',
      country: 'India',
      jobId: '68639d50a9c58fa0ff1a5f6d',
      requisitionId: '68639d50a9c58fa0ff1a5f6d',
      sourceUrl: 'https://cutshort.io/job/International-Sales-Executive-Delhi-pantheon-digital-CJhfL7as',
      applyUrl: 'https://cutshort.io/profile/view/j/68639d50a9c58fa0ff1a5f6d',
      employmentType: 'Full-time',
      department: null,
      experienceRequired: '1 - 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['International sales', 'Business Process Outsourcing (BPO)', 'Lead Generation'],
      postingDate: '2025-10-29T08:04:22.045Z',
      closingDate: null,
      jobDescription: 'Sales Role in Australian Energy Process Company: Pantheon Digital Pvt. Ltd Shift Timing: 05:00 Am to 02:00 Pm We at Pantheon Digital are expanding our remote sales team.',
      source: 'pantheondigitalpvtltd',
      link: 'https://cutshort.io/job/International-Sales-Executive-Delhi-pantheon-digital-CJhfL7as',
      scrapedAt: '2026-07-13T00:00:00.000Z',
    },
  ])
})

test('run fails closed when the first-party site or official Cutshort handoff drifts', async () => {
  await assert.rejects(
    createPantheonDigitalScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    createPantheonDigitalScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_URL) return aboutHtml
        if (url === CONTACT_URL) return contactHtml
        if (url === CAREERS_URL) return '<html><body><h1>Now hiring</h1></body></html>'
        if (url === JOBS_URL) throw new Error(`HTTP 404 for ${url}`)
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party jobs surface changed/i,
  )

  await assert.rejects(
    createPantheonDigitalScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === ABOUT_URL) return aboutHtml
        if (url === CONTACT_URL) return contactHtml
        if (url === CAREERS_URL || url === JOBS_URL) {
          throw new Error(`HTTP 404 for ${url}`)
        }
        if (url === CUTSHORT_COMPANY_URL) {
          return cutshortHtml.replace(
            '"website":"https://pantheondigitals.com"',
            '"website":"https://example.com"',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official cutshort surface/i,
  )
})

const runPantheonPayload = (data,options={}) => createPantheonDigitalScraper().run({ ...options, fetchText:async url=>{
  if(url===HOMEPAGE_URL)return homepageHtml
  if(url===ABOUT_URL)return aboutHtml
  if(url===CONTACT_URL)return contactHtml
  if(url===CAREERS_URL||url===JOBS_URL)throw Error('HTTP 404 for '+url)
  return cutshortHtml.replace(JSON.stringify(cutshortData),JSON.stringify({success:true,data:{pageData:data},status:200}))
}})

test('Pantheon excludes explicit foreign jobs and refuses unknown geography instead of appending India',async()=>{
  const data=structuredClone(cutshortPageData.pageData)
  data.companyJobs.jobs[0].locations=['London']
  data.companyJobs.jobs[0].locationsText='London'
  assert.deepEqual(await runPantheonPayload(data),[])
  data.companyJobs.jobs[0].locations=['Remote']
  data.companyJobs.jobs[0].locationsText='Remote'
  await assert.rejects(runPantheonPayload(data),/geography|scope/i)
})

test('Pantheon rejects additional pages, malformed jobs, duplicate IDs and unrelated job owners',async()=>{
  for(const change of [data=>data.companyJobs.totalPages=2,data=>data.companyJobs.jobs.push({...data.companyJobs.jobs[0]}),data=>data.companyJobs.jobs.push({_id:'bad'}),data=>data.companyJobs.jobs[0].companyId.alias='other-company']){
    const data=structuredClone(cutshortPageData.pageData);change(data)
    await assert.rejects(runPantheonPayload(data),/incomplete|pagination|duplicate|identity|malformed/i)
  }
})

test('Pantheon honors cancellation before networking',async()=>{
  const reason=Error('Cancelled Pantheon')
  await assert.rejects(runPantheonPayload(cutshortPageData.pageData,{signal:AbortSignal.abort(reason)}),error=>error===reason)
})
