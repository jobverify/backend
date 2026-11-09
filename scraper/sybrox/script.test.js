import assert from 'node:assert/strict'
import test from 'node:test'

const loadSybroxModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sybrox Tech</title>
  </head>
  <body>
    <main>
      <h1>Empowering Businesses with Innovation & Technology</h1>
      <p>Sybrox is a next-generation IT training and career-launch platform built for the real world.</p>
      <p>Paid Internships</p>
      <p>Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.</p>
      <p>careers@sybrox.com</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Innovation. Integrity. Impact.</p>
      <p>Sybrox is an integrated IT services, consulting, and training company that blends innovation with expertise to deliver impactful business and learning solutions.</p>
      <p>We bring together IT services, consulting, training, and staffing under one roof.</p>
      <p>Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.</p>
      <p>careers@sybrox.com</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us</title>
  </head>
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>Let’s Build Something Great Together</p>
      <p>Business Inquiries: info@sybrox.com</p>
      <p>Join Our Team: careers@sybrox.com</p>
      <p>Services Inquiries: services@sybrox.com</p>
      <p>Working Hours: Mon–Sat, 9:00 AM – 6:00 PM IST</p>
      <p>Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>RPO Partner Vacancies</title>
  </head>
  <body>
    <main>
      <h1>RPO Partner Vacancies</h1>
      <p>Discover exciting career opportunities with leading organizations through Sybrox RPO Services.</p>

      <h3>Voice Process – Telesales (Lead Generation)</h3>
      <p>Chennai | Full time | Experience: Freshers & Experienced</p>
      <p>Required Skill: Tamil / Malayalam Communication, Telesales, Lead Generation</p>
      <p>+</p>
      <p>Job: Voice Process – Personal Loan Sales</p>
      <p>Openings: 200 Vacancies</p>
      <h4>Job Description</h4>
      <p>Process Type: Lead Generation – Personal Loan Sales</p>
      <p>Languages Required: Tamil & Malayalam</p>
      <p>Location: Chennai</p>
      <p>Eligibility: 12th Pass / Any Degree (Freshers & Experienced Welcome)</p>
      <p>Shift Timing: 9:30 AM – 6:30 PM</p>
      <p>Week Off: Sunday Fixed</p>
      <p>Benefits: PF, ESIC & Other Company Perks</p>
      <a href="https://forms.gle/o43Zh9YvfH4sRCvo8">Apply Now</a>

      <h3>Non-Voice Process – Data Entry</h3>
      <p>Chennai | Full time | Experience: Freshers & Experienced</p>
      <p>Required Skill: Typing, Data Entry, Attention to Detail</p>
      <p>+</p>
      <p>Job: Data Entry Executive – Poonawalla Finance</p>
      <p>Openings: 50 Vacancies</p>
      <h4>Job Description</h4>
      <p>Company: Poonawalla Finance</p>
      <p>Location: Chennai</p>
      <p>Eligibility: 12th / Any Degree (Freshers & Experienced Welcome)</p>
      <p>Shift Timing: Rotational</p>
      <p>Week Off: Rotational</p>
      <p>Benefits: PF, ESIC & Other Company Perks</p>
      <a href="https://forms.gle/o43Zh9YvfH4sRCvo8">Apply Now</a>

      <p>Sybrox Tech Pvt. Ltd. is a fast-growing IT startup committed to building innovative mobile apps, software solutions and next-generation digital platforms.</p>
      <p>careers@sybrox.com</p>
    </main>
  </body>
</html>
`

test('Sybrox retained legacy parser recognizes its historical first-party RPO surface', async () => {
  const sybrox = await loadSybroxModule()
  assert.ok(sybrox, 'Expected scraper module at ./script.js')

  assert.equal(sybrox.SOURCE, 'sybrox')
  assert.equal(sybrox.COMPANY, 'Sybrox Tech Pvt. Ltd.')
  assert.equal(sybrox.HOMEPAGE_URL, 'https://sybrox.com/')
  assert.equal(sybrox.ABOUT_URL, 'https://sybrox.com/about')
  assert.equal(sybrox.CONTACT_URL, 'https://sybrox.com/contact')
  assert.equal(sybrox.CAREERS_URL, 'https://sybrox.com/rpo%20partner%20vacancies')
  assert.equal(sybrox.APPLY_URL, 'https://forms.gle/o43Zh9YvfH4sRCvo8')
  assert.equal(sybrox.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sybrox.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(sybrox.hasOfficialContactSignal(contactHtml), true)
  assert.equal(sybrox.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(sybrox.extractApplyUrls(careersHtml), ['https://forms.gle/o43Zh9YvfH4sRCvo8'])
})

test('Sybrox retained legacy parser describes historical RPO rows; production never uses this client surface', async () => {
  const sybrox = await loadSybroxModule()
  assert.ok(sybrox, 'Expected scraper module at ./script.js')

  const jobs = sybrox.extractJobs(careersHtml)
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Voice Process – Personal Loan Sales',
    company: 'Sybrox Tech Pvt. Ltd.',
    department: 'Voice Process – Telesales (Lead Generation)',
    location: 'Chennai',
    city: 'Chennai',
    state: null,
    country: 'India',
    jobId: 'sybrox-sybrox-tech-pvt-ltd-voice-process-personal-loan-sales-chennai',
    requisitionId: 'sybrox-sybrox-tech-pvt-ltd-voice-process-personal-loan-sales-chennai',
    sourceUrl: 'https://sybrox.com/rpo%20partner%20vacancies',
    applyUrl: 'https://forms.gle/o43Zh9YvfH4sRCvo8',
    employmentType: 'Full-time',
    experienceRequired: 'Freshers & Experienced',
    minimumQualification: '12th Pass / Any Degree (Freshers & Experienced Welcome)',
    preferredQualification: null,
    requiredSkills: ['Tamil / Malayalam Communication', 'Telesales', 'Lead Generation'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Process Type: Lead Generation – Personal Loan Sales\nLanguages Required: Tamil & Malayalam\nLocation: Chennai\nEligibility: 12th Pass / Any Degree (Freshers & Experienced Welcome)\nShift Timing: 9:30 AM – 6:30 PM\nWeek Off: Sunday Fixed\nBenefits: PF, ESIC & Other Company Perks',
    remoteStatus: 'On-site',
  })

  assert.equal(jobs[1].title, 'Data Entry Executive – Poonawalla Finance')
  assert.equal(jobs[1].company, 'Poonawalla Finance')
  assert.equal(jobs[1].department, 'Non-Voice Process – Data Entry')
  assert.equal(jobs[1].applyUrl, 'https://forms.gle/o43Zh9YvfH4sRCvo8')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].experienceRequired, 'Freshers & Experienced')
  assert.deepEqual(jobs[1].requiredSkills, ['Typing', 'Data Entry', 'Attention to Detail'])
})

test('Sybrox current run does not recover legacy RPO client rows as current employer inventory', async()=>{ const sybrox=await loadSybroxModule();await assert.rejects(sybrox.createSybroxScraper().run({fetchPage:async url=>({status:200,url,html:homepageHtml})}),/employer profile identity/) })
