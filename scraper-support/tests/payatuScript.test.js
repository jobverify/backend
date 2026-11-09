import assert from 'node:assert/strict'
import test from 'node:test'

const loadPayatuModule = async () => {
  try {
    return await import('../../scraper/payatu/script.js')
  } catch (error) {
    assert.fail(`Expected Payatu scraper module at ../../scraper/payatu/script.js (${error.code || error.message})`)
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Career - Payatu</h1>
      <p>Join a world-class cybersecurity team. Open roles in pentesting, IoT security, vulnerability research & more.</p>
      <a class="elementor-button" href="#career-iframe">View Open Positions</a>
      <iframe class="scroll-pane" id="career-iframe" src="https://payatu.freshteam.com/jobs"></iframe>
    </main>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html>
  <body>
    <div class="job-role-list" data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_1000153740">
          <div class="role-title">
            <h5>
              Consulting
              <span class="mobile-role-count">- 2 Open Roles</span>
            </h5>
          </div>
          <div>
            <div class="job-list">
              <a href="/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network" class="heading" data-portal-title="securityconsultant-redteamandnetwork" data-portal-location="Bengaluru, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Security Consultant - Red Team and Network</div>
                    <div class="job-desc text">Join the Bandit family to assess applications, networks, and cloud environments.</div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Bengaluru, Karnataka
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
              <a href="/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws" class="heading" data-portal-title="cloudsecurityconsultantaws" data-portal-location="Pune, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Cloud Security Consultant (AWS)</div>
                    <div class="job-desc text">Help customers secure cloud-native systems and infrastructure.</div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Pune, Maharashtra
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </li>
        <li data-portal-role="_role_1000153759">
          <div class="role-title">
            <h5>
              Project Management
              <span class="mobile-role-count">- 1 Open Role</span>
            </h5>
          </div>
          <div>
            <div class="job-list">
              <a href="/jobs/zRMDGOc2RApl/project-manager" class="heading" data-portal-title="projectmanager" data-portal-location="Pune, India" data-portal-job-type="2" data-portal-remote-location="false">
                <div class="row">
                  <div class="job-list-info">
                    <div class="job-title">Project Manager</div>
                    <div class="job-desc text">Coordinate delivery for complex customer security engagements.</div>
                  </div>
                  <div class="job-location">
                    <div class="location-info">
                      Pune, Maharashtra
                      <br/>
                      Full Time
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const redTeamDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1 class="brand-color">Security Consultant - Red Team and Network</h1>
    <a class="apply-button" href="#job-application">Apply Now</a>
    <div>
      <div>Are you interested in automating the build and deployment process of the application with ensuring the application security?</div>
      <div><strong>You are a perfect technical fit if:</strong></div>
      <ul>
        <li>Minimum of 3 years in penetration testing or red teaming roles.</li>
        <li>Strong hold on web application security concepts and penetration testing skills.</li>
        <li>Good command of at least one programming language.</li>
      </ul>
      <div><strong>NOTE: This position is open for Pune and Bangalore location.</strong></div>
    </div>
    <h3>Submit Your Application</h3>
  </body>
</html>
`

const cloudSecurityDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1 class="brand-color">Cloud Security Consultant (AWS)</h1>
    <a class="apply-button" href="#job-application">Apply Now</a>
    <div>
      <div>Work with advanced cloud platforms to improve the security posture of modern applications.</div>
      <div><strong>You are a perfect technical fit if:</strong></div>
      <ul>
        <li>5+ years of experience in AWS, Kubernetes, and cloud-native security reviews.</li>
        <li>Strong communication and consulting skills.</li>
      </ul>
      <div><strong>NOTE: This position is open for Pune location.</strong></div>
    </div>
    <h3>Submit Your Application</h3>
  </body>
</html>
`

test('Payatu constants stay pinned to the verified official careers page, embedded Freshteam board, and public detail URL pattern', async () => {
  const payatu = await loadPayatuModule()

  assert.equal(payatu.COMPANY_NAME, 'Payatu')
  assert.equal(payatu.COUNTRY_FILTER, 'India')
  assert.equal(payatu.OFFICIAL_CAREERS_URL, 'https://payatu.ai/career')
  assert.equal(payatu.LISTING_URL, 'https://payatu.freshteam.com/jobs')
  assert.equal(payatu.DETAIL_URL_PATTERN, 'https://payatu.freshteam.com/jobs/{opaque_id}/{slug}')
  assert.equal(payatu.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    payatu.extractFreshteamJobsUrl(officialCareersHtml),
    'https://payatu.freshteam.com/jobs',
  )
  assert.equal(
    payatu.buildDetailUrl('_nYY6ixlfncj', 'security-consultant-red-team-and-network'),
    'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network',
  )
})

test('extractSearchResults parses Payatu Freshteam listings and keeps each public detail page as the apply surface', async () => {
  const payatu = await loadPayatuModule()

  const jobs = payatu.extractSearchResults({
    listingHtml,
    detailHtmlByUrl: {
      'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network': redTeamDetailHtml,
      'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws': cloudSecurityDetailHtml,
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Security Consultant - Red Team and Network',
    company: 'Payatu',
    department: 'Consulting',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '_nYY6ixlfncj',
    requisitionId: '_nYY6ixlfncj',
    sourceUrl: 'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network',
    applyUrl: 'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network',
    employmentType: 'Full-time',
    experienceRequired: '3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Are you interested in automating the build and deployment process of the application with ensuring the application security?',
      'You are a perfect technical fit if:',
      'Minimum of 3 years in penetration testing or red teaming roles.',
      'Strong hold on web application security concepts and penetration testing skills.',
      'Good command of at least one programming language.',
      'NOTE: This position is open for Pune and Bangalore location.',
    ].join(' '),
    remoteStatus: 'On-site',
  })
  assert.deepEqual(jobs[1], {
    title: 'Cloud Security Consultant (AWS)',
    company: 'Payatu',
    department: 'Consulting',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: 'kQkqUxp8-J7s',
    requisitionId: 'kQkqUxp8-J7s',
    sourceUrl: 'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws',
    applyUrl: 'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws',
    employmentType: 'Full-time',
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Work with advanced cloud platforms to improve the security posture of modern applications.',
      'You are a perfect technical fit if:',
      '5+ years of experience in AWS, Kubernetes, and cloud-native security reviews.',
      'Strong communication and consulting skills.',
      'NOTE: This position is open for Pune location.',
    ].join(' '),
    remoteStatus: 'On-site',
  })
})

test('run validates the official Payatu careers handoff, fetches the linked Freshteam board, and decorates jobs', async () => {
  const payatu = await loadPayatuModule()
  const requestedUrls = []

  const jobs = await payatu.createPayatuScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === payatu.OFFICIAL_CAREERS_URL) return officialCareersHtml
      if (url === payatu.LISTING_URL) return listingHtml
      if (url === 'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network') {
        return redTeamDetailHtml
      }
      if (url === 'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws') {
        return cloudSecurityDetailHtml
      }

      throw new Error(`Unexpected Payatu fixture URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    payatu.OFFICIAL_CAREERS_URL,
    payatu.LISTING_URL,
    'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network',
    'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'payatu')
  assert.equal(jobs[0].company, 'Payatu')
  assert.equal(jobs[0].link, 'https://payatu.freshteam.com/jobs/_nYY6ixlfncj/security-consultant-red-team-and-network')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.equal(jobs[1].jobId, 'kQkqUxp8-J7s')
  assert.equal(jobs[1].applyUrl, 'https://payatu.freshteam.com/jobs/kQkqUxp8-J7s/cloud-security-consultant-aws')
  assert.equal(jobs[1].remoteStatus, 'On-site')
})

test('Payatu scraper fails closed when the official careers page stops linking to the verified Freshteam board', async () => {
  const payatu = await loadPayatuModule()

  await assert.rejects(
    payatu.createPayatuScraper().run({
      fetchText: async (url) => {
        if (url === payatu.OFFICIAL_CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://payatu.freshteam.com/jobs',
            'https://jobs.example.com/payatu',
          )
        }

        throw new Error(`Unexpected Payatu fixture URL: ${url}`)
      },
    }),
    /verified official payatu careers handoff/i,
  )
})


const currentPayatuFixtures = async () => {
  const { readFile } = await import('node:fs/promises')
  const get = name => readFile(new URL('./fixtures/payatu/' + name, import.meta.url), 'utf8')
  const official = await get('careers-20261009.html'), board = await get('board-20261009.html')
  const slugs = [...board.matchAll(/<a class="card" href="([^"]+)">/g)].map(m => m[1])
  const details = Object.fromEntries(await Promise.all(slugs.map(async slug => [slug, await get('detail-20261009-' + slug + '.html')])))
  return { official, board, details, slugs }
}
const currentPayatuFetch = (f, overrides = {}) => async url => {
  if (Object.hasOwn(overrides, url)) { if (overrides[url] instanceof Error) throw overrides[url]; return overrides[url] }
  if (url === 'https://payatu.ai/career') return f.official
  if (url === 'https://bandit.fit/') return f.board
  const slug = new URL(url).pathname.slice(1)
  if (new URL(url).origin === 'https://bandit.fit' && f.details[slug]) return f.details[slug]
  throw new Error('Unexpected Payatu request: ' + url)
}
for (const [nativeLocation, expectedLocation] of [['Delhi', 'Delhi, India'], ['Delhi/BLR', 'Delhi / Bangalore, India']]) {
 test(`Payatu accepts employer-board ${nativeLocation} roles with matching detail geography`, async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  f.board = f.board.replaceAll('Pune ·', nativeLocation + ' ·')
  for (const slug of f.slugs) f.details[slug] = f.details[slug].replaceAll('· Pune</span>', '· ' + nativeLocation + '</span>')
  const jobs = await run({ fetchText: currentPayatuFetch(f) })
  const changed = jobs.filter(job => job.city === 'Delhi')
  assert.ok(changed.length > 0)
  assert.ok(changed.every(job => job.country === 'India' && job.location === expectedLocation))
 })
}
test('Payatu follows current employer-linked board and returns all ten active India application pages', async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  const jobs = await run({ fetchText: currentPayatuFetch(f) })
  assert.equal(jobs.length, 10)
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.deepEqual(new Set(jobs.map(j => j.jobId)), new Set(f.slugs))
  assert.ok(jobs.every(j => j.country === 'India' && j.jobDescription.length > 500 && j.applyUrl === j.sourceUrl + '#apply'))
  assert.ok(!jobs.some(j => /test-dont-apply|embedded-security-engineer|grc-compliance-intern|hr-specialist|pre-sales/.test(j.jobId)))
  assert.equal(jobs.find(j => j.jobId === 'sr-hardware-security-consultant').location, 'Remote, India')
  assert.match(jobs.find(j => j.jobId === 'cloud-security-consultant').jobDescription, /Infrastructure.*Code|cloud/i)
})
test('Payatu fails closed when the new public board or detail is unavailable', async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  for (const url of ['https://bandit.fit/', 'https://bandit.fit/radio-frequency']) {
    await assert.rejects(run({ fetchText: currentPayatuFetch(f, { [url]: new Error('HTTP 503') }) }), /HTTP 503/)
  }
})
test('Payatu rejects missing role fields, duplicates, unsupported pagination and empty unsignaled inventory', async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  for (const board of [
    f.board.replace('<h2>IoT Radio Frequency Security Consultant</h2>', '<h2></h2>'),
    f.board.replace('href="cloud-security-consultant"', 'href="radio-frequency"'),
    f.board.replace('</body>', '<a rel="next" href="?page=2">Next</a></body>'),
    '<title>Careers · Payatu Careers</title><h1>Open roles at Payatu</h1><div class="grid"></div>',
  ]) await assert.rejects(run({ fetchText: currentPayatuFetch(f, { 'https://bandit.fit/': board }) }), /inventory|listing|role|pagination/i)
})
test('Payatu validates employer, title, location and application-form identities on each detail', async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  const url = 'https://bandit.fit/radio-frequency', detail = f.details['radio-frequency']
  for (const changed of [
    detail.replace('· Payatu Careers', '· Other Employer'),
    detail.replace('<h1>IoT Radio Frequency Security Consultant</h1>', '<h1>Other role</h1>'),
    detail.replace('action="radio-frequency/apply"', 'action="https://other.example/apply"'),
    detail.replace('<span>· Pune</span>', '<span>· Remote</span>'),
  ]) { assert.notEqual(changed, detail); await assert.rejects(run({ fetchText: currentPayatuFetch(f, { [url]: changed }) }), /detail|identity|location|application/i) }
})
test('Payatu does not infer India for a new Remote-only role and marks configured truncation incomplete', async () => {
  const f = await currentPayatuFixtures(), { run, createPayatuScraper } = await import('../../scraper/payatu/script.js')
  await assert.rejects(run({ fetchText: currentPayatuFetch(f, { 'https://bandit.fit/': f.board.replace('Pune · Consulting', 'Remote · Consulting') }) }), /location|geography/i)
  const jobs = await createPayatuScraper({ maxJobs: 1 }).run({ fetchText: currentPayatuFetch(f) })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].sourceListingComplete, false)
})

test('Payatu accepts the observed static Cloudflare analytics beacon and rejects unknown job-loading scripts', async () => {
  const f = await currentPayatuFixtures(), { run } = await import('../../scraper/payatu/script.js')
  const { readFile } = await import('node:fs/promises')
  const nativeBoard = await readFile(new URL('./fixtures/payatu/board-native-20261009.html', import.meta.url), 'utf8')
  assert.equal((await run({ fetchText: currentPayatuFetch(f, { 'https://bandit.fit/': nativeBoard }) })).length, 10)
  await assert.rejects(run({ fetchText: currentPayatuFetch(f, { 'https://bandit.fit/': f.board.replace('</body>', '<script src="/load-more-jobs.js"></script></body>') }) }), /pagination/i)
})
