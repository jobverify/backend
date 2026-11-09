import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/seweurodriveindiapvtltd/script.js')
  } catch {
    assert.fail('Expected SEW-Eurodrive India scraper module at ../../scraper/seweurodriveindiapvtltd/script.js')
  }
}

const careersHtml = `
  <html lang="en">
    <head>
      <title>Careers</title>
    </head>
    <body>
      <main>
        <h1>Your career at SEW-EURODRIVE</h1>
        <p>As a leading global specialist in drive technology, we keep the world moving.</p>
        <p>Join us and make your next move with us!</p>
        <h2>Job opportunities</h2>
        <p>Come and join our empowered, motivated, trained and qualified direct sales team.</p>
        <p>Take a look at our current job opportunities.</p>
        <p>You can find a list of current job offers as below:</p>
        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Job Position</th>
              <th>Location</th>
              <th>Vertical</th>
              <th>Job Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Executive/Assistant Manager - Technical Sales</td>
              <td>Sriperumbudur/ Electronic city- Bangalore/Navi Mumbai</td>
              <td>Sales</td>
              <td><a href="https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf">Click here (PDF, 462 KB)</a></td>
            </tr>
            <tr>
              <td>2</td>
              <td>Deputy Manager - Technical Sales( Resident)</td>
              <td>Ludhiana</td>
              <td>Sales</td>
              <td><a href="/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf">click here (PDF, 465 KB)</a></td>
            </tr>
          </tbody>
        </table>
        <p>
          You may park your applications in the below link if you are interested to join us.
          <a href="/meta_seiten/web_online_contact_form_career.html">application form</a>
        </p>
        <a href="/meta_seiten/web_online_contact_form_career.xhtml">Apply now!</a>
        <footer>
          <p>In India, 400 employees are currently working with presence in almost 31 cities.</p>
        </footer>
      </main>
    </body>
  </html>
`

test('extractOpenings parses the verified SEW-EURODRIVE India careers table and shared application handoff', async () => {
  const seweurodrive = await loadModule()

  assert.equal(seweurodrive.CAREERS_URL, 'https://www.seweurodriveindia.com/career/your_career/your_career.html')
  assert.equal(seweurodrive.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(seweurodrive.extractApplicationFormUrl(careersHtml), 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html')
  assert.deepEqual(seweurodrive.extractOpenings(careersHtml), [
    {
      title: 'Executive/Assistant Manager - Technical Sales',
      company: 'SEW-Eurodrive India Pvt Ltd',
      department: 'Sales',
      location: 'Sriperumbudur/ Electronic city- Bangalore/Navi Mumbai, India',
      city: null,
      country: 'India',
      jobId: 'seweurodriveindiapvtltd-executive-assistant-manager-technical-sales-sales-sriperumbudur-electronic-city-bangalore-navi-mumbai',
      requisitionId: 'seweurodriveindiapvtltd-executive-assistant-manager-technical-sales-sales-sriperumbudur-electronic-city-bangalore-navi-mumbai',
      sourceUrl: 'https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf',
      applyUrl: 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SEW-Eurodrive India Pvt Ltd opening for Executive/Assistant Manager - Technical Sales in Sales at Sriperumbudur/ Electronic city- Bangalore/Navi Mumbai, India. Refer to the first-party job description PDF for role details and apply through the official SEW-EURODRIVE India application form.',
    },
    {
      title: 'Deputy Manager - Technical Sales( Resident)',
      company: 'SEW-Eurodrive India Pvt Ltd',
      department: 'Sales',
      location: 'Ludhiana, India',
      city: 'Ludhiana',
      country: 'India',
      jobId: 'seweurodriveindiapvtltd-deputy-manager-technical-sales-resident-sales-ludhiana',
      requisitionId: 'seweurodriveindiapvtltd-deputy-manager-technical-sales-resident-sales-ludhiana',
      sourceUrl: 'https://www.seweurodriveindia.com/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf',
      applyUrl: 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SEW-Eurodrive India Pvt Ltd opening for Deputy Manager - Technical Sales( Resident) in Sales at Ludhiana, India. Refer to the first-party job description PDF for role details and apply through the official SEW-EURODRIVE India application form.',
    },
  ])
})

test('run fetches the official SEW-EURODRIVE India careers page and decorates jobs for persistence', async () => {
  const seweurodrive = await loadModule()
  const requestedUrls = []

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [seweurodrive.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'seweurodriveindiapvtltd')
  assert.equal(jobs[0].link, 'https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run enriches SEW-EURODRIVE jobs from first-party PDF descriptions when public experience is present', async () => {
  const seweurodrive = await loadModule()
  const requestedListingUrls = []
  const requestedDetailUrls = []

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async (url) => {
      requestedListingUrls.push(url)
      return careersHtml
    },
    fetchDocumentText: async (url) => {
      requestedDetailUrls.push(url)

      if (url.includes('12345_Executive_Assistant_Manager_Technical_Sales.pdf')) {
        return `
          Executive/Assistant Manager - Technical Sales
          EXPERIENCE : Minimum 2 years and above in selling similar products.
          RESPONSIBILITIES : Drive technical sales and customer engagement.
        `
      }

      if (url.includes('98765_Deputy_Manager_Technical_Sales_Resident.pdf')) {
        return `
          Deputy Manager - Technical Sales( Resident)
          EXPERIENCE: Min. 3 - 5 years in industrial sales.
          RESPONSIBILITIES : Own resident sales development in the region.
        `
      }

      throw new Error(`Unexpected SEW-EURODRIVE detail URL: ${url}`)
    },
  })

  assert.deepEqual(requestedListingUrls, [seweurodrive.CAREERS_URL])
  assert.deepEqual(requestedDetailUrls, [
    'https://media.sew-eurodrive.com/download/pdf/12345_Executive_Assistant_Manager_Technical_Sales.pdf',
    'https://www.seweurodriveindia.com/download/pdf/98765_Deputy_Manager_Technical_Sales_Resident.pdf',
  ])
  assert.equal(jobs[0].experienceRequired, '2+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].experienceRequired, '3-5 years')
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('run preserves verified-missing public evidence when the first-party PDF omits an experience requirement', async () => {
  const seweurodrive = await loadModule()

  const jobs = await seweurodrive.createSeweurodriveIndiaScraper().run({
    fetchText: async () => careersHtml,
    fetchDocumentText: async (url) => {
      if (url.includes('12345_Executive_Assistant_Manager_Technical_Sales.pdf')) {
        return `
          Executive/Assistant Manager - Technical Sales
          QUALIFICATIONS : Diploma in engineering with strong product knowledge.
          RESPONSIBILITIES : Drive technical sales and customer engagement.
        `
      }

      return ''
    },
  })

  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('extractOpenings rejects an unexpected SEW-EURODRIVE India careers page shape', async () => {
  const seweurodrive = await loadModule()

  assert.equal(seweurodrive.hasOfficialCareersSignal('<main><h1>Careers</h1></main>'), false)
  assert.throws(
    () => seweurodrive.extractOpenings('<main><h1>Careers</h1></main>'),
    /verified official careers surface/i,
  )
})
