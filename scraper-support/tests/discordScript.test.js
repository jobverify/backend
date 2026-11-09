import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs and Career Opportunities at Discord</title>
  </head>
  <body>
    <h1>Work at Discord</h1>
    <button>See All Jobs</button>
    <section class="jobs-list"></section>
    <script src="https://discord.com/webflow-scripts/careersNew2025.js"></script>
  </body>
</html>
`

const careersScriptJs = `
(() => {
  const DISPLAY_DEPARTMENT_OVERRIDE_ID = 96196709002
  const DISCORD_JOB_BOARDS = ["discord","discordinternational","internationaleor"]
  async function loadJobs() {
    const responses = await Promise.allSettled(
      DISCORD_JOB_BOARDS.map((boardId) => fetch(\`https://api.greenhouse.io/v1/boards/\${boardId}/jobs?content=true\`)),
    )
    const card = document.querySelector('.jobs-list .job-item')?.cloneNode(true)
    card?.setAttribute('href', \`/jobs/\${8433948002}\`)
  }
})()
`

const discordBoardPayload = {
  jobs: [
    {
      id: 8433948002,
      title: 'Account Executive - Tech',
      location: { name: 'San Francisco Bay Area or New York (Remote (U.S.))' },
      absolute_url: 'https://job-boards.greenhouse.io/discord/jobs/8433948002',
      requisition_id: 'R-107179',
      company_name: 'Discord',
      updated_at: '2026-06-22T15:02:20-04:00',
      first_published: '2026-02-24T13:57:34-05:00',
      content:
        '&lt;p&gt;Discord is hiring an Account Executive.&lt;/p&gt;&lt;p&gt;Candidates should bring 6+ years of experience.&lt;/p&gt;',
      departments: [{ id: 4099568002, name: 'Advertising Solutions' }],
      offices: [
        { name: 'New York, NY', location: 'New York, New York, United States' },
        { name: 'San Francisco, CA', location: 'San Francisco, California, United States' },
      ],
      metadata: [
        { id: 96196709002, name: 'Careers Site Department', value: 'Sales & Partnerships' },
      ],
      application_deadline: null,
    },
  ],
}

const internationalBoardPayload = {
  jobs: [
    {
      id: 8498996002,
      title: 'Program Manager, Detection & Enforcement, Counter-Extremism',
      location: { name: 'The Netherlands' },
      absolute_url: 'https://job-boards.greenhouse.io/discordinternational/jobs/8498996002',
      requisition_id: 'R-107246',
      company_name: 'Discord - International',
      updated_at: '2026-06-16T16:06:07-04:00',
      first_published: '2026-04-13T13:44:12-04:00',
      content:
        '&lt;p&gt;This role is based in The Netherlands and asks the successful candidate to come to the Amsterdam office 1 day per week.&lt;/p&gt;&lt;p&gt;Candidates should have 6+ years of experience.&lt;/p&gt;',
      departments: [{ id: 4000669002, name: 'Trust & Safety' }],
      offices: [{ name: 'The Netherlands', location: null }],
      metadata: [{ id: 96196709002, name: 'Careers Site Department', value: null }],
      application_deadline: null,
    },
  ],
}

const eorBoardPayload = {
  jobs: [
    {
      id: 8586840002,
      title: 'Regulatory Counsel, APAC',
      location: { name: 'Australia' },
      absolute_url: 'https://job-boards.greenhouse.io/internationaleor/jobs/8586840002',
      requisition_id: 'R-107318',
      company_name: 'International EOR',
      updated_at: '2026-07-09T12:04:27-04:00',
      first_published: '2026-07-09T12:04:27-04:00',
      content:
        '&lt;p&gt;This is an international position based in Australia employed by an international PEO.&lt;/p&gt;&lt;p&gt;Candidates should have 7+ years of experience.&lt;/p&gt;',
      departments: [{ id: 4095032002, name: 'Legal' }],
      offices: [{ name: 'Remote (International)', location: null }],
      metadata: [{ id: 96196709002, name: 'Careers Site Department', value: null }],
      application_deadline: null,
    },
  ],
}

const loadDiscordModule = async () => {
  try {
    return await import('../../scraper/discord/script.js')
  } catch {
    assert.fail('Expected Discord scraper module at ../../scraper/discord/script.js')
  }
}

test('Discord scraper helpers stay pinned to the verified careers page, careers script, and aggregated Greenhouse board contract', async () => {
  const discord = await loadDiscordModule()

  assert.equal(discord.SOURCE, 'discord')
  assert.equal(discord.COMPANY, 'Discord')
  assert.equal(discord.CAREERS_URL, 'https://discord.com/careers')
  assert.equal(discord.JOBS_REDIRECT_URL, 'https://discord.com/jobs')
  assert.equal(discord.JOB_DETAILS_BASE_URL, 'https://discord.com/jobs/')
  assert.equal(discord.CAREERS_SCRIPT_URL, 'https://discord.com/webflow-scripts/careersNew2025.js')
  assert.deepEqual(discord.GREENHOUSE_BOARD_IDS, [
    'discord',
    'discordinternational',
    'internationaleor',
  ])
  assert.equal(
    discord.buildGreenhouseJobsApiUrl('discord'),
    'https://api.greenhouse.io/v1/boards/discord/jobs?content=true',
  )
  assert.equal(
    discord.buildDiscordJobDetailUrl(8433948002),
    'https://discord.com/jobs/8433948002',
  )
  assert.equal(
    discord.buildGreenhouseApplyUrl('https://job-boards.greenhouse.io/discord/jobs/8433948002'),
    'https://job-boards.greenhouse.io/discord/jobs/8433948002?gh_src=DiscordJobs',
  )
  assert.equal(discord.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(discord.hasVerifiedCareersScriptSignal(careersScriptJs), true)

  const jobs = discord.extractJobsFromGreenhousePayload(discordBoardPayload, {
    boardId: 'discord',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Account Executive - Tech',
    company: 'Discord',
    department: 'Sales & Partnerships',
    location: 'San Francisco Bay Area or New York (Remote (U.S.))',
    city: 'San Francisco Bay Area',
    country: 'United States',
    sourceUrl: 'https://discord.com/jobs/8433948002',
    applyUrl: 'https://job-boards.greenhouse.io/discord/jobs/8433948002?gh_src=DiscordJobs',
    link: 'https://job-boards.greenhouse.io/discord/jobs/8433948002?gh_src=DiscordJobs',
    source: 'discord',
    boardId: 'discord',
    jobId: '8433948002',
    requisitionId: 'R-107179',
    employmentType: null,
    experienceRequired: '6+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-22T15:02:20-04:00',
    closingDate: null,
    remoteStatus: 'Remote',
    jobDescription: 'Discord is hiring an Account Executive. Candidates should bring 6+ years of experience.',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })
})

test('Discord run verifies the official careers page and careers script before aggregating all three Greenhouse boards', async () => {
  const discord = await loadDiscordModule()
  const requested = []

  const jobs = await discord.createDiscordScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === discord.CAREERS_URL) return careersHtml
      if (url === discord.CAREERS_SCRIPT_URL) return careersScriptJs
      throw new Error(`Unexpected Discord fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      if (url === discord.buildGreenhouseJobsApiUrl('discord')) return discordBoardPayload
      if (url === discord.buildGreenhouseJobsApiUrl('discordinternational')) return internationalBoardPayload
      if (url === discord.buildGreenhouseJobsApiUrl('internationaleor')) return eorBoardPayload
      throw new Error(`Unexpected Discord fixture API URL: ${url}`)
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: 'https://discord.com/careers' },
    { type: 'text', url: 'https://discord.com/webflow-scripts/careersNew2025.js' },
    {
      type: 'json',
      url: 'https://api.greenhouse.io/v1/boards/discord/jobs?content=true',
      options: { method: 'GET' },
    },
    {
      type: 'json',
      url: 'https://api.greenhouse.io/v1/boards/discordinternational/jobs?content=true',
      options: { method: 'GET' },
    },
    {
      type: 'json',
      url: 'https://api.greenhouse.io/v1/boards/internationaleor/jobs?content=true',
      options: { method: 'GET' },
    },
  ])

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      boardId: job.boardId,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
      remoteStatus: job.remoteStatus,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: 'Account Executive - Tech',
        boardId: 'discord',
        country: 'United States',
        sourceUrl: 'https://discord.com/jobs/8433948002',
        applyUrl: 'https://job-boards.greenhouse.io/discord/jobs/8433948002?gh_src=DiscordJobs',
        link: 'https://job-boards.greenhouse.io/discord/jobs/8433948002?gh_src=DiscordJobs',
        remoteStatus: 'Remote',
        experienceRequired: '6+ years',
      },
      {
        title: 'Program Manager, Detection & Enforcement, Counter-Extremism',
        boardId: 'discordinternational',
        country: 'The Netherlands',
        sourceUrl: 'https://discord.com/jobs/8498996002',
        applyUrl: 'https://job-boards.greenhouse.io/discordinternational/jobs/8498996002?gh_src=DiscordJobs',
        link: 'https://job-boards.greenhouse.io/discordinternational/jobs/8498996002?gh_src=DiscordJobs',
        remoteStatus: 'Hybrid',
        experienceRequired: '6+ years',
      },
      {
        title: 'Regulatory Counsel, APAC',
        boardId: 'internationaleor',
        country: 'Australia',
        sourceUrl: 'https://discord.com/jobs/8586840002',
        applyUrl: 'https://job-boards.greenhouse.io/internationaleor/jobs/8586840002?gh_src=DiscordJobs',
        link: 'https://job-boards.greenhouse.io/internationaleor/jobs/8586840002?gh_src=DiscordJobs',
        remoteStatus: 'Remote',
        experienceRequired: '7+ years',
      },
    ],
  )
  assert.equal(jobs[0].source, 'discord')
  assert.equal(jobs[0].company, 'Discord')
})

test('Discord fails closed when the verified careers page, careers script, or Greenhouse payload drifts materially', async () => {
  const discord = await loadDiscordModule()

  await assert.rejects(
    discord.createDiscordScraper().run({
      fetchText: async (url) => {
        if (url === discord.CAREERS_URL) {
          return careersHtml.replace('See All Jobs', 'Browse Roles')
        }
        throw new Error(`Unexpected Discord fixture URL: ${url}`)
      },
      fetchJson: async () => discordBoardPayload,
    }),
    /verified Discord careers page/i,
  )

  await assert.rejects(
    discord.createDiscordScraper().run({
      fetchText: async (url) => {
        if (url === discord.CAREERS_URL) return careersHtml
        if (url === discord.CAREERS_SCRIPT_URL) {
          return careersScriptJs.replace('discordinternational', 'discord-global')
        }
        throw new Error(`Unexpected Discord fixture URL: ${url}`)
      },
      fetchJson: async () => discordBoardPayload,
    }),
    /verified Discord careers script/i,
  )

  await assert.rejects(
    discord.createDiscordScraper().run({
      fetchText: async (url) => {
        if (url === discord.CAREERS_URL) return careersHtml
        if (url === discord.CAREERS_SCRIPT_URL) return careersScriptJs
        throw new Error(`Unexpected Discord fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === discord.buildGreenhouseJobsApiUrl('discord')) return { jobs: null }
        if (url === discord.buildGreenhouseJobsApiUrl('discordinternational')) return internationalBoardPayload
        if (url === discord.buildGreenhouseJobsApiUrl('internationaleor')) return eorBoardPayload
        throw new Error(`Unexpected Discord fixture API URL: ${url}`)
      },
    }),
    /Greenhouse jobs payload/i,
  )
})
