import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Why Groupon</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="/mission">Our Mission</a>
        <a href="/teams">Our Teams</a>
      </nav>
      <p>We have a presence in Bangalore and Chennai.</p>
      <a href="https://job-boards.eu.greenhouse.io/groupon"><span>Apply now and join the Groupon team!</span></a>
    </main>
  </body>
</html>
`

const VERIFIED_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Groupon</title>
  </head>
  <body>
    <main>
      <a href="https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101">(AI-First) Engineering Manager</a>
      <a href="https://job-boards.eu.greenhouse.io/groupon/jobs/4817345101">Business Development Manager</a>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 4924951101,
      title: '(AI-First) Engineering Manager',
      location: { name: 'Prague' },
      absolute_url: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101',
      requisition_id: 'ENG-4924951101',
      company_name: 'Groupon',
      updated_at: '2026-07-10T11:25:21-04:00',
      content:
        '&lt;p&gt;Lead AI-first engineering efforts for Groupon IQ in a hybrid setup.&lt;/p&gt;&lt;p&gt;7+ years of engineering leadership experience.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
    },
    {
      id: 4817345101,
      title: 'Business Development Manager',
      location: { name: 'Chicago (35 W. Wacker Dr.)' },
      absolute_url: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4817345101',
      requisition_id: 'BD-4817345101',
      company_name: 'Groupon',
      updated_at: '2026-07-14T23:44:14-04:00',
      content:
        '&lt;p&gt;Drive strategic merchant relationships across Chicago.&lt;/p&gt;&lt;p&gt;5+ years of business development experience.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/groupon/script.js')
  } catch {
    assert.fail('Expected Groupon scraper module at ../../scraper/groupon/script.js')
  }
}

test('Groupon helpers stay pinned to the verified first-party careers handoff and official Greenhouse board', async () => {
  const groupon = await loadModule()

  assert.equal(groupon.SOURCE, 'groupon')
  assert.equal(groupon.COMPANY, 'Groupon')
  assert.equal(groupon.OFFICIAL_BRAND_NAME, 'Groupon')
  assert.equal(groupon.VERIFIED_ON, '2026-10-03')
  assert.equal(groupon.CAREERS_URL, 'https://www.grouponcareers.com/')
  assert.equal(groupon.BOARD_URL, 'https://job-boards.eu.greenhouse.io/groupon')
  assert.equal(groupon.GREENHOUSE_JOB_BASE_URL, 'https://job-boards.eu.greenhouse.io/groupon/jobs')
  assert.equal(
    groupon.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/groupon/jobs?content=true',
  )
  assert.equal(groupon.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    groupon.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(
    groupon.extractOfficialBoardUrl(VERIFIED_CAREERS_HTML),
    'https://job-boards.eu.greenhouse.io/groupon',
  )
  assert.deepEqual(groupon.extractVisibleJobUrls(VERIFIED_BOARD_HTML), [
    'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101',
    'https://job-boards.eu.greenhouse.io/groupon/jobs/4817345101',
  ])
  assert.equal(
    groupon.normalizeGreenhouseJobUrl(
      'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101?gh_jid=4924951101',
      4924951101,
    ),
    'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101',
  )

  const jobs = groupon.extractJobsFromGreenhousePayload(GREENHOUSE_PAYLOAD, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      department: job.department,
      postingDate: job.postingDate,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: '(AI-First) Engineering Manager',
        location: 'Prague',
        city: null,
        country: null,
        link: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101',
        applyUrl: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4924951101',
        department: 'Engineering',
        postingDate: null,
        experienceRequired: '7+ years',
      },
      {
        title: 'Business Development Manager',
        location: 'Chicago (35 W. Wacker Dr.)',
        city: null,
        country: null,
        link: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4817345101',
        applyUrl: 'https://job-boards.eu.greenhouse.io/groupon/jobs/4817345101',
        department: 'Sales',
        postingDate: null,
        experienceRequired: '5+ years',
      },
    ],
  )
  assert.equal(jobs[0].source, 'groupon')
  assert.match(jobs[0].jobDescription, /Groupon IQ in a hybrid setup/i)
  assert.match(jobs[1].jobDescription, /merchant relationships across Chicago/i)
})

test('Groupon rejects the obsolete three-request handoff before any legacy API fallback', async () => {
 const groupon = await loadModule(); let jsonReads = 0
 await assert.rejects(groupon.createGrouponScraper().run({fetchText:async()=>VERIFIED_CAREERS_HTML,fetchJson:async()=>{jsonReads++;return GREENHOUSE_PAYLOAD}}),/canonical redirect changed/)
 assert.equal(jsonReads,0)
})

test('Groupon runtime zero cap prevents both legacy and native callbacks', async () => {
 const groupon = await loadModule(); let reads = 0
 const jobs=await groupon.createGrouponScraper().run({maxJobs:0,fetchResponse:()=>{reads++;throw Error('No IO')},fetchText:()=>{reads++;throw Error('No IO')},fetchJson:()=>{reads++;throw Error('No IO')}})
 assert.equal(jobs.length,0);assert.equal(reads,0)
})
