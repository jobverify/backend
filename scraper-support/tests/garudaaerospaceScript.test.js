import assert from 'node:assert/strict'
import test from 'node:test'

const loadGarudaAerospaceModule = async () => {
  try {
    return await import('../../scraper/garudaaerospace/script.js')
  } catch {
    assert.fail('Expected Garuda Aerospace scraper module at ../../scraper/garudaaerospace/script.js')
  }
}

const listingsPayload = {
  data: [
    {
      _id: 'job-1',
      jobTitle: 'Drone Pilot',
      department: 'Drone Operations & Training',
      location: 'Chennai',
      type: 'Full Time',
      experience: '2-4 years',
      createdAt: '2026-06-30T10:00:00.000Z',
    },
    {
      _id: 'job-2',
      title: 'Embedded Engineer',
      jobDepartment: 'R&D',
      jobLocation: 'Bangalore',
      employmentType: 'Full Time',
    },
    {
      title: 'Ignore missing id',
      location: 'Chennai',
    },
  ],
}

const dronePilotDetailPayload = {
  data: {
    _id: 'job-1',
    jobTitle: 'Drone Pilot',
    department: 'Drone Operations & Training',
    location: 'Chennai',
    type: 'Full Time',
    experience: '2-4 years',
    createdAt: '2026-06-30T10:00:00.000Z',
    description: `
      <div>
        <p>Operate&nbsp;survey drones across customer sites.</p>
        <p><strong>Follow DGCA safety checklists.</strong></p>
        <script>alert('ignore me')</script>
      </div>
    `,
  },
}

const embeddedEngineerDetailPayload = {
  data: {
    _id: 'job-2',
    title: 'Embedded Engineer',
    jobDepartment: 'R&D',
    jobLocation: 'Bangalore',
    employmentType: 'Full Time',
    jobDescription: `
      <section>
        <p>Build autopilot firmware.</p>
        <ul>
          <li>Work with avionics sensors</li>
          <li>Debug field issues</li>
        </ul>
      </section>
    `,
  },
}

test('Garuda Aerospace uses the verified public listing, detail, and apply URLs', async () => {
  const {
    CAREERS_URL,
    LISTINGS_API_URL,
    buildDetailApiUrl,
    buildApplyUrl,
  } = await loadGarudaAerospaceModule()

  assert.equal(CAREERS_URL, 'https://www.garudaaerospace.com/company/careers')
  assert.equal(LISTINGS_API_URL, 'https://server.garudaaerospace.com/career')
  assert.equal(buildDetailApiUrl('job-1'), 'https://server.garudaaerospace.com/career/job-1')
  assert.equal(buildApplyUrl('job-1'), 'https://www.garudaaerospace.com/company/careers/apply/job-1')
})

test('extractListings keeps valid public API entries and normalizes summary fields', async () => {
  const { extractListings } = await loadGarudaAerospaceModule()

  assert.deepEqual(extractListings(listingsPayload), [
    {
      jobId: 'job-1',
      title: 'Drone Pilot',
      department: 'Drone Operations & Training',
      location: 'Chennai',
      employmentType: 'Full Time',
      experienceRequired: '2-4 years',
      postingDate: '2026-06-30',
    },
    {
      jobId: 'job-2',
      title: 'Embedded Engineer',
      department: 'R&D',
      location: 'Bangalore',
      employmentType: 'Full Time',
      experienceRequired: null,
      postingDate: null,
    },
  ])
})

test('extractJobDetail strips messy admin HTML conservatively into plain text', async () => {
  const { extractJobDetail } = await loadGarudaAerospaceModule()

  assert.deepEqual(extractJobDetail(dronePilotDetailPayload), {
    title: 'Drone Pilot',
    department: 'Drone Operations & Training',
    location: 'Chennai',
    employmentType: 'Full Time',
    experienceRequired: '2-4 years',
    postingDate: '2026-06-30',
    jobDescription: 'Operate survey drones across customer sites. Follow DGCA safety checklists.',
  })
})

test('run fetches the public listings and detail APIs, then decorates Garuda Aerospace jobs', async () => {
  const {
    LISTINGS_API_URL,
    buildDetailApiUrl,
    buildApplyUrl,
    run,
  } = await loadGarudaAerospaceModule()
  const requestedUrls = []

  const jobs = await run({
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === LISTINGS_API_URL) return listingsPayload
      if (url === buildDetailApiUrl('job-1')) return dronePilotDetailPayload
      if (url === buildDetailApiUrl('job-2')) return embeddedEngineerDetailPayload

      throw new Error(`Unexpected Garuda Aerospace fixture URL: ${url}`)
    },
    now: () => '2026-07-09T12:34:56.000Z',
  })

  assert.deepEqual(requestedUrls, [
    LISTINGS_API_URL,
    buildDetailApiUrl('job-1'),
    buildDetailApiUrl('job-2'),
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Drone Pilot',
    company: 'Garuda Aerospace',
    department: 'Drone Operations & Training',
    location: 'Chennai',
    city: 'Chennai',
    state: null,
    country: 'India',
    jobId: 'job-1',
    requisitionId: 'job-1',
    sourceUrl: buildApplyUrl('job-1'),
    applyUrl: buildApplyUrl('job-1'),
    employmentType: 'Full Time',
    experienceRequired: '2-4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: 'Operate survey drones across customer sites. Follow DGCA safety checklists.',
    source: 'garudaaerospace',
    link: buildApplyUrl('job-1'),
    scrapedAt: '2026-07-09T12:34:56.000Z',
  })
  assert.equal(jobs[1].title, 'Embedded Engineer')
  assert.equal(jobs[1].department, 'R&D')
  assert.equal(jobs[1].location, 'Bangalore')
  assert.equal(jobs[1].jobDescription, 'Build autopilot firmware. Work with avionics sensors Debug field issues')
  assert.equal(jobs[1].source, 'garudaaerospace')
  assert.equal(jobs[1].link, buildApplyUrl('job-2'))
  assert.equal(jobs[1].scrapedAt, '2026-07-09T12:34:56.000Z')
})
