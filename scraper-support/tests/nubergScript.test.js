import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Nuberg EPC</title>
  </head>
  <body>
    <section>
      <h2 class="post_title" id="Opportunities"> Current Opportunities:</h2>
      <p>
        If you are ready to transform ambition into achievement:
        <strong>
          Complete our <a href="#career-form-section">Application Form</a>
          or send your resume to <a href="mailto:recruit@nuberg.in">recruit@nuberg.in</a>
        </strong>
      </p>
      <p>
        <h6 style="margin: 8px 0px;">Process Lead / Engineer </h6>
        <strong>Experience : </strong> 5-20 Years <br />
        <strong>Industry :</strong> Chemical Process Plant / Oil &amp; Gas / Refinery / Petrochemical / Fertilizer <br />
        <strong>Location : </strong> HO-Noida <br />
        <strong>Job Description : </strong> <br />
        <ul class="career_list">
          <li>Study, Review and value addition of Basic engineering package in terms of better operability.</li>
          <li>Value addition to BEP with respect to design of Pump and Control Valves.</li>
        </ul>
      </p>
      <div class="apply-section">
        <a href="mailto:recruit@nuberg.in" class="apply-btn">Apply Now</a>
        <p class="apply-email">
          Or email your CV at <a href="mailto:recruit@nuberg.in">recruit@nuberg.in</a>
        </p>
      </div>
      <hr style="margin: 0 0 10px 0;" />
      <p>
        <h6 style="margin: 8px 0px;">PR Executive - Marketing </h6>
        <strong>Experience : </strong> 2-5 Years <br />
        <strong>Education : </strong> PG Diploma in Mass Communications, MBA, Graduate <br />
        <strong>Location : </strong> HO-Noida <br />
        <strong>Job Description : </strong> <br />
        <ul class="career_list">
          <li>Planning, developing and implementing PR strategies for Nuberg.</li>
          <li>Handling social media.</li>
        </ul>
      </p>
      <div class="apply-section">
        <a href="mailto:recruit@nuberg.in" class="apply-btn">Apply Now</a>
        <p class="apply-email">
          Or email your CV at <a href="mailto:recruit@nuberg.in">recruit@nuberg.in</a>
        </p>
      </div>
      <hr style="margin: 0 0 10px 0;" />
      <h2>Application Form</h2>
      <div id="career-form-section">
        <p>Please fill in the details to submit your application</p>
      </div>
    </section>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Career | Nuberg EPC</title>
  </head>
  <body>
    <h2 class="post_title">Current Opportunities:</h2>
    <p>Upload your CV to our talent pool.</p>
  </body>
</html>
`

const loadNubergModule = async () => {
  try {
    return await import('../../scraper/nuberg/script.js')
  } catch {
    assert.fail('Expected Nuberg scraper module at ../../scraper/nuberg/script.js')
  }
}

test('Nuberg scraper helpers stay pinned to the verified first-party current-opportunities HTML contract', async () => {
  const nuberg = await loadNubergModule()

  assert.equal(nuberg.SOURCE, 'nuberg')
  assert.equal(nuberg.COMPANY, 'Nuberg')
  assert.equal(nuberg.OFFICIAL_BRAND_NAME, 'Nuberg EPC')
  assert.equal(nuberg.VERIFIED_ON, '2026-07-17')
  assert.equal(nuberg.HOMEPAGE_URL, 'https://www.nubergepc.com/')
  assert.equal(nuberg.CAREERS_URL, 'https://www.nubergepc.com/career.html')
  assert.equal(nuberg.APPLY_EMAIL, 'recruit@nuberg.in')
  assert.equal(nuberg.APPLY_MAILTO_URL, 'mailto:recruit@nuberg.in')
  assert.equal(nuberg.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.deepEqual(nuberg.extractListings(verifiedCareersHtml), [
    {
      title: 'Process Lead / Engineer',
      experienceRequired: '5-20 Years',
      industry: 'Chemical Process Plant / Oil & Gas / Refinery / Petrochemical / Fertilizer',
      minimumQualification: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      requiredSkills: [
        'Study, Review and value addition of Basic engineering package in terms of better operability.',
        'Value addition to BEP with respect to design of Pump and Control Valves.',
      ],
      jobDescription:
        'Study, Review and value addition of Basic engineering package in terms of better operability. Value addition to BEP with respect to design of Pump and Control Valves.',
      sourceUrl: 'https://www.nubergepc.com/career.html#Opportunities',
      applyUrl: 'mailto:recruit@nuberg.in',
      jobId: 'process-lead-engineer',
      requisitionId: 'process-lead-engineer',
    },
    {
      title: 'PR Executive - Marketing',
      experienceRequired: '2-5 Years',
      industry: null,
      minimumQualification: 'PG Diploma in Mass Communications, MBA, Graduate',
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      requiredSkills: [
        'Planning, developing and implementing PR strategies for Nuberg.',
        'Handling social media.',
      ],
      jobDescription:
        'Planning, developing and implementing PR strategies for Nuberg. Handling social media.',
      sourceUrl: 'https://www.nubergepc.com/career.html#Opportunities',
      applyUrl: 'mailto:recruit@nuberg.in',
      jobId: 'pr-executive-marketing',
      requisitionId: 'pr-executive-marketing',
    },
  ])
})

test('Nuberg run returns live first-party openings from the verified HTML careers surface', async () => {
  const nuberg = await loadNubergModule()
  const requestedUrls = []

  const jobs = await nuberg.createNubergScraper({
    now: () => '2026-07-17T09:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nuberg.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected Nuberg URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [nuberg.CAREERS_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Process Lead / Engineer',
      company: 'Nuberg',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'process-lead-engineer',
      requisitionId: 'process-lead-engineer',
      sourceUrl: 'https://www.nubergepc.com/career.html#Opportunities',
      applyUrl: 'mailto:recruit@nuberg.in',
      employmentType: null,
      experienceRequired: '5-20 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Study, Review and value addition of Basic engineering package in terms of better operability.',
        'Value addition to BEP with respect to design of Pump and Control Valves.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Study, Review and value addition of Basic engineering package in terms of better operability. Value addition to BEP with respect to design of Pump and Control Valves.',
      source: 'nuberg',
      link: 'mailto:recruit@nuberg.in',
      scrapedAt: '2026-07-17T09:30:00.000Z',
    },
    {
      title: 'PR Executive - Marketing',
      company: 'Nuberg',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: 'pr-executive-marketing',
      requisitionId: 'pr-executive-marketing',
      sourceUrl: 'https://www.nubergepc.com/career.html#Opportunities',
      applyUrl: 'mailto:recruit@nuberg.in',
      employmentType: null,
      experienceRequired: '2-5 Years',
      minimumQualification: 'PG Diploma in Mass Communications, MBA, Graduate',
      preferredQualification: null,
      requiredSkills: [
        'Planning, developing and implementing PR strategies for Nuberg.',
        'Handling social media.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Planning, developing and implementing PR strategies for Nuberg. Handling social media.',
      source: 'nuberg',
      link: 'mailto:recruit@nuberg.in',
      scrapedAt: '2026-07-17T09:30:00.000Z',
    },
  ])
})

test('Nuberg fails closed when the verified careers contract drifts or the openings block disappears', async () => {
  const nuberg = await loadNubergModule()

  await assert.rejects(
    nuberg.createNubergScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Nuberg careers page/i,
  )

  await assert.rejects(
    nuberg.createNubergScraper().run({
      fetchText: async () => driftedCareersHtml,
    }),
    /trusted public openings blocks/i,
  )
})
