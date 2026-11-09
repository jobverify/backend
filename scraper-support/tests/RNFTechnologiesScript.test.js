import assert from 'node:assert/strict'
import test from 'node:test'

const listingsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>| RNF Technologies</title>
  </head>
  <body>
    <main>
      <h1>Current Job Openings</h1>
      <table>
        <thead>
          <tr><th>Job Title</th><th>Location</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/join-our-team/current-openings/react-native-developer">React Native Developer</a></td>
            <td>Noida, UP, India</td>
          </tr>
          <tr>
            <td><a href="/join-our-team/current-openings/react-developer">React Developer</a></td>
            <td>Noida, UP, India</td>
          </tr>
          <tr>
            <td><a href="/join-our-team/current-openings/us-sales-manager">US Sales Manager</a></td>
            <td>Dallas, TX, USA</td>
          </tr>
        </tbody>
      </table>
    </main>
  </body>
</html>
`

const reactNativeDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>React Native Developer | RNF Technologies</title>
  </head>
  <body>
    <nav>Current Openings > React Native Developer</nav>
    <h1>React Native Developer</h1>
    <p>Department: Development</p>
    <p>Relevant Experience: 3+ Years</p>
    <section>
      <h2>Job Description</h2>
      <p>Build React Native apps for enterprise clients.</p>
    </section>
    <section>
      <h2>Skills</h2>
      <ul>
        <li>React Native</li>
        <li>JavaScript</li>
      </ul>
    </section>
    <a href="/join-our-team/current-openings/216/apply">Apply</a>
  </body>
</html>
`

const reactDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>React Developer | RNF Technologies</title>
  </head>
  <body>
    <nav>Current Openings > React Developer</nav>
    <h1>React Developer</h1>
    <p>Development</p>
    <a href="/join-our-team/current-openings/204/apply">Apply</a>
    <section>
      Job Role:
      <ul>
        <li>Understand client requirements and functional specifications</li>
        <li>Write well-designed, testable, efficient code</li>
      </ul>
    </section>
    <section>
      Must Have Skills
      <ul>
        <li>Strong proficiency with JavaScript</li>
        <li>Good knowledge of HTML5 and CSS3</li>
      </ul>
    </section>
    <a href="/join-our-team/current-openings/204/apply">Apply</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rnftechnologies/script.js')
  } catch {
    assert.fail('Expected RNF Technologies scraper module at ../../scraper/rnftechnologies/script.js')
  }
}

test('RNF Technologies keeps the verified first-party current openings table and detail parser pinned', async () => {
  const rnf = await loadModule()
  const listings = rnf.extractJobListings(listingsHtml)
  const detail = rnf.extractJobDetail(reactNativeDetailHtml, listings[0])

  assert.equal(rnf.CAREERS_URL, 'https://rnftechnologies.com/join-our-team/current-openings')
  assert.equal(rnf.hasOfficialDetailSignal(reactDetailHtml, listings[1]), true)
  assert.equal(rnf.hasOfficialListingsSignal(listingsHtml), true)
  assert.deepEqual(
    listings.map((job) => [job.title, job.location, job.sourceUrl]),
    [
      [
        'React Native Developer',
        'Noida, UP, India',
        'https://rnftechnologies.com/join-our-team/current-openings/react-native-developer',
      ],
      [
        'React Developer',
        'Noida, UP, India',
        'https://rnftechnologies.com/join-our-team/current-openings/react-developer',
      ],
    ],
  )
  assert.equal(rnf.hasOfficialDetailSignal(reactNativeDetailHtml, listings[0]), true)
  assert.deepEqual(detail, {
    title: 'React Native Developer',
    company: 'RNF Technologies',
    department: 'Development',
    location: 'Noida, UP, India',
    city: 'Noida',
    country: 'India',
    jobId: 'react-native-developer',
    requisitionId: 'react-native-developer',
    sourceUrl: 'https://rnftechnologies.com/join-our-team/current-openings/react-native-developer',
    applyUrl: 'https://rnftechnologies.com/join-our-team/current-openings/216/apply',
    employmentType: null,
    experienceRequired: '3+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['React Native', 'JavaScript'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build React Native apps for enterprise clients.',
    remoteStatus: 'On-site',
  })
  assert.deepEqual(rnf.extractJobDetail(reactDetailHtml, listings[1]), {
    title: 'React Developer',
    company: 'RNF Technologies',
    department: null,
    location: 'Noida, UP, India',
    city: 'Noida',
    country: 'India',
    jobId: 'react-developer',
    requisitionId: 'react-developer',
    sourceUrl: 'https://rnftechnologies.com/join-our-team/current-openings/react-developer',
    applyUrl: 'https://rnftechnologies.com/join-our-team/current-openings/204/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Strong proficiency with JavaScript', 'Good knowledge of HTML5 and CSS3'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Understand client requirements and functional specifications Write well-designed, testable, efficient code',
    remoteStatus: 'On-site',
  })
})

test('RNF Technologies run decorates verified current-opening jobs from the first-party detail pages', async () => {
  const rnf = await loadModule()
  const requestedUrls = []

  const jobs = await rnf.createRNFTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rnf.CAREERS_URL) return listingsHtml
      if (url === 'https://rnftechnologies.com/join-our-team/current-openings/react-native-developer') {
        return reactNativeDetailHtml
      }
      throw new Error(`Unexpected RNF URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    rnf.CAREERS_URL,
    'https://rnftechnologies.com/join-our-team/current-openings/react-native-developer',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.applyUrl, job.source, job.link, job.scrapedAt]),
    [[
      'React Native Developer',
      'https://rnftechnologies.com/join-our-team/current-openings/216/apply',
      'rnftechnologies',
      'https://rnftechnologies.com/join-our-team/current-openings/216/apply',
      '2026-07-18T00:00:00.000Z',
    ]],
  )
})

test('RNF Technologies fails closed when the verified listings or detail surfaces drift', async () => {
  const rnf = await loadModule()

  await assert.rejects(
    rnf.createRNFTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified rnf technologies current openings surface/i,
  )

  await assert.rejects(
    rnf.createRNFTechnologiesScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === rnf.CAREERS_URL) return listingsHtml
        return reactNativeDetailHtml
          .replace('Job Description', 'Overview')
          .replace('Skills', 'Capabilities')
      },
    }),
    /verified rnf technologies detail page/i,
  )
})
