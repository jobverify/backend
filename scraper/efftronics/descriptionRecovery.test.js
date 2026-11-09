import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPublicListings } from './script.js'

// Reduced markup for the role headings and responsibilities visible on the
// official https://www.efftronics.com/careers page on 2026-10-30. The common
// resume-upload destination supplies no identity or description of its own.
const page = `
  <h2>Current Vacancies</h2>
  <!--
  <h3>Data Scientist</h3><p>B.Tech</p><p>Details</p>
  -->
  <h3>Mechanical Engineer</h3><p>B.Tech/M.Tech (Mechanical)</p><p>Details</p>
  <h3>Solution Support Engineer</h3><p>Diploma/B.Tech (ECE/EEE/EIE)</p><p>Details</p>
  <h3>System Administrator</h3><p>Diploma</p><p>Details</p>
  <h2>Career Development with Efftronics</h2>
  <h2>Mechanical Engineer</h2>
  <h4>Job Location</h4><p>Mangalagiri</p>
  <a href="/resume-upload">Apply Now</a>
  <h3>Job Responsibilities</h3>
  <ul><li>Drawing of 2D and 3D models</li><li>Drafting</li>
  <li>Preparation of production and fabrication documents</li></ul>
  <h3>Eligibility</h3><p>Freshers are preferred</p>
  <h2>PCB Designer</h2><h3>Job Responsibilities</h3>
  <p>Prepare detailed layouts of the printed circuit board and establishes all electrical functionality.</p>
  <h2>Solution Support Engineer</h2>
  <h4>Job Location</h4><p>Anywhere in India</p>
  <h3>Job Responsibilities</h3>
  <p>Analog &amp; Digital Wiring and validation activities.</p>
  <h3>Nature of Job</h3><p>Installation, Servicing and Maintenance.</p>
  <h2>System Administrator</h2>
  <form action="/resume-upload"><label>Name</label><input name="name">
  <label>Email</label><input name="email"><button>Apply Now</button></form>
`

test('Efftronics recovers complete responsibilities for the exact advertised role without requiring an introductory slogan', () => {
  const jobs = extractPublicListings(page)
  const mechanical = jobs.find(job => job.title === 'Mechanical Engineer')
  assert.ok(mechanical)
  assert.match(mechanical.jobDescription, /Drawing of 2D and 3D models/)
  assert.match(mechanical.jobDescription, /Preparation of production and fabrication documents/)
  assert.match(mechanical.jobDescription, /Freshers are preferred/)
  assert.doesNotMatch(mechanical.jobDescription, /printed circuit board|Analog & Digital Wiring/)
  const support = jobs.find(job => job.title === 'Solution Support Engineer')
  assert.match(support.jobDescription, /Analog & Digital Wiring and validation activities/)
  assert.match(support.jobDescription, /Installation, Servicing and Maintenance/)
})

test('Efftronics ignores commented vacancies and keeps qualification text out of role identity', () => {
  assert.deepEqual(extractPublicListings(page).map(job => job.title), [
    'Mechanical Engineer', 'Solution Support Engineer', 'System Administrator',
  ])
})

test('Efftronics leaves a role with only an application form unknown', () => {
  const job = extractPublicListings(page).find(job => job.title === 'System Administrator')
  assert.ok(job)
  assert.equal(job.jobDescription, null)
})

test('Efftronics does not treat a shared company introduction and application fields as a role description', () => {
  const html = page.replace('<form action=',
    '<p>At Efftronics, we create value by solving customer problems through design thinking.</p><form action=')
  const job = extractPublicListings(html).find(job => job.title === 'System Administrator')
  assert.equal(job.jobDescription, null)
})

test('Efftronics retains responsibilities beyond the two introductory paragraphs', () => {
  const html = page.replace(
    '<h3>Job Responsibilities</h3>',
    '<p>At Efftronics, we create value by solving customer problems through design thinking.</p>'
      + '<p>The primary purpose of Mechanical Engineer is to support product design and drafting.</p>'
      + '<h3>Job Responsibilities</h3>',
  )
  const job = extractPublicListings(html).find(job => job.title === 'Mechanical Engineer')
  assert.match(job.jobDescription, /Preparation of production and fabrication documents/)
})

test('Efftronics leaves employment and experience unknown for form-only roles and missing role details', () => {
  for (const html of [page, page.slice(0, page.indexOf('<h2>Mechanical Engineer</h2>'))]) {
    const jobs = extractPublicListings(html)
    const job = jobs.find(row => row.title === 'System Administrator')
    assert.ok(job)
    assert.equal(job.employmentType, null)
    assert.equal(job.experienceRequired, null)
  }
})

test('Efftronics uses only the matched role eligibility for fresher and experience evidence', () => {
  const html = page.replace(
    '<h2>System Administrator</h2>\n  <form',
    '<h2>System Administrator</h2><h3>Job Responsibilities</h3>'
      + '<p>Maintaining and administering computer networks</p>'
      + '<h3>Eligibility</h3><p>Experience preferred</p><form',
  )
  const jobs = extractPublicListings(html)
  assert.equal(jobs.find(job => job.title === 'Mechanical Engineer').experienceRequired, 'Freshers preferred')
  assert.equal(jobs.find(job => job.title === 'System Administrator').experienceRequired, 'Experience preferred')
  assert.doesNotMatch(jobs.find(job => job.title === 'System Administrator').jobDescription, /Name|Email|Apply Now/)
  assert.equal(jobs.find(job => job.title === 'Solution Support Engineer').experienceRequired, null)
  assert.ok(jobs.every(job => job.employmentType === null))
})

test('Efftronics preserves an explicit required experience range instead of defaulting it to Freshers preferred', () => {
  // The range and service agreement are exact eligibility lines from the
  // official Graphic Designer detail; adding an advertised card is a controlled
  // fixture variation, not a claim that this role is currently advertised.
  const html = page.replace('<h2>Career Development with Efftronics</h2>',
    '<h3>Graphic Designer</h3><p>B.Tech</p><p>Details</p><h2>Career Development with Efftronics</h2>')
    + '<h2>Graphic Designer</h2><h3>Job Responsibilities</h3><p>Proofread and check the quality of the graphic work before they go for final printing</p>'
    + '<h3>Eligibility</h3><p>Ready to sign 2.5 years service agreement with the company</p><p>Experience Required : 0-2 years</p>'
  const job = extractPublicListings(html).find(row => row.title === 'Graphic Designer')
  assert.equal(job.experienceRequired, '0-2 years')
  assert.equal(job.employmentType, null)
  assert.match(job.jobDescription, /Experience Required : 0-2 years/)
  const withoutExperience = html.replace('<p>Experience Required : 0-2 years</p>', '')
  const unknown = extractPublicListings(withoutExperience).find(row => row.title === 'Graphic Designer')
  assert.equal(unknown.experienceRequired, null)
})

test('Efftronics keeps a shared introduction and empty responsibilities heading before an application form unknown', () => {
  const html = page.replace('<form action=',
    '<p>At Efftronics, we create value by solving customer problems through design thinking.</p>'
      + '<h3>Job Responsibilities</h3><form action=')
  const job = extractPublicListings(html).find(row => row.title === 'System Administrator')
  assert.equal(job.jobDescription, null)
  assert.equal(job.experienceRequired, null)
})

test('Efftronics requires actual responsibility text before eligibility can establish a role description', () => {
  const html = page.replace('<form action=',
    '<p>At Efftronics, we create value by solving customer problems through design thinking.</p>'
      + '<h3>Job Responsibilities</h3><h3>Eligibility</h3><p>Freshers are preferred</p><form action=')
  const job = extractPublicListings(html).find(row => row.title === 'System Administrator')
  assert.equal(job.jobDescription, null)
  assert.equal(job.experienceRequired, null)
})

test('Efftronics bounds the last role before its footer while preserving genuine eligibility', () => {
  const html = page.replace('<form action=',
    '<h3>Job Responsibilities</h3><p>Maintaining and administering computer networks</p>'
      + '<h3>Eligibility</h3><p>Experience preferred</p>'
      + '<footer>Shared footer Experience Required : 100 years</footer><form action=')
  const job = extractPublicListings(html).find(row => row.title === 'System Administrator')
  assert.match(job.jobDescription, /Maintaining and administering computer networks/)
  assert.match(job.jobDescription, /Eligibility Experience preferred/)
  assert.doesNotMatch(job.jobDescription, /Shared footer|100 years|Name|Email|Apply Now/)
  assert.equal(job.experienceRequired, 'Experience preferred')
})

test('Efftronics excludes application controls and subsequent page copy after genuine role text', () => {
  const html = page.replace('<form action=',
    '<h3>Job Responsibilities</h3><p>Maintaining and administering computer networks</p>'
      + '<h3>Eligibility</h3><p>Experience preferred</p>'
      + '<button>Apply Now</button><p>Shared application page copy</p><form action=')
  const job = extractPublicListings(html).find(row => row.title === 'System Administrator')
  assert.match(job.jobDescription, /Maintaining and administering computer networks/)
  assert.match(job.jobDescription, /Eligibility Experience preferred/)
  assert.doesNotMatch(job.jobDescription, /Apply Now|Shared application page copy|Name|Email/)
  assert.equal(job.experienceRequired, 'Experience preferred')
})
