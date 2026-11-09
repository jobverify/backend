import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/quadeye/script.js')
  } catch {
    assert.fail('Expected QuadEye scraper module at ../../scraper/quadeye/script.js')
  }
}

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Careers - Quadeye</title>
    <meta name="description" content="Careers at Quadeye Securities. Join our Team!" />
  </head>
  <body>
    <main>
      <h1>Become part of our Team</h1>
      <p>Our people make us exceptional</p>
      <div>
        If you have any questions or don't see a role that fits your profile, write to us at
        <a href="mailto:career@quadeye.com">career@quadeye.com</a>
      </div>
      <h3>We are looking for enthusiastic candidates for below profiles!</h3>
      <a href="https://www.quadeye.com/careers/"><span>Check All The Openings</span></a>
      <link
        rel="stylesheet"
        href="https://static.zohocdn.com/recruit/embed_careers_site/css/v1.1/embed_jobs.css"
        type="text/css"
      />
      <div id="rec_job_listing_div"></div>
      <script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://quadeye.zohorecruit.in",
          brand_color:"#6875E2",
          empty_job_msg:"No current Openings"
        });
      </script>
    </main>
  </body>
</html>
`

const CURRENT_JOBS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | quadeye</title>
    <meta name="description" content="Jobs for contacting us." />
    <link rel="canonical" href="https://www.quadeye.com/jobs" />
  </head>
  <body>
    <nav><a href="/career">Careers</a><a href="/contact-us">Contact Us</a></nav>
    <h2>Open Roles</h2><p>Loading roles…</p>
    <a href="mailto:career@quadeye.com">career@quadeye.com</a>
  </body>
</html>
`

const PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at PeoplePlus</title>
    <meta property="og:url" content="https://quadeye.zohorecruit.in/jobs/Careers" />
    <meta property="og:site_name" content="Quadeye" />
  </head>
  <body>
    <input id="pageJson" type="hidden" value="{}" />
    <input id="moduleMeta" type="hidden" value="{}" />
    <input id="jobs" type="hidden" value="[{&quot;id&quot;:&quot;199893000002318440&quot;},{&quot;id&quot;:&quot;199893000002318430&quot;},{&quot;id&quot;:&quot;199893000002318371&quot;}]" />
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Quadeye - Intern - Software Developer (Product) in Gurgaon</title>
  </head>
  <body>
    <main>
      <h1>Intern - Software Developer (Product)</h1>
      <div>Quadeye</div>
      <div>Gurgaon</div>
    </main>
  </body>
</html>
`

const API_PAYLOAD = {
  code: 'success',
  data: [
    {
      id: '199893000002318440',
      Posting_Title: 'Intern - Software Developer (Product)',
      Job_Opening_Name: 'Intern - Software Developer (Product)',
      Industry: 'Quant Firms/HFT',
      Job_Type: 'Internship',
      Work_Experience: '0 - 1 Years',
      Date_Opened: '06/29/2026',
      City: 'Gurgaon',
      State: 'Haryana',
      Country: 'India',
      Job_Description: 'Build and enhance in-house web applications used in high-paced trading environments.',
      Publish: true,
      Is_Locked: false,
      $url:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
    },
    {
      id: '199893000002318430',
      Posting_Title: 'Intern - Systems Engineer',
      Job_Opening_Name: 'Intern - Systems Engineer',
      Industry: 'Quant Firms/HFT',
      Job_Type: 'Internship',
      Work_Experience: '0 - 1 Years',
      Date_Opened: '06/29/2026',
      City: 'Gurgaon',
      State: 'Haryana',
      Country: 'India',
      Job_Description: 'Work on optimizing and designing real-time systems.',
      Publish: true,
      Is_Locked: true,
      $url:
        'https://career.quadeye.com/jobs/Careers/199893000002318430/Intern---Systems-Engineer?source=CareerSite',
    },
    {
      id: '199893000002318371',
      Posting_Title: 'US Counsel',
      Job_Opening_Name: 'US Counsel',
      Industry: 'Legal',
      Job_Type: 'Full time',
      City: 'Austin',
      State: 'Texas',
      Country: 'United States',
      Publish: true,
      Is_Locked: false,
      $url:
        'https://career.quadeye.com/jobs/Careers/199893000002318371/US-Counsel?source=CareerSite',
    },
  ],
}

test('QuadEye helper exports stay pinned to the verified official careers page, Zoho portal, and public API contract', async () => {
  const quadeye = await loadModule()

  assert.equal(quadeye.SOURCE, 'quadeye')
  assert.equal(quadeye.COMPANY, 'QuadEye')
  assert.equal(quadeye.OFFICIAL_BRAND_NAME, 'Quadeye')
  assert.match(quadeye.VERIFIED_ON, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(quadeye.VERIFIED_ON, quadeye.PROVIDER_METADATA.verifiedOn)
  assert.equal(quadeye.HOMEPAGE_URL, 'https://www.quadeye.com/')
  assert.equal(quadeye.CAREERS_PAGE_URL, 'https://www.quadeye.com/careers/')
  assert.equal(quadeye.CAREERS_PORTAL_URL, 'https://quadeye.zohorecruit.in/jobs/Careers/')
  assert.equal(
    quadeye.CAREERS_API_URL,
    'https://quadeye.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(quadeye.hasOfficialCareersPageSignal(CAREERS_PAGE_HTML), true)
  assert.equal(quadeye.hasOfficialCareersPageSignal(CURRENT_JOBS_PAGE_HTML), true)
  assert.equal(quadeye.hasOfficialPortalSignal(PORTAL_HTML), true)
  assert.equal(
    quadeye.hasVerifiedJobDetailPage(DETAIL_HTML, {
      title: 'Intern - Software Developer (Product)',
      sourceUrl:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
    }),
    true,
  )
  assert.deepEqual(quadeye.extractIndiaJobs(API_PAYLOAD), [
    {
      title: 'Intern - Software Developer (Product)',
      company: 'QuadEye',
      department: 'Quant Firms/HFT',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      jobId: '199893000002318440',
      requisitionId: '199893000002318440',
      sourceUrl:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
      applyUrl:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
      employmentType: 'Internship',
      experienceRequired: '0 - 1 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-29T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build and enhance in-house web applications used in high-paced trading environments.',
      remoteStatus: 'On-site',
    },
  ])
})

test('QuadEye run validates the verified first-party page, public portal, API, and sample detail page conservatively', async () => {
  const quadeye = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await quadeye.createQuadEyeScraper({
    now: () => '2026-08-04T09:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === quadeye.CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
      if (url === quadeye.CAREERS_PORTAL_URL) return PORTAL_HTML
      if (
        url
        === 'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite'
      ) {
        return DETAIL_HTML
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return API_PAYLOAD
    },
  })

  assert.deepEqual(requestedTexts, [
    quadeye.CAREERS_PAGE_URL,
    quadeye.CAREERS_PORTAL_URL,
    'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
  ])
  assert.deepEqual(requestedJson, [quadeye.CAREERS_API_URL])
  assert.deepEqual(jobs, [
    {
      jobId: '199893000002318440',
      requisitionId: '199893000002318440',
      title: 'Intern - Software Developer (Product)',
      company: 'QuadEye',
      department: 'Quant Firms/HFT',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      link:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
      sourceUrl:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
      applyUrl:
        'https://career.quadeye.com/jobs/Careers/199893000002318440/Intern---Software-Developer-Product?source=CareerSite',
      source: 'quadeye',
      employmentType: 'Internship',
      experienceRequired: '0 - 1 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-29T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build and enhance in-house web applications used in high-paced trading environments.',
      remoteStatus: 'On-site',
      sourceScopeComplete: false,
      sourceListingComplete: false,
      sourceGlobalJobCount: null,
      sourceIndiaJobCount: null,
      scrapedAt: '2026-08-04T09:30:00.000Z',
    },
  ])
})

test('QuadEye fails closed when the verified first-party page, portal, or API contract drifts', async () => {
  const quadeye = await loadModule()

  await assert.rejects(
    quadeye.createQuadEyeScraper().run({
      fetchText: async (url) => {
        if (url === quadeye.CAREERS_PAGE_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
    }),
    /verified official quadeye careers page/i,
  )

  await assert.rejects(
    quadeye.createQuadEyeScraper().run({
      fetchText: async (url) => {
        if (url === quadeye.CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
        if (url === quadeye.CAREERS_PORTAL_URL) return '<html><body>Unexpected portal</body></html>'
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => API_PAYLOAD,
    }),
    /verified quadeye careers portal/i,
  )

  await assert.rejects(
    quadeye.createQuadEyeScraper().run({
      fetchText: async (url) => {
        if (url === quadeye.CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
        if (url === quadeye.CAREERS_PORTAL_URL) return PORTAL_HTML
        return DETAIL_HTML
      },
      fetchJson: async () => ({ code: 'error', data: null }),
    }),
    /public jobs api/i,
  )
})
