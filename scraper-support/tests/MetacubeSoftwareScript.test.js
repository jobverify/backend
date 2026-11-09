import assert from 'node:assert/strict'
import test from 'node:test'

const careersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Metacube | Careers</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>EXPERIENCED PROFESSIONALS</h2>
    <p>Open Positions General Application</p>
    <h2>STUDENTS & GRADUATES</h2>
    <h3>What Makes a Metacubian?</h3>
  </body>
</html>
`

const professionalsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Metacube | Careers Professionals</title>
  </head>
  <body>
    <input type="hidden" value="session-token" id="token" />
    <h1>Experienced Professionals</h1>
    <div id="jobTitle"></div>
    <div id="jobDescription"></div>
    <script>
      $.ajax({
        url: 'include/students.php?type=load&id=2',
        beforeSend: function(request) {
          request.setRequestHeader("token", "session-token");
        }
      });
    </script>
    <button>Apply With Naukri.Com</button>
  </body>
</html>
`

const professionalsFeed = {
  Result: 'OK',
  Records: [
    {
      ID: 151,
      TITLE: 'Salesforce Tech Lead',
      SHORT_DESCRIPTION: 'Lead Salesforce delivery for enterprise programs.',
      EXPERIENCE: ' ',
      WORK_LOCATION: ' ',
      DATE: '2023-01-05',
      LONG_DESCRIPTION: `
        <p><strong>Position :</strong> Salesforce Tech Lead<br />
        <strong>Experience :</strong> 8-15 Years<br />
        <strong>Work Location :</strong> Jaipur<br />
        <strong>Education:</strong> B.Tech / MCA</p>
        <p>Lead Salesforce delivery for enterprise programs.</p>
      `,
      APPLY_LINK: 'https://metacube.com/open-position-form.php',
      CONTACT_PERSON: 'Jaipur',
    },
    {
      ID: 152,
      TITLE: 'JAVA DEVELOPER',
      SHORT_DESCRIPTION: 'Build and lead Java web applications.',
      EXPERIENCE: ' ',
      WORK_LOCATION: ' ',
      DATE: '2024-06-13',
      LONG_DESCRIPTION: `
        <p><strong>Position :</strong> Sr. Java Developer<br />
        <strong>Experience :</strong> 5-8 Years<br />
        <strong>Work Location :</strong> Jaipur</p>
        <p>Build and lead Java web applications.</p>
      `,
      APPLY_LINK: ' ',
      CONTACT_PERSON: 'Metacube HR Team',
    },
  ],
  count: '2',
}

const loadModule = async () => {
  try {
    return await import('../../scraper/metacubesoftware/script.js')
  } catch {
    assert.fail('Expected Metacube Software scraper module at ../../scraper/metacubesoftware/script.js')
  }
}

test('Metacube Software helpers stay pinned to the verified professional-feed contract from Monday, August 3, 2026', async () => {
  const metacube = await loadModule()

  assert.equal(metacube.SOURCE, 'metacubesoftware')
  assert.equal(metacube.COMPANY, 'Metacube Software')
  assert.equal(metacube.CAREERS_HUB_URL, 'https://metacube.com/careers.php')
  assert.equal(metacube.CAREERS_URL, 'https://metacube.com/careers-professionals.php')
  assert.equal(metacube.JOBS_API_URL, 'https://metacube.com/include/students.php?type=load&id=2')
  assert.equal(metacube.VERIFIED_ON, '2026-08-03')
  assert.equal(metacube.hasOfficialCareersHubSignal(careersHubHtml), true)
  assert.equal(metacube.hasOfficialProfessionalsPageSignal(professionalsPageHtml), true)
  assert.equal(metacube.extractSessionToken(professionalsPageHtml), 'session-token')
  assert.equal(metacube.hasProfessionalJobsFeedSignal(professionalsFeed), true)
})

test('Metacube Software normalizes professional-feed records into India jobs', async () => {
  const metacube = await loadModule()
  const first = metacube.normalizeProfessionalRecord(professionalsFeed.Records[0], '2026-08-03T00:00:00.000Z')
  const second = metacube.normalizeProfessionalRecord(professionalsFeed.Records[1], '2026-08-03T00:00:00.000Z')

  assert.deepEqual(first, {
    title: 'Salesforce Tech Lead',
    company: 'Metacube Software',
    department: null,
    location: 'Jaipur, India',
    city: 'Jaipur',
    country: 'India',
    jobId: 'metacubesoftware-151',
    requisitionId: '151',
    sourceUrl: 'https://metacube.com/careers-professionals.php',
    applyUrl: 'https://metacube.com/open-position-form.php',
    employmentType: null,
    experienceRequired: '8-15 Years',
    minimumQualification: 'B.Tech / MCA',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2023-01-05',
    closingDate: null,
    jobDescription: [
      'Lead Salesforce delivery for enterprise programs.',
      'Position : Salesforce Tech Lead',
      'Experience : 8-15 Years',
      'Work Location : Jaipur',
      'Education: B.Tech / MCA',
      'Lead Salesforce delivery for enterprise programs.',
    ].join('\n\n'),
    source: 'metacubesoftware',
    link: 'https://metacube.com/open-position-form.php',
    scrapedAt: '2026-08-03T00:00:00.000Z',
  })

  assert.equal(second.title, 'Sr. Java Developer')
  assert.equal(second.location, 'Jaipur, India')
  assert.equal(second.applyUrl, 'https://metacube.com/open-position-form.php')
})

test('Metacube Software returns professional-feed jobs when the verified hub, page, and session feed stay valid', async () => {
  const metacube = await loadModule()
  const requested = []

  const jobs = await metacube.createMetacubeSoftwareScraper({
    now: () => '2026-08-03T00:00:00.000Z',
  }).run({
    fetchCareersHub: async (url) => {
      requested.push(['hub', url])
      return careersHubHtml
    },
    fetchProfessionalsSession: async (url) => {
      requested.push(['session', url])
      return {
        html: professionalsPageHtml,
        token: 'session-token',
        cookies: '__Host-PHPSESSID=abc123',
      }
    },
    fetchProfessionalsFeed: async (request) => {
      requested.push(['feed', request])
      return professionalsFeed
    },
  })

  assert.deepEqual(requested, [
    ['hub', 'https://metacube.com/careers.php'],
    ['session', 'https://metacube.com/careers-professionals.php'],
    ['feed', {
      token: 'session-token',
      cookies: '__Host-PHPSESSID=abc123',
      limit: 6,
      offset: 0,
    }],
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'metacubesoftware')
  assert.equal(jobs[1].title, 'Sr. Java Developer')
})

test('Metacube Software fails closed when the verified hub, professionals page, token, or feed drift', async () => {
  const metacube = await loadModule()

  await assert.rejects(
    metacube.createMetacubeSoftwareScraper().run({
      fetchCareersHub: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchProfessionalsSession: async () => ({ html: professionalsPageHtml, token: 'session-token', cookies: 'a=b' }),
      fetchProfessionalsFeed: async () => professionalsFeed,
    }),
    /verified metacube software careers hub/i,
  )

  await assert.rejects(
    metacube.createMetacubeSoftwareScraper().run({
      fetchCareersHub: async () => careersHubHtml,
      fetchProfessionalsSession: async () => ({ html: '<html><body>Professionals</body></html>', token: 'session-token', cookies: 'a=b' }),
      fetchProfessionalsFeed: async () => professionalsFeed,
    }),
    /verified metacube software professionals page/i,
  )

  await assert.rejects(
    metacube.createMetacubeSoftwareScraper().run({
      fetchCareersHub: async () => careersHubHtml,
      fetchProfessionalsSession: async () => ({ html: professionalsPageHtml, token: null, cookies: '' }),
      fetchProfessionalsFeed: async () => professionalsFeed,
    }),
    /session token and cookie/i,
  )

  await assert.rejects(
    metacube.createMetacubeSoftwareScraper().run({
      fetchCareersHub: async () => careersHubHtml,
      fetchProfessionalsSession: async () => ({ html: professionalsPageHtml, token: 'session-token', cookies: 'a=b' }),
      fetchProfessionalsFeed: async () => ({ Result: 'OK', Records: [], count: '6' }),
    }),
    /trusted first-party jobs contract/i,
  )
})
