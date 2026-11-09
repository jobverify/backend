import assert from 'node:assert/strict'
import test from 'node:test'

const loadSfoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SFO Technologies scraper module at ./script.js')
  }
}

const careersHtml = `
  <main>
    <section>
      <h4>Current Openings</h4>
      <p>Please e-mail your detailed resume to: careers.sfo@nestgroup.net</p>
      <p>Manufacturing Division</p>
      <p>Sl. No. Position Domain Qualification Skillset Experience</p>
      <p>01 Program Manager Electronics B.Tech, MBA Techno commercial skills, Communication skills, Customer Interaction Skills. 2-5 yrs</p>
      <p>02 Engineer - Sourcing Electronics B.Tech, MBA Negotiation Skills, Commodity &amp; component Sourcing Skills, RFQ, Vendor development 2-4 yrs</p>
      <p>Software Division</p>
      <p>Sl No Position Domain Qualification Skillset Experience</p>
      <p>01 Dot Net Developer Aerospace BE/BTech/MTech C#/Asp.net (Web) 2-9Yrs</p>
    </section>
  </main>
`

const careersTableHtml = `
  <main>
    <section>
      <h4>Current Openings</h4>
      <p>Please e-mail your detailed resume to: careers.sfo@nestgroup.net</p>
      <p>Manufacturing Division</p>
      <table>
        <tr>
          <th>Sl. No.</th>
          <th>Position</th>
          <th>Domain</th>
          <th>Qualification</th>
          <th>Skillset</th>
          <th>Experience</th>
        </tr>
        <tr>
          <td>01</td>
          <td>Program Manager</td>
          <td>Electronics</td>
          <td>B.Tech, MBA</td>
          <td>Techno commercial skills, Communication skills, Customer Interaction Skills.</td>
          <td>2-5 yrs</td>
        </tr>
        <tr>
          <td>02</td>
          <td>Engineer - Sourcing</td>
          <td>Electronics</td>
          <td>B.Tech, MBA</td>
          <td>Negotiation Skills, Commodity &amp; component Sourcing Skills, RFQ, Vendor development</td>
          <td>2-4 yrs</td>
        </tr>
      </table>
    </section>
  </main>
`

test('extractOpenings parses the official SFO careers page into conservative India job records', async () => {
  const sfo = await loadSfoModule()

  assert.equal(sfo.CAREER_PAGE_URL, 'https://sfotechnologies.net/about-us/careers/')
  assert.equal(sfo.APPLICATION_EMAIL, 'careers.sfo@nestgroup.net')
  assert.equal(sfo.pageIndicatesJobOpenings(careersHtml), true)

  assert.deepEqual(sfo.extractOpenings(careersHtml), [
    {
      title: 'Program Manager',
      company: 'SFO Technologies',
      department: 'Manufacturing Division',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'sfotechnologies-manufacturing-division-program-manager-01',
      requisitionId: 'sfotechnologies-manufacturing-division-program-manager-01',
      sourceUrl: 'https://sfotechnologies.net/about-us/careers/',
      applyUrl: 'mailto:careers.sfo@nestgroup.net',
      employmentType: null,
      experienceRequired: '2-5 yrs',
      minimumQualification: 'B.Tech, MBA',
      preferredQualification: null,
      requiredSkills: [
        'Techno commercial skills',
        'Communication skills',
        'Customer Interaction Skills',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SFO Technologies opening for Program Manager in Manufacturing Division. Domain: Electronics. Qualification: B.Tech, MBA. Experience: 2-5 yrs. Skills: Techno commercial skills, Communication skills, Customer Interaction Skills. Apply by emailing careers.sfo@nestgroup.net.',
    },
    {
      title: 'Engineer - Sourcing',
      company: 'SFO Technologies',
      department: 'Manufacturing Division',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'sfotechnologies-manufacturing-division-engineer-sourcing-02',
      requisitionId: 'sfotechnologies-manufacturing-division-engineer-sourcing-02',
      sourceUrl: 'https://sfotechnologies.net/about-us/careers/',
      applyUrl: 'mailto:careers.sfo@nestgroup.net',
      employmentType: null,
      experienceRequired: '2-4 yrs',
      minimumQualification: 'B.Tech, MBA',
      preferredQualification: null,
      requiredSkills: [
        'Negotiation Skills',
        'Commodity & component Sourcing Skills',
        'RFQ',
        'Vendor development',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SFO Technologies opening for Engineer - Sourcing in Manufacturing Division. Domain: Electronics. Qualification: B.Tech, MBA. Experience: 2-4 yrs. Skills: Negotiation Skills, Commodity & component Sourcing Skills, RFQ, Vendor development. Apply by emailing careers.sfo@nestgroup.net.',
    },
    {
      title: 'Dot Net Developer',
      company: 'SFO Technologies',
      department: 'Software Division',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'sfotechnologies-software-division-dot-net-developer-01',
      requisitionId: 'sfotechnologies-software-division-dot-net-developer-01',
      sourceUrl: 'https://sfotechnologies.net/about-us/careers/',
      applyUrl: 'mailto:careers.sfo@nestgroup.net',
      employmentType: null,
      experienceRequired: '2-9Yrs',
      minimumQualification: 'BE/BTech/MTech',
      preferredQualification: null,
      requiredSkills: ['C#/Asp.net (Web)'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SFO Technologies opening for Dot Net Developer in Software Division. Domain: Aerospace. Qualification: BE/BTech/MTech. Experience: 2-9Yrs. Skills: C#/Asp.net (Web). Apply by emailing careers.sfo@nestgroup.net.',
    },
  ])
})

test('extractOpenings parses the current table-style SFO openings layout into India job records', async () => {
  const sfo = await loadSfoModule()

  assert.deepEqual(sfo.extractOpenings(careersTableHtml), [
    {
      title: 'Program Manager',
      company: 'SFO Technologies',
      department: 'Manufacturing Division',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'sfotechnologies-manufacturing-division-program-manager-01',
      requisitionId: 'sfotechnologies-manufacturing-division-program-manager-01',
      sourceUrl: 'https://sfotechnologies.net/about-us/careers/',
      applyUrl: 'mailto:careers.sfo@nestgroup.net',
      employmentType: null,
      experienceRequired: '2-5 yrs',
      minimumQualification: 'B.Tech, MBA',
      preferredQualification: null,
      requiredSkills: [
        'Techno commercial skills',
        'Communication skills',
        'Customer Interaction Skills',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SFO Technologies opening for Program Manager in Manufacturing Division. Domain: Electronics. Qualification: B.Tech, MBA. Experience: 2-5 yrs. Skills: Techno commercial skills, Communication skills, Customer Interaction Skills. Apply by emailing careers.sfo@nestgroup.net.',
    },
    {
      title: 'Engineer - Sourcing',
      company: 'SFO Technologies',
      department: 'Manufacturing Division',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'sfotechnologies-manufacturing-division-engineer-sourcing-02',
      requisitionId: 'sfotechnologies-manufacturing-division-engineer-sourcing-02',
      sourceUrl: 'https://sfotechnologies.net/about-us/careers/',
      applyUrl: 'mailto:careers.sfo@nestgroup.net',
      employmentType: null,
      experienceRequired: '2-4 yrs',
      minimumQualification: 'B.Tech, MBA',
      preferredQualification: null,
      requiredSkills: [
        'Negotiation Skills',
        'Commodity & component Sourcing Skills',
        'RFQ',
        'Vendor development',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SFO Technologies opening for Engineer - Sourcing in Manufacturing Division. Domain: Electronics. Qualification: B.Tech, MBA. Experience: 2-4 yrs. Skills: Negotiation Skills, Commodity & component Sourcing Skills, RFQ, Vendor development. Apply by emailing careers.sfo@nestgroup.net.',
    },
  ])
})

test('run fetches the official SFO careers page and decorates jobs for persistence', async () => {
  const sfo = await loadSfoModule()
  const requestedUrls = []

  const jobs = await sfo.createSfoTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [sfo.CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sfotechnologies')
  assert.equal(jobs[0].link, 'mailto:careers.sfo@nestgroup.net')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run falls back to a browser-backed fetch when direct requests fail certificate validation', async () => {
  const sfo = await loadSfoModule()
  const browserUrls = []

  const jobs = await sfo.createSfoTechnologiesScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed | unable to verify the first certificate')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(browserUrls, [sfo.CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sfotechnologies')
  assert.equal(jobs[0].link, 'mailto:careers.sfo@nestgroup.net')
})

test('extractOpenings rejects an unexpected SFO careers page shape', async () => {
  const sfo = await loadSfoModule()

  assert.equal(sfo.pageIndicatesJobOpenings('<main><h1>Careers</h1></main>'), false)
  assert.throws(
    () => sfo.extractOpenings('<main><h1>Careers</h1></main>'),
    /expected Current Openings section/i,
  )
})
