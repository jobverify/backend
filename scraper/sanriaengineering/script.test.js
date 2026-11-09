import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const loadSanriaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SANRIA Engineering scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="keywords" content="Sanria Engineering, Contact, Steel Structures, Tekla" />
    <meta name="author" content="Sanria Engineering" />
    <title>Sanria - Revolutionizing Engineering</title>
  </head>
  <body>
    <div class="hero-text">
      <h1>Revolutionizing Engineering</h1>
      <p>
        Technology-driven BIM and engineering services company helping customers manage their projects
        better using our software tools and services.
      </p>
    </div>
    <footer>
      <a href="careers.html">Careers</a>
      <a href="https://www.linkedin.com/company/sanria-engineering-ltd/" target="_blank">LinkedIn</a>
    </footer>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="author" content="Sanria Engineering" />
    <title>Contact Us - Sanria - Revolutionizing Engineering</title>
  </head>
  <body>
    <section class="contact-section">
      <div class="section-header">
        <h2>Our Locations</h2>
        <p>Our presence across Bengaluru, Mysuru and Chennai brings together engineering talent and expertise.</p>
      </div>

      <div class="contact-cards">
        <div class="location-card">
          <h4>Bengaluru</h4>
          <p>4th Floor, 30-31, Kothnur Main Rd, Bengaluru, Karnataka 560076</p>
        </div>
        <div class="location-card">
          <h4>Mysuru</h4>
          <p>338, KIADB Industrial Area, Hebbal Industrial Estate, Hebbal, Hebbalu, Karnataka 570016</p>
        </div>
        <div class="location-card">
          <h4>Chennai</h4>
          <p>Western Wing, Ground Floor, Plot No. 3/86, Ambattur Industrial Estate, Chennai - 600058</p>
        </div>
      </div>
    </section>

    <div id="salesModal" class="modal-overlay">
      <div class="contact-region-card">
        <h4>North America, South America, Canada</h4>
        <a href="mailto:habeeb@sanriaengineering.com">habeeb@sanriaengineering.com</a>
      </div>
      <div class="contact-region-card">
        <h4>Asia, Europe and Australia</h4>
        <a href="mailto:jps@sanriaengineering.com">jps@sanriaengineering.com</a>
      </div>
    </div>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="keywords" content="Sanria Engineering, Contact, Steel Structures, Tekla" />
    <meta name="author" content="Sanria Engineering" />
    <title>Careers - Sanria - Revolutionizing Engineering</title>
  </head>
  <body>
    <section class="contact-section">
      <div class="section-header">
        <h2>Join Our Team</h2>
        <p>
          Explore exciting career opportunities at SANRIA. We're looking for talented professionals to join
          our growing team and work on innovative steel structure projects.
        </p>
      </div>

      <div class="contact-cards">
        <div class="contact-card">
          <div class="card-icon">
            <img src="images/contact-mail.png" alt="Sales Icon" />
          </div>
          <h4>Tekla Modelers & Checkers</h4>
          <p>
            We're hiring Senior or Specialist Tekla Modelers & Checkers to join our Mysuru Team.
            Strong experience in Tekla modeling & checking required.
          </p>
          <button class="card-btn" onclick="openPopup()">Apply Now</button>
          <p><strong>Location:</strong> Mysuru <br><strong>Experience:</strong> Senior/Specialist</p>
        </div>

        <div class="contact-card">
          <div class="card-icon">
            <img src="images/contact-mail.png" alt="Support Icon" />
          </div>
          <h4>Help & Support</h4>
          <p>Interested in joining SANRIA but don't see a perfect fit? Send us your resume and we'll keep you in mind for future opportunities.</p>
          <button class="card-btn" onclick="openPopup()">Get in Touch</button>
        </div>
      </div>
    </section>

    <div id="contactPopup" class="popup-overlay">
      <div class="popup-box">
        <h3 class="popup-title">Apply Now</h3>
        <p class="popup-subtitle">
          Take the next step in your career. Fill in the details below and attach your resume — we'll be in touch soon.
        </p>

        <form class="popup-form" id="careerForm">
          <label>First Name <span style="color:#e74c3c;">*</span></label>
          <input type="text" name="first_name" />
          <label>Last Name <span style="color:#e74c3c;">*</span></label>
          <input type="text" name="last_name" />
          <label>Email Address <span style="color:#e74c3c;">*</span></label>
          <input type="email" name="email" />
          <label>Phone Number <span style="color:#e74c3c;">*</span></label>
          <input type="tel" name="phone" />
          <label>Years of Experience <span style="color:#e74c3c;">*</span></label>
          <select name="experience" required>
            <option value="" disabled selected>Select experience</option>
            <option value="0-2">0 – 2 Years</option>
            <option value="3-5">3 – 5 Years</option>
            <option value="6-10">6 – 10 Years</option>
            <option value="10+">10+ Years</option>
          </select>
          <label>Position Applied For <span style="color:#e74c3c;">*</span></label>
          <input type="text" name="position" placeholder="e.g. Tekla Modeler, Structural Engineer..." required />
          <label>Cover Note</label>
          <textarea rows="3" name="cover_note"></textarea>
          <label>Resume / CV Link <span style="color:#e74c3c;">*</span></label>
          <input type="url" name="resume_link" placeholder="Paste your Google Drive or Dropbox link here" required />
          <a href="https://drive.google.com" target="_blank">Google Drive</a>
          <a href="https://www.dropbox.com" target="_blank">Dropbox</a>
          <button type="submit" class="submit-btn" id="sendBtn">Submit Application</button>
        </form>
      </div>
    </div>

    <script>
      const data = {
        access_key: "3557983c-78d5-4c0e-a952-b69cfbc2515d",
        subject: "New Job Application - Sanria Engineering"
      };
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(data)
      });
    </script>
  </body>
</html>
`

test('SANRIA Engineering sentinels recognize the verified homepage, contact page, and careers page', async () => {
  const sanria = await loadSanriaModule()

  assert.equal(sanria.SOURCE, 'sanriaengineering')
  assert.equal(sanria.COMPANY, 'SANRIA Engineering')
  assert.equal(sanria.HOMEPAGE_URL, 'https://www.sanriaengineering.com/')
  assert.equal(sanria.CONTACT_URL, 'https://www.sanriaengineering.com/contact-us.html')
  assert.equal(sanria.CAREERS_URL, 'https://www.sanriaengineering.com/careers.html')
  assert.equal(sanria.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sanria.hasOfficialContactSignal(contactHtml), true)
  assert.equal(sanria.hasOfficialCareersSignal(careersHtml), true)
})

test('SANRIA Engineering extracts only the public first-party opening and ignores the generic support card', async () => {
  const sanria = await loadSanriaModule()

  const officeLocations = sanria.extractOfficeLocations(contactHtml)
  const cards = sanria.extractPublicJobCards(careersHtml)
  const jobs = sanria.extractPublicJobs(careersHtml, contactHtml)

  assert.equal(officeLocations.Mysuru?.state, 'Karnataka')
  assert.equal(cards.length, 1)
  assert.deepEqual(cards[0], {
    title: 'Tekla Modelers & Checkers',
    summary: "We're hiring Senior or Specialist Tekla Modelers & Checkers to join our Mysuru Team. Strong experience in Tekla modeling & checking required.",
    rawLocation: 'Mysuru',
    experienceRequired: 'Senior/Specialist',
    buttonLabel: 'Apply Now',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Tekla Modelers & Checkers',
      company: 'SANRIA Engineering',
      department: null,
      location: 'Mysuru, Karnataka, India',
      city: 'Mysuru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'sanriaengineering-tekla-modelers-checkers-mysuru',
      requisitionId: 'sanriaengineering-tekla-modelers-checkers-mysuru',
      sourceUrl: 'https://www.sanriaengineering.com/careers.html',
      applyUrl: 'https://www.sanriaengineering.com/careers.html',
      employmentType: null,
      experienceRequired: 'Senior/Specialist',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        "We're hiring Senior or Specialist Tekla Modelers & Checkers to join our Mysuru Team. Strong experience in Tekla modeling & checking required.",
        'Location: Mysuru, Karnataka, India.',
        'Experience: Senior/Specialist.',
        'Apply through the official SANRIA Engineering careers page popup form.',
      ].join(' '),
      remoteStatus: null,
    },
  ])

  const normalized = normalizeScrapedJob(jobs[0], {
    source: 'sanriaengineering',
    companyName: 'SANRIA Engineering',
    companyCareerPage: 'https://www.sanriaengineering.com/careers.html',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
  })

  assert.equal(normalized.jobType, 'Unspecified')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.companyDomain, 'sanriaengineering.com')
})

test('SANRIA Engineering run verifies the trusted first-party surfaces and returns the current public opening', async () => {
  const sanria = await loadSanriaModule()
  const requestedUrls = []

  const jobs = await sanria.createSanriaEngineeringScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sanria.HOMEPAGE_URL) return homepageHtml
      if (url === sanria.CONTACT_URL) return contactHtml
      if (url === sanria.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sanria.HOMEPAGE_URL,
    sanria.CONTACT_URL,
    sanria.CAREERS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Tekla Modelers & Checkers',
        company: 'SANRIA Engineering',
        source: 'sanriaengineering',
        link: 'https://www.sanriaengineering.com/careers.html',
        companyCareerPage: 'https://www.sanriaengineering.com/careers.html',
        companyDomain: 'sanriaengineering.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
})

test('SANRIA Engineering fails closed when the verified homepage, contact page, or careers page drift', async () => {
  const sanria = await loadSanriaModule()

  await assert.rejects(
    sanria.createSanriaEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === sanria.HOMEPAGE_URL) {
          return homepageHtml.replace('Revolutionizing Engineering', 'Another Company')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    sanria.createSanriaEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === sanria.HOMEPAGE_URL) return homepageHtml
        if (url === sanria.CONTACT_URL) {
          return contactHtml.replace('Mysuru', 'Dallas')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page/i,
  )

  await assert.rejects(
    sanria.createSanriaEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === sanria.HOMEPAGE_URL) return homepageHtml
        if (url === sanria.CONTACT_URL) return contactHtml
        if (url === sanria.CAREERS_URL) {
          return careersHtml.replace('Apply Now', 'Join Talent Pool')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page|public opening/i,
  )
})
