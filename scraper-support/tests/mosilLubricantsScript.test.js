import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <html lang="en">
    <head>
      <meta property="og:url" content="https://mosil.com/">
      <link rel="canonical" href="https://mosil.com/">
      <title>Custom & Specialty Lubricants Manufacturer | MOSIL Lubricants</title>
      <script type="application/ld+json">
        {
          "@type": "Organization",
          "name": "MOSIL Lubricants Pvt. Ltd."
        }
      </script>
    </head>
    <body>
      <a href="https://mosil.com/careers">Career</a>
      <h1>Custom & Specialty Lubricants Manufacturer | MOSIL Lubricants</h1>
      <p>Our three advanced manufacturing units two in Navi Mumbai and one in Palghar provides flexible production lines and integrated quality control systems.</p>
      <p>Research & Development & QA Lab</p>
    </body>
  </html>
`

const verifiedCareersHtml = `
  <html lang="en">
    <head>
      <meta property="og:url" content="https://mosil.com/careers">
      <link rel="canonical" href="https://mosil.com/careers">
      <title>Careers - Join Our Team | MOSIL</title>
    </head>
    <body>
      <h2>Fuel Your Future With Us!</h2>
      <form
        id="careerForm"
        method="POST"
        enctype="multipart/form-data"
        data-url="https://mosil.com/ajax/career.php"
      >
        <input type="text" name="name" placeholder="Name" required>
        <select name="position" id="positionSelect" required>
          <option value="" disabled selected>Position</option>
          <option value="Sales Team – PAN India">Sales Team – PAN India</option>
          <option value="Technical Support Team – Navi Mumbai">Technical Support Team – Navi Mumbai</option>
          <option value="RD and QC Team - Navi Mumbai">RD and QC Team - Navi Mumbai</option>
          <option value="Operations Team – Navi Mumbai">Operations Team – Navi Mumbai</option>
          <option value="Accounts and Finance Team – Mumbai">Accounts and Finance Team – Mumbai</option>
          <option value="HR and Admin Team – Navi Mumbai">HR and Admin Team – Navi Mumbai</option>
        </select>
        <input type="file" id="upload" name="resume" class="hidden" accept=".pdf,.doc,.docx">
        <label for="upload" id="fileLabel"><span>Upload</span></label>
        <button type="submit" id="submitBtn">Send</button>
      </form>
    </body>
  </html>
`

const loadMosilModule = async () => {
  try {
    return await import('../../scraper/mosillubricantspvtltd/script.js')
  } catch {
    assert.fail('Expected MOSIL scraper module at ../../scraper/mosillubricantspvtltd/script.js')
  }
}

test('MOSIL scraper recognizes the verified homepage and first-party careers form', async () => {
  const mosil = await loadMosilModule()

  assert.equal(mosil.SOURCE, 'mosillubricantspvtltd')
  assert.equal(mosil.COMPANY, 'Mosil Lubricants Pvt.Ltd.')
  assert.equal(mosil.HOMEPAGE_URL, 'https://mosil.com/')
  assert.equal(mosil.CAREERS_URL, 'https://mosil.com/careers')
  assert.equal(mosil.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mosil.hasOfficialCareersSignal(verifiedCareersHtml), true)

  const jobs = mosil.extractPublicJobs(verifiedCareersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Sales Team',
      'Technical Support Team',
      'RD and QC Team',
      'Operations Team',
      'Accounts and Finance Team',
      'HR and Admin Team',
    ],
  )
  assert.deepEqual(
    jobs.map((job) => job.location),
    [
      'PAN India',
      'Navi Mumbai',
      'Navi Mumbai',
      'Navi Mumbai',
      'Mumbai',
      'Navi Mumbai',
    ],
  )
  assert.equal(jobs[0].department, 'Sales Team')
  assert.equal(jobs[0].applyUrl, 'https://mosil.com/careers')
  assert.equal(jobs[0].sourceUrl, 'https://mosil.com/careers#mosillubricantspvtltd-sales-team-pan-india')
  assert.match(jobs[0].jobDescription, /official MOSIL careers page/i)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('MOSIL scraper returns the public first-party positions from the verified careers surface', async () => {
  const mosil = await loadMosilModule()
  const requestedUrls = []

  const jobs = await mosil.createMosilLubricantsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === mosil.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === mosil.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mosil.HOMEPAGE_URL, mosil.CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'mosillubricantspvtltd')
  assert.equal(jobs[0].company, 'Mosil Lubricants Pvt.Ltd.')
  assert.equal(jobs[0].companyCareerPage, 'https://mosil.com/careers')
  assert.equal(jobs[0].companyDomain, 'mosil.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('MOSIL scraper fails closed when the verified homepage or careers form drifts', async () => {
  const mosil = await loadMosilModule()

  await assert.rejects(
    mosil.createMosilLubricantsScraper().run({
      fetchText: async (url) => {
        if (url === mosil.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mosil.createMosilLubricantsScraper().run({
      fetchText: async (url) => {
        if (url === mosil.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace('Fuel Your Future With Us!', 'Join Us')
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    mosil.createMosilLubricantsScraper().run({
      fetchText: async (url) => {
        if (url === mosil.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          '<option value="HR and Admin Team – Navi Mumbai">HR and Admin Team – Navi Mumbai</option>',
          '',
        )
      },
    }),
    /verified public position options changed shape/i,
  )
})
