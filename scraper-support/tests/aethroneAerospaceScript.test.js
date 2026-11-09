import assert from 'node:assert/strict'
import test from 'node:test'

const loadAethroneAerospaceModule = async () => {
  try {
    return await import('../../scraper/aethroneaerospace/script.js')
  } catch {
    assert.fail('Expected AETHRONE AEROSPACE scraper module at ../../scraper/scraper/aethroneaerospace/script.js')
  }
}

const sampleCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aethrone Aerospace</title>
    <script type="module" crossorigin src="./assets/index-sragv7Q0.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const sampleBundle = `
function vP(){return o.jsx(o.Fragment,{children:o.jsx("div",{className:"inetrnship_page ",children:o.jsxs("div",{className:"container",children:[o.jsx(q,{heading:"Open Lap Internships",subheading:"Industrial experience"}),o.jsxs("p",{className:"fontsecondary ps-0 ps-md-2",children:["At Aethrone Aerospace,we believe in nurturing talent and fostering innovation. Our open lab internship program offers hands-on experience to ",o.jsx("span",{className:"fw-bold",children:"engineering students starting from their 6th semester onwards."})," Whether it's the summer heat or the winter chill, we welcome interns for ",o.jsx("span",{className:"text-primary",children:"duration of 4 to 6 months"})," during both sessions."]}),o.jsxs("div",{className:"row",children:[o.jsx("div",{className:"col-md-6",children:o.jsx("div",{className:"card border-0 mt-1 mt-md-4",children:o.jsxs("div",{className:"card-body1",children:[o.jsx("h5",{className:"Pre-Placement maincolor",children:"Pre-Placement Offer"}),o.jsx("p",{className:"fontsecondary mx-0 mx-md-3 mt-3",children:"Internship performance speaks volumes. At Aethrone Aerospace, we offer Pre-Placement Offers (PPOs) to outstanding interns based on their performance during the internship period. This serves as a pathway for talented individuals to kickstart their careers with us."}),o.jsx("h5",{className:"Pre-Placement maincolor",children:"Diverse verticals"}),o.jsx("p",{className:"fontsecondary mx-0 mx-md-3 mt-3",children:"Interns have the opportunity to explore various verticals within our company. From engineering and design to research and development, there's a place for every passionate individual to contribute and grow."}),o.jsx("div",{children:o.jsx(xl,{text:"Apply Now",to:"/contact-us"})})]})})})]})]})})})}
function xP(){return o.jsxs(o.Fragment,{children:[o.jsx("div",{className:"positions_page py-5",children:o.jsxs("div",{className:"container",children:[o.jsx(q,{heading:"Open Positions",subheading:"Career which might interest you"}),o.jsxs("div",{className:"row",children:[o.jsx("div",{className:"col-sm-6"}),o.jsx("div",{className:"col-sm-6",children:o.jsx("div",{className:"card border-0",children:o.jsxs("div",{className:"card-body1",children:[o.jsx("h4",{className:"Aerosynamic-Design maincolor",children:"Aerodynamic Design Engineer"}),o.jsx("small",{className:"fontfamilyPrimary fontsecondary maincolor",children:"Summary"}),o.jsx("p",{className:"fontsecondary fontfamilySecondary mt-1 mt-md-4",children:"As part of a small aerospace engineering team, you will be responsible for the design and analysis of recovery systems for aerospace applications. This will involve you in the entire recovery system design cycle including conceptual design, mathematical modeling, code-based qualification, testing, and technical documentation."}),o.jsx("p",{className:"maincolor fontsecondary",children:"Explore more job opportunities on our LinkedIn page."}),o.jsxs("div",{className:"d-flex",children:[o.jsx(xl,{text:"Apply Now",to:"/contact-us",className:""}),o.jsxs("a",{href:"https://www.linkedin.com/company/aethrone-aerospace/",target:"_blank",rel:"noopener noreferrer",children:["Linkedin"]})]})]})})})]})]})})]})}
`

test('extractJobsFromBundle maps the AETHRONE AEROSPACE careers bundle into conservative job records', async () => {
  const aethrone = await loadAethroneAerospaceModule()
  const jobs = aethrone.extractJobsFromBundle(sampleBundle)

  assert.equal(aethrone.pageIndicatesCareerShell(sampleCareerHtml), true)
  assert.equal(aethrone.bundleIndicatesCareerContent(sampleBundle), true)
  assert.equal(
    aethrone.extractBundleUrl(sampleCareerHtml),
    'https://aethroneaerospace.com/assets/index-sragv7Q0.js',
  )
  assert.deepEqual(jobs, [
    {
      title: 'Aerodynamic Design Engineer',
      company: 'AETHRONE AEROSPACE',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'aethroneaerospace-aerodynamic-design-engineer',
      requisitionId: 'aethroneaerospace-aerodynamic-design-engineer',
      sourceUrl: 'https://aethroneaerospace.com/career',
      applyUrl: 'https://aethroneaerospace.com/contact-us',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'As part of a small aerospace engineering team, you will be responsible for the design and analysis of recovery systems for aerospace applications. This will involve you in the entire recovery system design cycle including conceptual design, mathematical modeling, code-based qualification, testing, and technical documentation. Explore more job opportunities on the AETHRONE AEROSPACE LinkedIn page. Apply via the AETHRONE AEROSPACE contact page.',
    },
    {
      title: 'Open Lap Internship',
      company: 'AETHRONE AEROSPACE',
      department: 'Internship',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'aethroneaerospace-open-lap-internship',
      requisitionId: 'aethroneaerospace-open-lap-internship',
      sourceUrl: 'https://aethroneaerospace.com/career',
      applyUrl: 'https://aethroneaerospace.com/contact-us',
      employmentType: 'Internship',
      experienceRequired: null,
      minimumQualification: 'Engineering students starting from their 6th semester onwards.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'At AETHRONE AEROSPACE, the open lab internship program offers hands-on experience to engineering students starting from their 6th semester onwards. The internship duration is 4 to 6 months during both sessions. Internship performance may lead to Pre-Placement Offers (PPOs), and interns can explore verticals across engineering, design, research, and development. Apply via the AETHRONE AEROSPACE contact page.',
    },
  ])
})

test('run fetches the AETHRONE AEROSPACE careers shell and bundle and decorates the openings', async () => {
  const aethrone = await loadAethroneAerospaceModule()
  const requestedUrls = []
  const scraper = aethrone.createAethroneAerospaceScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aethrone.CAREER_PAGE_URL) return sampleCareerHtml
      if (url === 'https://aethroneaerospace.com/assets/index-sragv7Q0.js') return sampleBundle
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      aethrone.CAREER_PAGE_URL,
      'https://aethroneaerospace.com/assets/index-sragv7Q0.js',
    ],
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aethroneaerospace')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
