import assert from 'node:assert/strict'
import test from 'node:test'

const loadCompuageModule = async () => {
  try {
    return await import('../../scraper/compuage/script.js')
  } catch {
    assert.fail('Expected Compuage scraper module at ../../scraper/compuage/script.js')
  }
}

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>OPEN JOB POSITIONS</h2>
      <p>In Talent We Trust!</p>
      <p>We have got some exciting opportunities. All you need to do is reach out!</p>

      <section class="opening">
        <h4>Assistant Manager HR</h4>
        <hr />
        <p>Education Qualification: Human Resources</p>
        <p>Job Profile:</p>
        <ul>
          <li>Establish &amp; implementation of HR policies &amp; procedures.</li>
          <li>Prepare the MIS reports (Weekly, Monthly, quarterly, Annual HR Dashboard).</li>
        </ul>
        <p>Desired Candidate's Profile:</p>
        <ul>
          <li>Human Resources Specialist to plan, lead, direct, develop, and coordinate the policies, activities, and team of the Human Resource department.</li>
          <li>Ensuring legal compliance and implementation of the organisation's mission and talent strategy.</li>
        </ul>
        <p>Experience: 5-8 Years</p>
        <p>Location: Mumbai, Headquarters</p>
        <a href="#apply-form">APPLY NOW</a>
      </section>

      <section class="opening">
        <h4>Territory Manager ( IT Sales)</h4>
        <hr />
        <p>Education Qualification: Graduate / MBA Graduate</p>
        <p>Job Profile:</p>
        <ul>
          <li>Responsible to achieve pre-agreed sales target.</li>
          <li>Promotion of products in the market.</li>
        </ul>
        <p>Desired Candidate's Profile:</p>
        <ul>
          <li>Must possess good communication skills.</li>
          <li>Knowledge of channel / distribution sales.</li>
        </ul>
        <p>Experience: Fresher / 1-3 Years</p>
        <p>Location: Kolhapur, Mangalore, Pune, Ahmedabad, Indore, Jaipur, Lucknow, Bangalore, Chennai, Cochin, Kolkata, Jodhpur</p>
        <a href="#apply-form">APPLY NOW</a>
      </section>

      <section class="opening">
        <h4>Assitant Product Manager :</h4>
        <p>1) Networking</p>
        <p>2) Security Solution &amp; Cloud</p>
        <p>3) Microsoft , O365 &amp; Azure (Cloud)</p>
        <hr />
        <p>Education Qualification: Graduate / MBA Graduate</p>
        <p>Job Profile:</p>
        <ul>
          <li>Responsible to achieve pre-agreed sales target.</li>
          <li>Keeping track of channel sales on daily / weekly basis.</li>
        </ul>
        <p>Desired Candidate's Profile:</p>
        <ul>
          <li>Must possess good communication skills Knowledge of channel / distribution sales.</li>
        </ul>
        <p>Experience: 8 - 10 Years</p>
        <p>Location: Mumbai</p>
        <a href="#apply-form">APPLY NOW</a>
      </section>

      <p>We look for the best talent to join us. To explore career opportunity at Compuage, kindly send your profile on careers@compuageindia.com</p>

      <form id="apply-form">
        <label>Select list</label>
        <select name="position">
          <option>Territory Manager (IT Sales)</option>
          <option>Territory Manager ( Networking , Cloud- Security)</option>
          <option>Pre Sales Manager (Cisco, Extreme)</option>
          <option>Pre Sales Manager (Alcatel-Lucent)</option>
          <option>Assistant Product Manager (Networking)</option>
          <option>Assistant Product Manager (Security Solution &amp; Cloud)</option>
          <option>Assistant Product Manager (Microsoft, O365 &amp; Azure (Cloud))</option>
          <option>Sales Coordinator (Cloud)</option>
          <option>Assistant Credit Manager</option>
        </select>
        <label>Upload Resume</label>
        <button type="submit">Submit</button>
      </form>

      <footer>
        <h5>COMPUAGE INFOCOM LTD</h5>
        <p>D601 Lotus Corporate Park, Goregaon(East), Mumbai - 400063. INDIA</p>
      </footer>
    </main>
  </body>
</html>
`

test('Compuage scraper validates the official careers page and extracts inline openings', async () => {
  const compuage = await loadCompuageModule()

  assert.equal(compuage.SOURCE, 'compuage')
  assert.equal(compuage.COMPANY, 'Compuage Infocom Ltd')
  assert.equal(compuage.CAREERS_URL, 'http://www.compuageindia.com/careers')
  assert.equal(compuage.APPLICATION_EMAIL, 'careers@compuageindia.com')
  assert.equal(compuage.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = compuage.extractJobListings(officialCareersHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Manager HR',
    company: 'Compuage Infocom Ltd',
    department: null,
    location: 'Mumbai, Headquarters, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'assistant-manager-hr',
    requisitionId: 'assistant-manager-hr',
    sourceUrl: 'http://www.compuageindia.com/careers',
    applyUrl: 'http://www.compuageindia.com/careers',
    employmentType: null,
    experienceRequired: '5-8 Years',
    minimumQualification: 'Human Resources',
    preferredQualification: null,
    requiredSkills: [
      'Human Resources Specialist to plan, lead, direct, develop, and coordinate the policies, activities, and team of the Human Resource department.',
      "Ensuring legal compliance and implementation of the organisation's mission and talent strategy.",
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: "Job Profile: Establish & implementation of HR policies & procedures. Prepare the MIS reports (Weekly, Monthly, quarterly, Annual HR Dashboard). Desired Candidate's Profile: Human Resources Specialist to plan, lead, direct, develop, and coordinate the policies, activities, and team of the Human Resource department. Ensuring legal compliance and implementation of the organisation's mission and talent strategy. Apply via the Compuage careers page or careers@compuageindia.com.",
    remoteStatus: 'On-site',
  })

  assert.equal(jobs[1].title, 'Territory Manager (IT Sales)')
  assert.equal(jobs[1].location, 'Kolhapur, Mangalore, Pune, Ahmedabad, Indore, Jaipur, Lucknow, Bangalore, Chennai, Cochin, Kolkata, Jodhpur, India')
  assert.equal(jobs[1].city, 'Kolhapur')
  assert.equal(jobs[1].minimumQualification, 'Graduate / MBA Graduate')
  assert.deepEqual(
    jobs.slice(2).map((job) => job.title),
    [
      'Assitant Product Manager (Networking)',
      'Assitant Product Manager (Security Solution & Cloud)',
      'Assitant Product Manager (Microsoft, O365 & Azure (Cloud))',
    ],
  )
  assert.ok(jobs.every((job) => job.applyUrl === compuage.CAREERS_URL))
  assert.ok(jobs.every((job) => /careers@compuageindia\.com/i.test(job.jobDescription)))
})

test('Compuage run fetches the careers page and decorates the shared scraper metadata', async () => {
  const compuage = await loadCompuageModule()
  const requestedUrls = []

  const jobs = await compuage.createCompuageScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [compuage.CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.deepEqual(jobs[2], {
    title: 'Assitant Product Manager (Networking)',
    company: 'Compuage Infocom Ltd',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'compuage-assitant-product-manager-networking',
    requisitionId: 'compuage-assitant-product-manager-networking',
    sourceUrl: 'http://www.compuageindia.com/careers',
    applyUrl: 'http://www.compuageindia.com/careers',
    employmentType: null,
    experienceRequired: '8 - 10 Years',
    minimumQualification: 'Graduate / MBA Graduate',
    preferredQualification: null,
    requiredSkills: [
      'Must possess good communication skills Knowledge of channel / distribution sales.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: "Job Profile: Responsible to achieve pre-agreed sales target. Keeping track of channel sales on daily / weekly basis. Desired Candidate's Profile: Must possess good communication skills Knowledge of channel / distribution sales. Apply via the Compuage careers page or careers@compuageindia.com.",
    remoteStatus: 'On-site',
    source: 'compuage',
    link: 'http://www.compuageindia.com/careers',
    scrapedAt: jobs[2].scrapedAt,
  })
  assert.match(jobs[2].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('Compuage fails closed when the verified official careers surface changes', async () => {
  const compuage = await loadCompuageModule()

  await assert.rejects(
    compuage.createCompuageScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers surface/i,
  )
})
