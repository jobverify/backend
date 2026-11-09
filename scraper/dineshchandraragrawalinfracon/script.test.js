import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
  <html>
    <body>
      <h1>DINESHCHANDRA R. AGRAWAL INFRACON PVT. LTD.</h1>
      <p>
        Dineshchandra R. Agrawal Infracon Private Limited, which has been operating
        successfully over five decades, spearheaded its way in the Infrastructure sector of India.
      </p>
      <p>
        The fundamental premise of the Company is built on integrity, commitment to quality and excellence.
      </p>
      <a href="https://www.draipl.com/careers.html">Careers</a>
      <a href="mailto:info@draipl.com">info@draipl.com</a>
    </body>
  </html>
`

const CURRENT_HOMEPAGE_HTML = `
  <html>
    <head>
      <title>DRA | We build future - Dineshchandra R. Agrawal Infracon Pvt. Ltd.</title>
    </head>
    <body>
      <p>Our Vision for better tomorrow</p>
      <h1>DINESHCHANDRA R. AGRAWAL INFRACON PVT. LTD.</h1>
      <h2>About Dineshchandra R. Agrawal Infracon Pvt. Ltd.</h2>
      <p>
        The fundamental premise of the Company is built on integrity, commitment to quality and excellence.
      </p>
      <a href="https://www.draipl.com/about-us.html">View More</a>
      <a href="careers.html">Careers</a>
      <a href="mailto:info@draipl.com">info@draipl.com</a>
    </body>
  </html>
`

const CAREERS_URL = 'https://www.draipl.com/careers.html'

const CAREERS_HTML = `
  <html>
    <head>
      <title>DRA | We build future - Dineshchandra R. Agrawal Infracon Pvt. Ltd.</title>
    </head>
    <body>
      <h1>Careers</h1>
      <p>Currently, we are looking for applicants for the following positions.</p>

      <section class="job-opening">
        <p>Position: Project Manager</p>
        <p>Experience: 15 – 20 Years</p>
        <p>Location: Tezpur – Assam</p>
        <p>Description: BE / B.Tech in Civil Engg. 15-20 yrs Exp. In Large Building / Pr-Engineered Buildings and having knowledge of Electo – Mechanical items etc.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Sr. Engineer</p>
        <p>Experience: 06-08 Years</p>
        <p>Location: Tezpur – Assam</p>
        <p>Description: BE/Diploma in Civil Engg. with 06-08 yrs Exp. in Large Buildings / Pr-Engineered Buildings with Electro – Mechanical Items</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: HVAC Engineer</p>
        <p>Experience: 07-10 Years</p>
        <p>Location: Tezpur – Assam</p>
        <p>Description: BE/Diploma in Mech.Engg. with 07-10 yrs Exp.in Large Air Conditioning system with Chiller Plant/ Ductable AC / Piping Installation/Commissioning</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: MEP Engineer</p>
        <p>Experience: 03-05 Years</p>
        <p>Location: Tezpur – Assam</p>
        <p>Description: BE/Diploma in Electrical / Mechanical Engg. with 03-05 yrs Exp.As MEP Engineer with knowledge of electro-mechanical items</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Interface / MEP Manager</p>
        <p>Experience: 03 – 10 Years</p>
        <p>Location: Ahmedabad – Metro Project</p>
        <p>Description: BE – Electrical having in-depth knowledge for Electrical, BMS (Building Management System), Signaling &amp; Telecommunication, Fire Alarm, Fire Fighting, PA, HVAC, CCTV, Access &amp; Radio Control Systems required on a typical Metro Rail Station</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Survey Engineer</p>
        <p>Experience: 5 Years +</p>
        <p>Location: -</p>
        <p>Description: -</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: BIM (Building Information Modelling) Expert</p>
        <p>Experience: -</p>
        <p>Location: Head Office</p>
        <p>Description: -</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: AutoCAD Professional</p>
        <p>Experience: 3 Years +</p>
        <p>Location: -</p>
        <p>Description: -</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Purchase Executive</p>
        <p>Experience: 5 Years +</p>
        <p>Location: Ahmedabad</p>
        <p>Description: Past working experience in infrastructural professional environment required.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Deputy Project Manager – Structural</p>
        <p>Experience: 8 Years + with BE or 12 Years + with Diploma</p>
        <p>Location: -</p>
        <p>Description: Past working experience in infrastructural professional environment required with same position experience for minimum 3 Years +</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Deputy Project Manager – Highway</p>
        <p>Experience: 8 Years + with BE or 12 Years + with Diploma</p>
        <p>Location: -</p>
        <p>Description: Past working experience in infrastructural professional environment required.with same position experience for minimum 3 Years +</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Structure Engineer</p>
        <p>Experience: 4 Years + with BE or 6 Years + with Diploma</p>
        <p>Location: -</p>
        <p>Description: Past working experience in infrastructural professional environment required.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Highway Engineer</p>
        <p>Experience: 4 Years + with BE or 6 Years + with Diploma</p>
        <p>Location: -</p>
        <p>Description: Past working experience in infrastructural professional environment required.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Lab Incharge</p>
        <p>Experience: 8 Years + with BE or 10 Years + with Diploma</p>
        <p>Location: -</p>
        <p>Description: Past working experience in infrastructural professional environment required.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>
      <section class="job-opening">
        <p>Position: Personal Assistant to Executive Director</p>
        <p>Experience: 3 Years +</p>
        <p>Location: -</p>
        <p>Description: Having good command of letter drafting, MIS, Checking and daily communication, Appointment management, Hotel Booking, Ticket Booking, Documentation filling etc.</p>
        <a href="${CAREERS_URL}">Apply Now</a>
      </section>

      <h4>Please fill your Details</h4>
      <select id="position">
        <option>Select Position</option>
        <option>Project Manager</option>
        <option>Sr. Engineer</option>
        <option>HVAC Engineer</option>
        <option>MEP Engineer</option>
        <option>Interface / MEP Manager</option>
        <option>Survey Engineer</option>
        <option>BIM (Building Information Modelling) Expert</option>
        <option>AutoCAD Professional</option>
        <option>Purchase Executive</option>
        <option>Deputy Project Manager – Structural</option>
        <option>Deputy Project Manager – Highway</option>
        <option>Structure Engineer</option>
        <option>Highway Engineer</option>
        <option>Lab Incharge</option>
        <option>Personal Assistant to Executive Director</option>
      </select>
      <p>Upload Your Resume</p>
      <button>Send</button>
    </body>
  </html>
`

const CURRENT_CAREERS_HTML = CAREERS_HTML
  .replace('<h1>Careers</h1>', '<h2 class="page-title">Careers</h2>')
  .replace(
    'Currently, we are looking for applicants for the following positions.',
    'Currently, we are looking for applicants for the following<br>positions.',
  )
  .replace(
    'Description: BE / B.Tech in Civil Engg. 15-20 yrs Exp. In Large Building / Pr-Engineered Buildings and having knowledge of Electo â€“ Mechanical items etc.',
    'Description: BE / B.Tech in Civil Engg. 15-20<br>yrs Exp. In Large Building / Pr-Engineered Buildings and having<br>knowledge of Electo â€“ Mechanical items etc.',
  )
  .replace(
    'Position: BIM (Building Information Modelling) Expert',
    'Position: BIM (Building Information Modelling)<br>Expert',
  )
  .replace(
    'Position: Personal Assistant to Executive Director',
    'Position: Personal Assistant to Executive<br>Director',
  )
  .replaceAll(
    'Experience: 8 Years + with BE or 12 Years + with Diploma',
    'Experience: 8 Years + with BE or 12 Years + with<br>Diploma',
  )
  .replaceAll('<p>Position:', '<p><strong>Position:</strong> ')
  .replaceAll('<p>Experience:', '<p><strong>Experience:</strong> ')
  .replaceAll('<p>Location:', '<p><strong>Location:</strong> ')
  .replaceAll('<p>Description:', '<p><strong>Description:</strong> ')
  .replaceAll(`href="${CAREERS_URL}"`, 'href="#test-modal" class="popup-modal"')

const EXPECTED_TITLES = [
  'Project Manager',
  'Sr. Engineer',
  'HVAC Engineer',
  'MEP Engineer',
  'Interface / MEP Manager',
  'Survey Engineer',
  'BIM (Building Information Modelling) Expert',
  'AutoCAD Professional',
  'Purchase Executive',
  'Deputy Project Manager - Structural',
  'Deputy Project Manager - Highway',
  'Structure Engineer',
  'Highway Engineer',
  'Lab Incharge',
  'Personal Assistant to Executive Director',
]

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected DRA Infracon scraper module at ./script.js')
  }
}

test('DRA Infracon scraper constants stay pinned to the verified first-party homepage and careers page', async () => {
  const dra = await loadModule()

  assert.equal(dra.SOURCE, 'dineshchandraragrawalinfracon')
  assert.equal(dra.COMPANY, 'Dineshchandra R. Agrawal Infracon Private Limited')
  assert.equal(dra.HOMEPAGE_URL, 'https://www.draipl.com/')
  assert.equal(dra.CAREERS_URL, CAREERS_URL)
  assert.equal(dra.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(dra.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
  assert.equal(dra.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('DRA Infracon extracts the verified public first-party openings from the careers page', async () => {
  const dra = await loadModule()

  const jobs = dra.extractPublicListings(CAREERS_HTML)

  assert.equal(jobs.length, EXPECTED_TITLES.length)
  assert.deepEqual(jobs.map((job) => job.title), EXPECTED_TITLES)
  const {rawNativeRoleEvidence,...firstJob}=jobs[0]
  assert.equal(rawNativeRoleEvidence.nativeRequisitionId,null)
  assert.deepEqual(firstJob, {
    title: 'Project Manager',
    company: 'Dineshchandra R. Agrawal Infracon Private Limited',
    department: null,
    location: 'Tezpur - Assam',
    city: 'Tezpur',
    state: 'Assam',
    country: null,
    jobId: 'dineshchandraragrawalinfracon-project-manager',
    requisitionId: null,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: '15 - 20 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'BE / B.Tech in Civil Engg. 15-20 yrs Exp. In Large Building / Pr-Engineered Buildings and having knowledge of Electo - Mechanical items etc.',
  })
  assert.equal(jobs[5].location, null)
  assert.equal(jobs[5].jobDescription, null)
  assert.equal(jobs[6].location, 'Head Office')
  assert.equal(jobs[8].city, 'Ahmedabad')
  assert.equal(jobs.at(-1)?.title, 'Personal Assistant to Executive Director')
})

test('DRA Infracon extracts the current careers layout with inline strong labels', async () => {
  const dra = await loadModule()

  const jobs = dra.extractPublicListings(CURRENT_CAREERS_HTML)

  assert.equal(jobs.length, EXPECTED_TITLES.length)
  assert.deepEqual(jobs.map((job) => job.title), EXPECTED_TITLES)
  assert.equal(jobs[0].experienceRequired, '15 - 20 Years')
  assert.equal(jobs[0].location, 'Tezpur - Assam')
})

test('DRA Infracon run verifies the homepage handoff and decorates public jobs for persistence', async () => {
  const dra = await loadModule()
  const requestedUrls = []

  const jobs = await dra.createDineshchandraRAgrawalInfraconScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === dra.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === dra.CAREERS_URL) return CAREERS_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [dra.HOMEPAGE_URL, dra.CAREERS_URL])
  assert.equal(jobs.length, EXPECTED_TITLES.length)
  assert.equal(jobs[0].source, 'dineshchandraragrawalinfracon')
  assert.equal(jobs[0].link, CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T12:00:00.000Z')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'draipl.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
})

test('DRA Infracon fails closed when the verified homepage or careers jobs surface changes materially', async () => {
  const dra = await loadModule()

  await assert.rejects(
    dra.createDineshchandraRAgrawalInfraconScraper().run({
      fetchText: async (url) => {
        if (url === dra.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        return CAREERS_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    dra.createDineshchandraRAgrawalInfraconScraper().run({
      fetchText: async (url) => {
        if (url === dra.HOMEPAGE_URL) return HOMEPAGE_HTML
        return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
      },
    }),
    /verified public careers page|public job openings/i,
  )
})
