import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SRM Tech | Global Partner for Digital &amp; Mobility Solutions</title>
  </head>
  <body>
    <h2>Careers With Us</h2>
    <a href="https://careers.srmtech.com/jobs/Careers">Open Positions</a>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Job Opportunities | SRM Technologies</title>
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{&quot;detail&quot;:{&quot;meta&quot;:{&quot;title&quot;:&quot;Careers | Job Opportunities | SRM Technologies&quot;}}}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" id="jobs" value="[]">
    <a href="https://careers.srmtech.com/jobs/Careers">View Openings</a>
    <p>SRM Technologies</p>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      var jobs = JSON.parse('[{\\x22Remote_Job\\x22:false,\\x22Posting_Title\\x22:\\x22IT Infrastructure (L2/Subject matter Expert)\\x22,\\x22Job_Opening_Name\\x22:\\x22IT Infrastructure (L2/Subject matter Expert)\\x22,\\x22City\\x22:\\x22Chennai\\x22,\\x22State\\x22:\\x22Tamil Nadu\\x22,\\x22Country\\x22:\\x22India\\x22,\\x22Industry\\x22:\\x22Technology\\x22,\\x22Job_Type\\x22:\\x22Full time\\x22,\\x22Date_Opened\\x22:\\x222026-07-21\\x22,\\x22Work_Experience\\x22:\\x225-8 years\\x22,\\x22Job_Description\\x22:\\x22<span id=\\\\\\x22spandesc\\\\\\x22><p>Manage enterprise IT infrastructure with 5+ years of experience in L2 support.</p><p>Lead incident management and platform operations.</p></span>\\x22}]');
    </script>
  </body>
</html>
`

const linuxDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      var jobs = JSON.parse('[{\\x22Remote_Job\\x22:false,\\x22Posting_Title\\x22:\\x22Linux Embedded Computer Vision Developer\\x22,\\x22Job_Opening_Name\\x22:\\x22Linux Embedded Computer Vision Developer\\x22,\\x22City\\x22:\\x22Perungudi\\x22,\\x22State\\x22:\\x22Tamil Nadu\\x22,\\x22Country\\x22:\\x22India\\x22,\\x22Industry\\x22:\\x22IT Services\\x22,\\x22Job_Type\\x22:\\x22Full time\\x22,\\x22Date_Opened\\x22:\\x222025-03-18\\x22,\\x22Job_Description\\x22:\\x22<span id=\\\\\\x22spandesc\\\\\\x22><p style=\\\\\\x22margin\\-top:0px\\\\\\x22><span lang=\\\\\\x22EN\\-IN\\\\\\x22>10.Hands on knowledge\\\\\\\\experience on\\\\ncamera\\/computer vision pipeline, development, porting and optimization<\\\\\\/span><br\\/><\\\\\\/p><\\\\\\/span><br\\/>\\x22}]');
    </script>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'IT Infrastructure (L2/Subject matter Expert)',
      Job_Opening_Name: 'IT Infrastructure (L2/Subject matter Expert)',
      Job_Type: 'Full time',
      Industry: 'Technology',
      Country: 'India',
      City: 'Chennai',
      State: 'Tamil Nadu',
      Publish: true,
      Is_Locked: false,
      Remote_Job: false,
      id: '664168000021350264',
      $url: 'https://careers.srmtech.com/jobs/Careers/664168000021350264/IT-Infrastructure-L2-Subject-matter-Expert?source=CareerSite',
    },
    {
      Posting_Title: 'Technical Program Manager (US)',
      Job_Opening_Name: 'Technical Program Manager (US)',
      Job_Type: 'Full time',
      Industry: 'Technology',
      Country: 'United States',
      City: 'North America',
      Publish: true,
      Is_Locked: false,
      id: '664168000021675544',
      $url: 'https://careers.srmtech.com/jobs/Careers/664168000021675544/Technical-Program-Manager-US?source=CareerSite',
    },
    {
      Posting_Title: 'Senior Full Stack AI Engineer',
      Job_Opening_Name: 'Senior Full Stack AI Engineer',
      Job_Type: 'Full time',
      Industry: 'Technology',
      Country: '',
      City: '',
      Publish: true,
      Is_Locked: false,
      Remote_Job: 'Yes',
      id: '664168000021974833',
      $url: 'https://careers.srmtech.com/jobs/Careers/664168000021974833/Senior-Full-Stack-AI-Engineer?source=CareerSite',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/srmtechnologiespvtltd/script.js')
  } catch {
    assert.fail('Expected SRM Technologies Pvt.Ltd scraper module at ../../scraper/srmtechnologiespvtltd/script.js')
  }
}

test('SRM Technologies Pvt.Ltd helpers stay pinned to the verified homepage handoff and public Zoho board', async () => {
  const srm = await loadModule()

  assert.equal(srm.hasOfficialHomepageCareersSignal(homepageHtml), true)
  assert.equal(srm.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(srm.extractIndiaJobs(apiPayload), [
    {
      title: 'IT Infrastructure (L2/Subject matter Expert)',
      company: 'SRM Technologies Pvt.Ltd',
      department: 'Technology',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: '664168000021350264',
      requisitionId: '664168000021350264',
      sourceUrl: 'https://careers.srmtech.com/jobs/Careers/664168000021350264/IT-Infrastructure-L2-Subject-matter-Expert?source=CareerSite',
      applyUrl: 'https://careers.srmtech.com/jobs/Careers/664168000021350264/IT-Infrastructure-L2-Subject-matter-Expert?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '',
      closingDate: null,
      jobDescription: '',
      remoteStatus: 'On-site',
    },
  ])
})

test('SRM Technologies Pvt.Ltd extracts the embedded Zoho job detail payload from the public detail page', async () => {
  const srm = await loadModule()
  const listing = srm.extractIndiaJobs(apiPayload)[0]
  const detail = srm.extractJobDetail(detailHtml, listing)

  assert.equal(detail.title, 'IT Infrastructure (L2/Subject matter Expert)')
  assert.equal(detail.location, 'Chennai, Tamil Nadu, India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5-8 years')
  assert.match(detail.jobDescription, /5\+ years of experience in L2 support/i)
  assert.equal(detail.publicExperienceChecked, true)
})

test('SRM Technologies Pvt.Ltd decodes Zoho detail payloads that contain malformed legacy backslash runs', async () => {
  const srm = await loadModule()
  const listing = srm.extractIndiaJobs(apiPayload)[0]
  const detail = srm.extractJobDetail(linuxDetailHtml, listing)

  assert.equal(srm.extractEmbeddedJobs(linuxDetailHtml).length, 1)
  assert.equal(detail.title, 'Linux Embedded Computer Vision Developer')
  assert.match(detail.jobDescription, /camera\/computer vision pipeline/i)
  assert.equal(detail.publicExperienceChecked, true)
})

test('SRM Technologies Pvt.Ltd run validates the public board and maps India jobs', async () => {
  const srm = await loadModule()
  const requestedUrls = []

  const jobs = await srm.createSrmTechnologiesPvtLtdScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === srm.CAREERS_URL) {
        return homepageHtml
      }

      if (url === srm.CAREERS_PORTAL_URL) {
        return portalHtml
      }

      if (url === apiPayload.data[0].$url) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, srm.CAREERS_API_URL)
      return apiPayload
    },
    now: () => '2026-08-05T01:23:45.000Z',
  })

  assert.deepEqual(requestedUrls, [
    srm.CAREERS_URL,
    srm.CAREERS_PORTAL_URL,
    srm.CAREERS_API_URL,
    apiPayload.data[0].$url,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'srmtechnologiespvtltd')
  assert.equal(jobs[0].experienceRequired, '5-8 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-05T01:23:45.000Z')
})

test('SRM Technologies Pvt.Ltd fails closed when the homepage handoff, public board, or India jobs drift away', async () => {
  const srm = await loadModule()

  await assert.rejects(
    srm.createSrmTechnologiesPvtLtdScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => apiPayload,
    }),
    /verified srm technologies homepage/i,
  )

  await assert.rejects(
    srm.createSrmTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === srm.CAREERS_URL) return homepageHtml
        return '<html><body>No public board markers</body></html>'
      },
      fetchJson: async () => apiPayload,
    }),
    /public careers portal/i,
  )

  await assert.rejects(
    srm.createSrmTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === srm.CAREERS_URL) return homepageHtml
        return portalHtml
      },
      fetchJson: async () => ({ code: 'success', data: [apiPayload.data[1]] }),
    }),
    /trusted india jobs/i,
  )
})
