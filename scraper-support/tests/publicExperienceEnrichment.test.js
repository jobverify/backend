import assert from 'node:assert/strict'
import test from 'node:test'

import {
  enrichJobWithPublicExperience,
  inferExperienceFromPublicPageHtml,
} from '../utils/publicExperienceEnrichment.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { extractTextFromPdfBuffer } from '../shared/pdfText.js'

const buildPdfBuffer = (text) => {
  const objects = []
  const addObject = (body) => {
    objects.push(body)
    return objects.length
  }

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const contentStream = `BT\n/F1 18 Tf\n72 100 Td\n(${String(text ?? '').replace(/[\\()]/g, '\\$&')}) Tj\nET`
  const contentId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`)
  const pageId = addObject(`<< /Type /Page /Parent 4 0 R /MediaBox [0 0 300 144] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`)
  const pagesId = addObject(`<< /Type /Pages /Count 1 /Kids [${pageId} 0 R] >>`)
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, 'utf8')
}

test('inferExperienceFromPublicPageHtml captures labeled required experience from a Virtusa-style page', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Cloud Engineer',
    company: 'Virtusa',
    applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Cloud Engineer</h1>
        <section>
          <h6>Required Experience</h6>
          <div>5</div>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, '5 years')
})

test('inferExperienceFromPublicPageHtml prefers a matching heading over a generic page title', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Java FSD',
    company: 'Virtusa',
    applyUrl: 'https://www.virtusa.com/careers/job-search/in/pune/core-tech-java/java-fsd/creq260017',
    sourceUrl: 'https://www.virtusa.com/careers/job-search/in/pune/core-tech-java/java-fsd/creq260017',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>creq260017</title>
      </head>
      <body>
        <h1>Java FSD</h1>
        <section>
          <h2>Key Job Details</h2>
          <div>Required Experience</div>
          <div>7</div>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.title, 'Java FSD')
  assert.equal(enriched.experienceRequired, '7 years')
})

test('inferExperienceFromPublicPageHtml captures years of experience from an Oracle-style public job page', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Advanced Software Engr',
    company: 'Honeywell',
    applyUrl: 'https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/150196',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h2>Qualifications</h2>
        <ul>
          <li>10-15 years of experience leading user research and/or experience design.</li>
        </ul>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, '10-15 years')
})

test('inferExperienceFromPublicPageHtml ignores company-history text that is not a job requirement', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Cloud Engineer',
    company: 'Quest Global',
    applyUrl: 'https://careers.example.com/jobs/cloud-engineer',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <p>At Quest Global, with over 25 years as an engineering services provider, we believe in the power of doing things differently.</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
})

test('inferExperienceFromPublicPageHtml ignores generic page summaries when the page lacks job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: '.Net FSD SE 4 228912',
    company: 'Example Consulting',
    applyUrl: 'https://jobs.example.com/careers/job/228912',
    jobDescription: null,
    description: null,
  }, `
    <html>
      <head>
        <title>Careers Portal</title>
        <meta name="description" content="Read our privacy, compliance, and cookie policies." />
      </head>
      <body>
        <p>Welcome to our careers portal.</p>
      </body>
    </html>
  `)

  assert.equal(enriched.title, '.Net FSD SE 4 228912')
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml keeps job-detail meta summaries when body text is empty', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Architect - Viewer experience',
    company: 'Hotstar',
    applyUrl: 'https://jiostar.wd102.myworkdayjobs.com/JioStar/job/Bengaluru/Architect---Viewer-experience_JR10275',
    engineeringDomain: 'Unknown',
  }, `
    <html>
      <head>
        <meta
          name="description"
          content="Job Summary: As an Architect in the Foundations Org at JioHotstar, you will define the long-term technical vision for core platforms. Key responsibilities: design scalable backend systems, platform services, and React-based frontend experiences across the viewer experience stack."
        />
      </head>
      <body></body>
    </html>
  `)

  const normalized = normalizeScrapedJob(enriched, { source: 'hotstar.workday' })

  assert.match(enriched.jobDescription || '', /viewer experience stack/i)
  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('inferExperienceFromPublicPageHtml captures Workday experience from job-detail meta summaries when the body is sparse', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Hardware & Silicon Validation Engg',
    company: 'Marvell',
    applyUrl: 'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers/job/Pune/Hardware---Silicon-Validation-Engg_2601982',
    sourceUrl: 'https://marvell.wd1.myworkdayjobs.com/en-US/MarvellCareers/job/Pune/Hardware---Silicon-Validation-Engg_2601982',
    experienceRequired: null,
    jobDescription: null,
    description: null,
  }, `
    <html>
      <head>
        <meta property="og:title" content="Hardware &amp; Silicon Validation Engg" />
        <meta
          property="og:description"
          content="About Marvell. Your Team, Your Impact. What You Can Expect Design and develop firmware to validate various IPs, including security IPs, DMA, and boot sequences. Validate and debug multiple SoC interfaces, including SAS, SATA, UFS, USB, DDR, SPI, I2C, and UART. What We're Looking For Bachelor's degree in Software, Computer or Electrical Engineering, and at least 3-5 years professional experience and/or Master's degree in Software, Computer or Electrical Engineering, and at least 2-3 years professional experience, in following domains - Pre-Si Validation, Post-Si Validation, Stress and PVT testing."
        />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `)

  assert.match(enriched.experienceRequired, /Bachelor's degree.*3-5 years professional experience/i)
  assert.match(enriched.experienceRequired, /Master's degree.*2-3 years professional experience/i)
  const normalized = normalizeScrapedJob(enriched)
  assert.equal(normalized.experienceProfile.minimumYears, null)
  assert.deepEqual(normalized.experienceYears, [])
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /validate and debug multiple so\s*c interfaces/i)
})

test('enrichJobWithPublicExperience recovers Oracle Candidate Experience detail from the public detail API when the shell is sparse', async () => {
  const job = {
    title: 'Specialist.Laboratory.Aster Laboratory',
    company: 'Aster DM Healthcare',
    source: 'asterdmhealthcare',
    atsPlatform: 'oracle-cloud',
    jobId: '1395',
    siteNumber: 'CX',
    sourceUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/1395',
    applyUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/1395/apply',
    experienceRequired: null,
    jobDescription: null,
    description: null,
    publicExperienceChecked: false,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      if (url === job.sourceUrl) {
        return `
          <html>
            <head>
              <title>Aster DM Healthcare</title>
              <meta property="og:title" content="Specialist.Laboratory.Aster Laboratory" />
            </head>
            <body>
              <div class="app-loading-spinner"></div>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected HTML fetch: ${url}`)
    },
    fetchJson: async (url) => {
      assert.match(url, /recruitingCEJobRequisitionDetails/)
      assert.match(url, /Id=%221395%22,siteNumber=CX$/)

      return {
        items: [{
          Id: '1395',
          Title: 'Specialist.Laboratory.Aster Laboratory',
          ExternalDescriptionStr: '<p>Conduct diagnostic testing, maintain quality controls, and support laboratory operations.</p>',
          ExternalQualificationsStr: '<p>Bachelor degree with 3-5 years of experience in accredited laboratory environments.</p>',
        }],
      }
    },
  })

  assert.equal(enriched.experienceRequired, '3-5 years')
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /diagnostic testing/i)
})

test('enrichJobWithPublicExperience recovers Fountain descriptions and experience from the public application form API', async () => {
  const job = {
    title: 'Chennai - Project Manager-chennai',
    company: 'CMS Info Systems',
    source: 'cmscomputers',
    atsPlatform: 'fountain',
    companyCareerPage: 'https://www.cms.com/careers',
    jobId: 'b775b39d-2a57-4954-b232-0d460503938b',
    sourceUrl: 'https://ap-1.fountain.com/cms/apply/chennai-project-manager-chennai',
    applyUrl: 'https://ap-1.fountain.com/cms/apply/chennai-project-manager-chennai',
    experienceRequired: null,
    jobDescription: null,
    description: null,
    publicExperienceChecked: false,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      if (url === job.sourceUrl) {
        return `
          <html>
            <head>
              <title>Fountain Applicant UI</title>
            </head>
            <body>
              <div id="app"></div>
            </body>
          </html>
        `
      }

      if (url === job.companyCareerPage) {
        return `
          <html>
            <body>
              <a href="https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900">Explore Jobs</a>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected HTML fetch: ${url}`)
    },
    fetchJson: async (url) => {
      assert.match(url, /internal_api\/portal\/cms\/application_forms\/new/)
      assert.match(url, /funnel_id=b775b39d-2a57-4954-b232-0d460503938b/)
      assert.match(url, /brand_id=a9218256-8fbf-40ab-936b-49ff5ff7c900/)

      return {
        funnel: {
          title: 'Chennai - Project Manager-chennai',
          position_description_html: '<p>Lead cash logistics programs and improve regional operations with 3-5 years of experience in project delivery.</p>',
        },
      }
    },
  })

  assert.equal(enriched.experienceRequired, '3-5 years')
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /cash logistics programs/i)
})

test('enrichJobWithPublicExperience recovers CEIPAL descriptions and experience from the public career portal API', async () => {
  const job = {
    title: 'Embedded Systems Engineer II',
    company: 'Example Engineering',
    source: 'exampleengineering',
    atsPlatform: 'ceipal-widget',
    companyCareerPage: 'https://engineering.example/careers-india',
    jobId: '241',
    sourceUrl: 'https://candidateportal.ceipal.com/job-details/nkzeTD_pVxOyfXBv3ZSrqQxNFSQYc65xfDJfQ7Rg18A',
    applyUrl: 'https://candidateportal.ceipal.com/jobs/career/nfS0lik6V2Gzg4omK9_WOTOoh5Qmp2u7D1haLtzQS7c/xNNBs3JmqLhRnG7dg2BWOhObGvuHKqxCb9rK8eOqrA8/JAPW0VMTXcklssI6raPVWZhU-E9LDKYeefhizfTCNwg',
    experienceRequired: null,
    jobDescription: null,
    description: null,
    publicExperienceChecked: false,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      if (url === job.sourceUrl) {
        return `
          <html>
            <head>
              <title>Candidate Portal</title>
            </head>
            <body>
              <app-root></app-root>
            </body>
          </html>
        `
      }

      if (url === job.companyCareerPage) {
        return `
          <html>
            <body>
              <script
                src="https://jobsapi.ceipal.com/APISource/widget.js"
                data-ceipal-api-key="test-key"
                data-ceipal-career-portal-id="test-portal"
              ></script>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected HTML fetch: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      assert.equal(url, 'https://careerapi.ceipal.com/test-key/CareerPortalJobPostings/?page=1')
      assert.equal(options.method, 'POST')
      assert.match(String(options.body), /cp_id=test-portal/)

      return {
        count: 1,
        num_pages: 1,
        page_number: 1,
        next: false,
        results: [{
          id: '241',
          job_id: '241',
          country: 'India',
          city: 'Chennai',
          state: 'Tamil Nadu',
          public_job_title: 'Embedded Systems Engineer II',
          public_job_desc: 'Requires 5-7 years of embedded systems experience across automotive programs.',
          apply_job: job.applyUrl,
          campus_portal_job_details_url: job.sourceUrl,
        }],
      }
    },
  })

  assert.equal(enriched.experienceRequired, '5-7 years')
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /embedded systems experience/i)
})

test('inferExperienceFromPublicPageHtml ignores generic overview shells that only repeat career-site chrome', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Regulatory Compliance Engineer',
    company: 'Example Hardware',
    applyUrl: 'https://jobs.example.com/regulatory-compliance-engineer',
    experienceRequired: '7 - 15 years',
  }, `
    <html>
      <body>
        <h1>Regulatory Compliance Engineer</h1>
        <section>
          <h2>Overview</h2>
          <p>Work at Example. Explore locations, teams, and life at Example.</p>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.experienceRequired, '7 - 15 years')
})

test('inferExperienceFromPublicPageHtml does not treat Oracle location chrome as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Resident Multispecialty',
    company: 'Fortis Healthcare',
    applyUrl: 'https://fa-ermg-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/8438',
    sourceUrl: 'https://fa-ermg-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/8438',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Resident Multispecialty</h1>
        <p>location Group of locations</p>
        <p>Mumbai, Maharashtra, India</p>
        <p>Be the First to Apply</p>
        <section>
          <h2>About Us</h2>
          <p>Fortis Healthcare is committed to clinical excellence through nurturing talent and providing world class infrastructure and medical technology.</p>
          <p>You will experience best in class work culture and opportunities to maximize your potential.</p>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml trims trailing Oracle chrome after real job-detail sections', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'ECD_Fan_168 (3621)',
    company: 'Example Company',
    applyUrl: 'https://iabgcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1000093',
    sourceUrl: 'https://iabgcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1000093',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>ECD_Fan_168 (3621) - Example Company Careers</title>
        <meta property="og:title" content="ECD_Fan_168 (3621)" />
        <meta property="og:description" content="Area Head for Fans Division based at Tirupati" />
      </head>
      <body>
        <h1>ECD_Fan_168 (3621)</h1>
        <section>
          <h2>Job Description</h2>
          <p>Sales Experience</p>
          <p>Channel expansion primary and secondary sales drive marketing activities, network expansion.</p>
        </section>
        <section>
          <h2>Responsibilities</h2>
          <p>Expand dealer coverage and drive demand generation programs.</p>
        </section>
        <section>
          <h2>Qualifications</h2>
          <p>Should be full time graduate.</p>
        </section>
        <button>Apply Now</button>
        <section>
          <h2>Job Info</h2>
          <p>Job Identification 1000093</p>
        </section>
        <p>Copy to Clipboard Similar Jobs Page ECD_Fan_168 (3621) - Example Company Careers loaded</p>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /Sales Experience/i)
  assert.doesNotMatch(enriched.jobDescription || '', /Copy to Clipboard/i)
})

test('inferExperienceFromPublicPageHtml marks title-matched application flows as checked when public experience is absent', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Chennai - AM - Talent Acquisition Blue Collar',
    company: 'CMS',
    applyUrl: 'https://ap-1.fountain.com/cms/apply/chennai-am-talent-acquisition-blue-collar',
    sourceUrl: 'https://ap-1.fountain.com/cms/apply/chennai-am-talent-acquisition-blue-collar',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Chennai - AM - Talent Acquisition Blue Collar</title>
      </head>
      <body>
        <h1>Chennai - AM - Talent Acquisition Blue Collar</h1>
        <p>CMS</p>
        <p>Address 26RW+VGG, Drivers Colony, T. Nagar, Chennai, Tamil Nadu 600017, India</p>
        <p>Start Your Application</p>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml marks structured title-matched metadata shells as checked when no job description is available yet', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Assistant Manager',
    company: 'ExampleCo',
    applyUrl: 'https://careers.example.com/jobs/assistant-manager',
    sourceUrl: 'https://careers.example.com/jobs/assistant-manager',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Job Details Page</title>
      </head>
      <body>
        <p>Open Jobs</p>
        <p>Rest of India - Operations</p>
        <p>Assistant Manager</p>
        <p>Assistant Manager</p>
        <p>Branch Office, Tiruppur, Tamil Nadu, India</p>
        <p>Permanent</p>
        <p>Apply Now</p>
        <p>No job description at the moment! Sometimes the best opportunities are still in the works.</p>
        <p>If the details spark your interest, feel free to go ahead and apply.</p>
        <section>
          <h2>Job Snapshot</h2>
          <p>Updated Date 24-07-2026</p>
          <p>Job ID JOB_3126</p>
          <p>Department Rest of India - Operations</p>
          <p>Location Branch Office, Tiruppur, Tamil Nadu, India</p>
          <p>Employee Type Permanent</p>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml marks structured vacancy notices as checked even when OCR text does not expose clean experience years', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Vacancy Notice for 2 Posts of Jr Translator (E-0) Rajbhasha',
    company: 'Example Infrastructure Board',
    applyUrl: 'https://careers.example-infra.test/notices/jr-translator.pdf',
    sourceUrl: 'https://careers.example-infra.test/notices/jr-translator.pdf',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Vacancy Notice for 2 Posts of Jr Translator (E-0) Rajbhasha</title>
      </head>
      <body>
        <h1>Vacancy Notice for 2 Posts of Jr Translator (E-0) Rajbhasha</h1>
        <article>
          VACANCY NOTICE NO: 13/2026
          ORGANIZATION EXAMPLE INFRASTRUCTURE BOARD
          TITLE & NO OF POSTS JR TRANSLATOR (E-0) - 02 POSTS
          TERM OF APPOINTMENT DEPUTATION / RE-EMPLOYMENT
          SPECIFIC REQUIREMENTS PROFICIENCY IN TRANSLATION WORK FROM ENGLISH TO HINDI
          MINIMUM ELIGUBILITY FOR DEPUTATION: LEVEL-6 WITH SERVICE REQUIREMENTS AS PER NOTICE
        </article>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('inferExperienceFromPublicPageHtml does not treat shortlisted-candidate result notices as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Engagement of Experienced Medical Consultant for BHISHM Cube Project on Contract Basis.',
    company: 'Example Infrastructure Board',
    applyUrl: 'https://careers.example-infra.test/notices/medical-consultant-shortlist.pdf',
    sourceUrl: 'https://careers.example-infra.test/notices/medical-consultant-shortlist.pdf',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Engagement of Experienced Medical Consultant for BHISHM Cube Project on Contract Basis.</title>
      </head>
      <body>
        <h1>Engagement of Experienced Medical Consultant for BHISHM Cube Project on Contract Basis.</h1>
        <article>
          NOTICE REGARDING LIST OF PROVISIONALLY SHORTLISTED CANDIDATES FOR INTERVIEW
          Vacancy Notice No. EIB-HR-2/2026
          The following candidates have been provisionally shortlisted to appear in interview.
          The interview call letters have been sent to the provisionally shortlisted candidates.
        </article>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, false)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml does not treat access-denied shells as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Business Development Associate',
    company: 'Example Learning Co',
    applyUrl: 'https://careers.example-learning.com/job/business-development-associate',
    sourceUrl: 'https://careers.example-learning.com/job/business-development-associate',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Job Details Page</title>
      </head>
      <body>
        <p>Job Details Page</p>
        <p>You do not have access to this page!</p>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, false)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml does not treat invalid-url shells as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Relationship Manager',
    company: 'Example Company',
    applyUrl: 'https://app79.workline.hr/Candidate/CanPRFApplyBL.aspx?PRFCode=3404&Flag=C',
    sourceUrl: 'https://app79.workline.hr/Candidate/CanPRFApplyBL.aspx?PRFCode=3404&Flag=C',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Example Company - Workline - Possibilities Infinite</title>
      </head>
      <body>
        <p>Toggle navigation</p>
        <p>Home General Campus Sign In Register</p>
        <p>Invalid URL Argument</p>
      </body>
    </html>
  `)

  assert.equal(enriched.publicExperienceChecked, false)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
})

test('inferExperienceFromPublicPageHtml does not treat empty section-heading templates as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Housekeeping Attendant',
    company: 'Example Hospitality',
    applyUrl: 'https://careers.example.com/jobs/housekeeping-attendant',
    sourceUrl: 'https://careers.example.com/jobs/housekeeping-attendant',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Housekeeping Attendant</h1>
        <section>
          <h2>About Example Hospitality</h2>
          <p>Example Hospitality is a long-running hotel group with a broad portfolio across India.</p>
          <p>Careers at Example Hospitality foster innovation, collaboration, and personal growth.</p>
        </section>
        <section>
          <h2>Job Objective</h2>
          <h2>Essential Job Tasks</h2>
          <h2>Areas of Responsibility</h2>
          <h2>Required Qualifications</h2>
          <h2>Work Experience</h2>
          <h2>Languages Needed in Position</h2>
          <h2>Key Interfaces- External</h2>
          <h2>Key Interfaces- Internal</h2>
          <h2>Behavioural Competencies</h2>
          <h2>Equal Opportunities Employment at Example Hospitality</h2>
        </section>
        <a href="/apply">Apply now</a>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml does not treat Amrita campus shells as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Yoga and Meditation Instructor @ Amritapuri',
    company: 'Amrita Vishwa Vidyapeetham',
    applyUrl: 'https://careers.amrita.edu/client/job-search?jid=example',
    sourceUrl: 'https://www.amrita.edu/job/yoga-and-meditation-instructor-school-of-spiritual-and-cultural-studies-amritapuri/',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Yoga and Meditation Instructor @ Amritapuri</h1>
        <p>Campus: Amritapuri | Unit: Amrita Vishwa Vidyapeetham</p>
        <p>Campus: Amritapuri | Unit: Amrita Vishwa Vidyapeetham</p>
        <p>requirements of future employers</p>
        <p>Explore Nagercoil</p>
        <p>Nagercoil Campus Amrita Vishwa Vidyapeetham, situated in Erachakulam, Nagercoil is a beacon of educational excellence.</p>
        <p>Explore Amaravati Explore Bengaluru Explore Chennai Explore Coimbatore Explore Kochi Explore Mysuru.</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml does not treat Nagarro motivational intros as verified job-detail evidence on non-job hosts', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Associate Staff Engineer',
    company: 'Nagarro',
    applyUrl: 'https://example.com/jobs/associate-staff-engineer',
    sourceUrl: 'https://example.com/jobs/associate-staff-engineer',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Associate Staff Engineer</h1>
        <p>By this point in your career, it is not just about the tech you know or how well you can code. It is about what more you want to do with that knowledge.</p>
        <p>Were you given the tools to go beyond solving for X? Can you help your teammates proceed in the right direction? Can you tackle the challenges our clients face while always looking to take our solutions one step further to succeed at an even higher level? Yes? You may be ready to join us.</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml marks title-matched SmartRecruiters motivational shells as checked when public experience is absent', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Associate Staff Engineer',
    company: 'Nagarro',
    applyUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999982757594-associate-staff-engineer?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999982757594-associate-staff-engineer?oga=true',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Associate Staff Engineer</h1>
        <p>Job Description: By this point in your career, it is not just about the tech you know or how well you can code.</p>
        <p>Were you given the tools to go beyond solving for X? Can you help your teammates proceed in the right direction? Can you tackle the challenges our clients face while always looking to take our solutions one step further to succeed at an even higher level? Yes? You may be ready to join us.</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('inferExperienceFromPublicPageHtml marks title-matched SmartRecruiters apply flows as checked even when Nagarro motivational copy is present', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Associate Staff Engineer',
    company: 'Nagarro',
    applyUrl: 'https://jobs.smartrecruiters.com/oneclick-ui/company/Nagarro1/publication/example',
    sourceUrl: 'https://jobs.smartrecruiters.com/oneclick-ui/company/Nagarro1/publication/example',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <title>Associate Staff Engineer</title>
      </head>
      <body>
        <h1>Associate Staff Engineer</h1>
        <p>By this point in your career, it is not just about the tech you know or how well you can code.</p>
        <p>Easy Apply</p>
        <p>Personal information</p>
        <p>Resume</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('inferExperienceFromPublicPageHtml marks title-matched SmartRecruiters job shells as checked when job metadata is present', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Senior Analyst, UXD',
    company: 'Nagarro',
    applyUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999908778257-senior-analyst-uxd?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999908778257-senior-analyst-uxd',
    experienceRequired: null,
  }, `
    <html>
      <head>
        <meta name="description" content="Nagarro Senior Analyst, UXD | SmartRecruiters" />
        <meta name="sr:job-ad-id" content="78935d06-6f06-4dd2-b332-daa8c5dd6809" />
        <title>Nagarro Senior Analyst, UXD | SmartRecruiters</title>
      </head>
      <body>
        <script>window.__APP__ = true;</script>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.match(enriched.jobDescription || '', /Senior Analyst, UXD/i)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('inferExperienceFromPublicPageHtml does not treat short truncated previews as verified job-detail evidence', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Lead Engineer - Agentic AI',
    company: 'Yubi',
    applyUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000026385417/Lead-Engineer---Agentic-AI?source=CareerSite',
    sourceUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000026385417/Lead-Engineer---Agentic-AI?source=CareerSite',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <h1>Lead Engineer - Agentic AI</h1>
        <p>Yubi stands for ubiquitous. But Yubi will also stand for transparency, collaboration, and the power of possibility. From being a disruptor in India’s ...</p>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml preserves per-job titles when generic careers pages expose adjacent meta tags', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'SEO Expert',
    company: 'Appiness Interactive',
    applyUrl: 'https://www.appinessworld.com/careers/job-details/',
    sourceUrl: 'https://www.appinessworld.com/careers/job-details/',
    experienceRequired: '1-4 Years',
    jobDescription: null,
    description: null,
  }, `
    <html>
      <head>
        <meta name="twitter:card" content="summary_large_image">
        <meta content="Jobs at Appiness Interactive" property="og:title">
      </head>
      <body>
        <h2>Current Openings</h2>
        <div>Role SEO Expert</div>
        <div>Experience 1-4 Years</div>
        <div>Location Bangalore</div>
        <div>Job Details Apply</div>
      </body>
    </html>
  `)

  assert.equal(enriched.title, 'SEO Expert')
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.experienceRequired, '1-4 Years')
})

test('enrichJobWithPublicExperience fetches the official page and returns recovered experience', async () => {
  const job = {
    title: 'Cloud Engineer',
    company: 'Virtusa',
    applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    experienceRequired: null,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      assert.equal(url, job.applyUrl)
      return `
        <html>
          <body>
            <h1>Cloud Engineer</h1>
            <section>
              <h6>Required Experience</h6>
              <div>5</div>
            </section>
          </body>
        </html>
      `
    },
  })

  assert.equal(enriched.experienceRequired, '5 years')
})

test('enrichJobWithPublicExperience prefers sourceUrl when applyUrl is a thin login shell', async () => {
  const job = {
    title: 'Manager Data Engineering',
    company: 'Publicis Sapient',
    applyUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144904/job/login',
    sourceUrl: 'https://careers.publicissapient.com/job-details/2026-144904-manager-data-engineering-gurgaon',
    experienceRequired: null,
    engineeringDomain: 'Unknown',
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <section>
              <h2>Job Description</h2>
              <p>Publicis Sapient is seeking a Manager - Data Engineering to lead cloud native data engineering solutions.</p>
              <p>Required Experience: 8+</p>
            </section>
          </body>
        </html>
      `
    },
  })

  const normalized = normalizeScrapedJob(enriched, { source: 'publicissapient' })

  assert.equal(enriched.experienceRequired, '8 years')
  assert.match(enriched.jobDescription || '', /data engineering solutions/i)
  assert.equal(normalized.engineeringDomain, 'Data Engineering')
})

test('enrichJobWithPublicExperience prefers hosted job-detail apply pages over generic careers listings', async () => {
  const job = {
    title: 'Manager-Accounts',
    company: 'Verteil Technologies',
    applyUrl: 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=256',
    sourceUrl: 'https://www.verteil.com/career',
    experienceRequired: null,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      assert.equal(url, job.applyUrl)
      return `
        <html>
          <body>
            <h1>Manager-Accounts</h1>
            <p>Minimum Required Experience : 10 years</p>
            <section>
              <h2>Job Requirements</h2>
              <p>Experience: 5 to 10 years in B2B sales or account management, ideally within travel technology.</p>
            </section>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(enriched.experienceRequired, '5 - 10 years')
  assert.notEqual(enriched.sourceExperienceRequired, '10 years')
  assert.match(enriched.jobDescription || '', /account management/i)
})

test('enrichJobWithPublicExperience falls back to browser-rendered page content when raw html is too thin', async () => {
  const job = {
    title: 'Lead Azure DevOps',
    company: 'Virtusa',
    applyUrl: 'https://www.virtusa.com/careers/job-search/in/hyderabad/azure/lead-azure-devops/creq264660',
    sourceUrl: 'https://www.virtusa.com/careers/job-search/in/hyderabad/azure/lead-azure-devops/creq264660',
    experienceRequired: null,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => '<html><body><h1>Lead Azure DevOps</h1></body></html>',
    fetchBrowserText: async (url) => {
      assert.equal(url, job.applyUrl)
      return `
        <html>
          <body>
            <h1>Lead Azure DevOps</h1>
            <section>
              <div>Required Experience</div>
              <div>5</div>
            </section>
          </body>
        </html>
      `
    },
  })

  assert.equal(enriched.experienceRequired, '5 years')
})

test('enrichJobWithPublicExperience retries transient Avature browser shells before giving up on public evidence', async () => {
  const job = {
    title: 'Application Developer-Cloud FullStack',
    company: 'HashiCorp',
    applyUrl: 'https://careers.ibm.com/en_US/careers/JobDetail?jobId=121628',
    sourceUrl: 'https://careers.ibm.com/en_US/careers/JobDetail?jobId=121628',
    experienceRequired: null,
  }
  let browserFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => '<html><body><h1>Application Developer-Cloud FullStack</h1></body></html>',
    fetchBrowserText: async (url) => {
      browserFetchCount += 1
      assert.equal(url, job.applyUrl)

      if (browserFetchCount === 1) {
        return `
          <html>
            <head>
              <meta name="avature.portal.page" content="JobDetail">
              <meta property="og:title" content="Application Developer-Cloud FullStack">
              <meta property="og:url" content="https://careers.ibm.com/en_US/careers/JobDetail/Application-Developer-Cloud-FullStack/121628">
              <title>Application Developer-Cloud FullStack - 121628 - HashiCorp</title>
            </head>
            <body></body>
          </html>
        `
      }

      return `
        <html>
          <head>
            <meta name="avature.portal.page" content="JobDetail">
            <title>Application Developer-Cloud FullStack - 121628 - HashiCorp</title>
          </head>
          <body>
            <div>Skip to content</div>
            <h1>Application Developer-Cloud FullStack</h1>
            <button>Apply now</button>
            <section>
              <h2>Your role and responsibilities</h2>
              <p>Build cloud applications with React, Java, and secure middleware integrations.</p>
            </section>
            <section>
              <div>Required education</div>
              <div>Bachelor's Degree</div>
            </section>
          </body>
        </html>
      `
    },
  })

  assert.equal(browserFetchCount, 2)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /secure middleware integrations/i)
})

test('enrichJobWithPublicExperience follows embedded greenhouse iframes when the wrapper page is too thin', async () => {
  const job = {
    title: 'Account Manager - Microsoft Advertising',
    company: 'InMobi',
    applyUrl: 'https://www.inmobi.com/company/openings/full-time-employee/jobid/7959734',
    sourceUrl: 'https://www.inmobi.com/company/openings/full-time-employee/jobid/7959734',
    experienceRequired: null,
    publicExperienceChecked: false,
  }
  const fetchedUrls = []

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      fetchedUrls.push(url)

      if (url === job.sourceUrl) {
        return { status: 200, url, html: `
          <html>
            <head>
              <title>InMobi Job Opening - Account Manager - Microsoft Advertising</title>
              <meta
                name="description"
                content="Join InMobi as a Account Manager - Microsoft Advertising. Discover a rewarding career with innovative teams, global opportunities, competitive benefits, and a culture built on ownership and growth."
              />
            </head>
            <body>
              <div id="container" class="current-opening">
                <div class="top-wrapper">
                  <h1 class="sr-only">Account Manager - Microsoft Advertising</h1>
                  <div id="jod-id">Job ID: 10929</div>
                  <div class="social-buttons">
                    <a href="https://www.facebook.com/sharer/sharer.php?u=https://boards.greenhouse.io/inmobi/jobs/7959734">Facebook Share</a>
                  </div>
                </div>
                <iframe id="job-iframe" src="https://boards.greenhouse.io/inmobi/jobs/7959734"></iframe>
              </div>
            </body>
          </html>
        ` }
      }

      if (url === 'https://boards.greenhouse.io/inmobi/jobs/7959734') {
        return `
          <html>
            <head>
              <title>Job Application for Account Manager - Microsoft Advertising at InMobi</title>
            </head>
            <body>
              <h1>Account Manager - Microsoft Advertising</h1>
              <section>
                <h2>Requirements</h2>
                <p>5 years of experience managing large strategic advertising accounts.</p>
              </section>
              <section>
                <h2>Responsibilities</h2>
                <p>Own customer relationships, drive campaign execution, and grow revenue opportunities.</p>
              </section>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected URL ${url}`)
    },
    useBrowserFallback: false,
  })

  assert.deepEqual(fetchedUrls, [
    job.sourceUrl,
    'https://boards.greenhouse.io/inmobi/jobs/7959734',
  ])
  assert.equal(enriched.sourceUrl, 'https://boards.greenhouse.io/inmobi/jobs/7959734')
  assert.equal(enriched.applyUrl, 'https://boards.greenhouse.io/inmobi/jobs/7959734')
  assert.equal(enriched.experienceRequired, '5 years')
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /Own customer relationships/i)
})

test('enrichJobWithPublicExperience extracts experience from application/pdf responses', async () => {
  const originalFetch = globalThis.fetch
  const job = {
    title: 'Junior Translator',
    company: 'Example Infrastructure Board',
    applyUrl: 'https://careers.example-infra.test/notices/JR-translator.pdf',
    sourceUrl: 'https://careers.example-infra.test/notices/JR-translator.pdf',
    experienceRequired: null,
  }

  globalThis.fetch = async (url) => {
    assert.equal(url, job.applyUrl)

    const pdfBuffer = buildPdfBuffer('Experience: 5 years in translation work')
    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return String(name).toLowerCase() === 'content-type' ? 'application/pdf' : null
        },
      },
      arrayBuffer: async () => pdfBuffer,
      text: async () => {
        throw new Error('text() should not be used for PDF responses')
      },
    }
  }

  try {
    const enriched = await enrichJobWithPublicExperience(job)
    assert.equal(enriched.experienceRequired, '5 years')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('enrichJobWithPublicExperience aborts default public fetches after the configured budget', async () => {
  const originalFetch = globalThis.fetch
  const job = {
    title: 'Cloud Engineer',
    company: 'Example Infra',
    applyUrl: 'https://careers.jobverify.dev/jobs/cloud-engineer',
    sourceUrl: 'https://careers.jobverify.dev/jobs/cloud-engineer',
    experienceRequired: null,
  }
  const fetchSignals = []

  globalThis.fetch = async (_url, options = {}) => {
    fetchSignals.push(options.signal)
    return new Promise((resolve, reject) => {
      if (!options.signal) return
      if (options.signal.aborted) {
        reject(options.signal.reason)
        return
      }
      options.signal.addEventListener('abort', () => {
        reject(options.signal.reason)
      }, { once: true })
    })
  }

  try {
    const enriched = await Promise.race([
      enrichJobWithPublicExperience(job, {
        fetchTimeoutMs: 5,
        useBrowserFallback: false,
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('default public fetch did not abort')), 200)
      }),
    ])

    assert.equal(enriched.experienceRequired, null)
    assert.equal(enriched.publicExperienceChecked, undefined)
    assert.ok(fetchSignals[0]?.aborted)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('extractTextFromPdfBuffer rejects before parsing when the caller signal is already aborted', async () => {
  const controller = new AbortController()
  const abortReason = new Error('pdf extraction aborted')
  controller.abort(abortReason)

  await assert.rejects(
    extractTextFromPdfBuffer(
      buildPdfBuffer('Experience: 5 years in translation work'),
      { signal: controller.signal },
    ),
    (error) => {
      assert.equal(error, abortReason)
      return true
    },
  )
})

test('enrichJobWithPublicExperience preserves fetched job text for later engineeringDomain inference', async () => {
  const job = {
    title: 'Systems Specialist',
    company: 'Example Infra',
    applyUrl: 'https://careers.example.com/jobs/systems-specialist',
    sourceUrl: 'https://careers.example.com/jobs/systems-specialist',
    experienceRequired: null,
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => `
      <html>
        <head>
          <title>Systems Specialist</title>
        </head>
        <body>
          <section>
            <h2>Job Description</h2>
            <p>Maintain cloud infrastructure, VPN connectivity, and Windows server operations.</p>
            <p>Required Experience: 4</p>
          </section>
        </body>
      </html>
    `,
  })

  const normalized = normalizeScrapedJob(enriched, { source: 'example-infra' })

  assert.equal(enriched.experienceRequired, '4 years')
  assert.match(enriched.jobDescription || '', /cloud infrastructure/i)
  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('enrichJobWithPublicExperience still fetches page text when experience exists but classification evidence is missing', async () => {
  const job = {
    title: 'Support and Infrastructure Engineer (L1 & L2)',
    company: 'Example Infra',
    applyUrl: 'https://careers.example.com/jobs/support-infra-engineer',
    sourceUrl: 'https://careers.example.com/jobs/support-infra-engineer',
    experienceRequired: '3-5 years',
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => `
      <html>
        <head>
          <title>Support and Infrastructure Engineer (L1 & L2)</title>
        </head>
        <body>
          <section>
            <h2>Job Description</h2>
            <p>Maintain cloud infrastructure, Windows servers, VPN connectivity, and ticketing operations.</p>
          </section>
        </body>
      </html>
    `,
  })

  const normalized = normalizeScrapedJob(enriched, { source: 'example-infra' })

  assert.match(enriched.jobDescription || '', /vpn connectivity/i)
  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('enrichJobWithPublicExperience falls back to browser-rendered job text when classification evidence is still missing', async () => {
  const job = {
    title: 'Front End UI Engineer',
    company: 'Example UI',
    applyUrl: 'https://careers.example.com/jobs/front-end-ui-engineer',
    sourceUrl: 'https://careers.example.com/jobs/front-end-ui-engineer',
    experienceRequired: '5 years',
    engineeringDomain: 'Unknown',
  }

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => '<html><body><h1>Front End UI Engineer</h1></body></html>',
    fetchBrowserText: async (url) => {
      assert.equal(url, job.applyUrl)
      return `
        <html>
          <body>
            <section>
              <h2>Job Description</h2>
              <p>Build front-end user interfaces with React, TypeScript, and JavaScript.</p>
            </section>
          </body>
        </html>
      `
    },
  })

  const normalized = normalizeScrapedJob(enriched, { source: 'example-ui' })

  assert.match(enriched.jobDescription || '', /React/i)
  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('enrichJobWithPublicExperience promotes detailed source-provided job descriptions to checked evidence without refetching', async () => {
  const job = {
    title: 'Broking - Territory Manager - East',
    company: 'Example Securities',
    applyUrl: 'https://example.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a6b1ed16e5ad',
    sourceUrl: 'https://example.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a6b1ed16e5ad',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: `
      Job Description
      Responsibilities:
      Responsible to meet the both topline and bottom line business budgets for the cluster.
      Work toward ensuring that the frontline earns incentive and the branches are delivering on the KPI.
      Should possess strong understanding of Markets and demonstrate business acumen.
      Should have managed HNI clients in the previous role and should be able to manage top clients of the Cluster as and when required.
    `,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
  })

  assert.equal(fetchCount, 0)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.match(enriched.jobDescription || '', /Responsibilities/i)
})

test('enrichJobWithPublicExperience promotes skill-led source descriptions without refetching', async () => {
  const job = {
    title: 'Microsoft Cloud Native Lead',
    company: 'ExampleCo',
    applyUrl: 'https://jobs.example.com/#en/sites/CX_1/job/653958',
    sourceUrl: 'https://jobs.example.com/#en/sites/CX_1/job/653958',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: `
      Must-have Skills: Strong current .NET / C# backend experience in production enterprise systems.
      Key Responsibilities: Deliver features end-to-end, operate APIs in production, and contribute to design discussions.
      Nice to have: MongoDB, Redis, SignalR, and broader tax technology exposure.
      Reporting to the platform engineering leadership team while partnering with product and architecture stakeholders.
    `,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 0)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('enrichJobWithPublicExperience treats raw mailto-only careers listings as verified public-missing surfaces', async () => {
  const job = {
    title: 'Power electronics Engineer',
    company: 'Agnikul Cosmos',
    sourceUrl: 'https://www.agnikul.in/careers/',
    applyUrl: 'mailto:humancapital@agnikul.in',
    link: 'mailto:humancapital@agnikul.in',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: null,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 1)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience treats shared careers pages without a separate apply URL as verified public-missing surfaces', async () => {
  const job = {
    title: 'Program Manager Executive',
    company: 'MyCaptain',
    sourceUrl: 'https://mycaptain.in/career',
    companyCareerPage: 'https://mycaptain.in/career',
    atsPlatform: 'official-company-careers',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: null,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 1)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience treats static first-party careers pages as verified public-missing surfaces', async () => {
  const job = {
    title: 'Team Leader',
    company: 'BUDDI.AI',
    sourceUrl: 'https://buddi.ai/careers.html#team-leader',
    applyUrl: 'https://buddi.ai/careers.html#team-leader',
    companyCareerPage: 'https://buddi.ai/careers.html',
    atsPlatform: 'official-first-party-static-careers-page',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: 'Specializations: Surgery, ED, EM, Pathology, Radiology.',
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 0)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience treats hash-only apply links on shared careers pages as the same public surface', async () => {
  const job = {
    title: 'Lead BRM Developer',
    company: 'Aarav Solutions',
    sourceUrl: 'https://www.aaravsolutions.com/careers/',
    applyUrl: 'https://www.aaravsolutions.com/careers/#career-form',
    link: 'https://www.aaravsolutions.com/careers/#career-form',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: null,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 1)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience treats shared current-openings pages with form handoffs as verified public-missing surfaces', async () => {
  const job = {
    title: 'Artificial Intelligence (AI) & Machine Learning',
    company: 'Crimson Energy Experts',
    sourceUrl: 'https://crimsonenergy.in/careers.html',
    applyUrl: 'https://forms.gle/VUiYLf88LjmD7Yzu7',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: `
      Work on cutting-edge AI and machine learning solutions that drive defence-sector innovation.
      Develop advanced threat detection algorithms, build LLM-powered intelligence analysis tools,
      and create AI-driven mission support capabilities for high-stakes operational environments.
    `,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 0)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience treats current-openings form pages outside /careers URLs as verified public-missing surfaces after fetch', async () => {
  const job = {
    title: 'Business Development Associate',
    company: 'Crio.Do',
    sourceUrl: 'https://www.crio.do/about-us/',
    applyUrl: 'https://www.crio.do/about-us/#tally-open=example',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: null,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return `
        <html>
          <body>
            <h1>Join Our Journey At Crio.Do | Apply Now</h1>
            <p>Explore our current openings and take the first step towards a rewarding career with us.</p>
            <p>Select the team</p>
            <p>Select the location</p>
            <p>Business Development Associate</p>
            <p>Team: Business Development</p>
            <p>Location: Bengaluru, Chennai</p>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 1)
  assert.equal(enriched.publicExperienceChecked, true)
  assert.equal(enriched.experienceRequired, null)
})

test('enrichJobWithPublicExperience does not auto-trust long company boilerplate without job-detail signals', async () => {
  const job = {
    title: 'Commercial Sales Account Manager',
    company: 'AMD',
    applyUrl: 'https://global-external-amd.icims.com/jobs/88649/login',
    sourceUrl: 'https://global-external-amd.icims.com/jobs/88649/login',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: `
      ADVANCE YOUR CAREER. ADVANCE THE WORLD.
      At AMD, we believe technology can change lives for the better. It can heal us, entertain us, and make us more connected, productive, and understanding of the world around us.
      We’re looking for talent who feel the same: people who want to leave the planet better than they found it and help solve humanity’s challenges.
      Join a company where innovation, inclusion, and collaboration shape everything we do.
    `,
  }
  let fetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      fetchCount += 1
      return '<html></html>'
    },
    useBrowserFallback: false,
  })

  assert.equal(fetchCount, 1)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('enrichJobWithPublicExperience trusts provider-verified public evidence and skips refetching', async () => {
  const job = {
    title: 'Senior Associate - SAP HCM-TC',
    company: 'Example Corp',
    applyUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Kolkata-DN-57/Associate---SAP-ABAP-TC_145552WD/apply',
    sourceUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Kolkata-DN-57/Associate---SAP-ABAP-TC_145552WD',
    experienceRequired: null,
    engineeringDomain: 'Unknown',
    publicExperienceChecked: true,
    jobDescription: `
      Line of Service Advisory. Industry/Sector FS X-Sector. Specialism Operations.
      Job Description and Summary: Join our SAP HCM consulting delivery team to design, configure, and support enterprise transformation programs across India.
      Collaborate with business stakeholders, contribute to solution delivery, and participate in quality reviews across the implementation lifecycle.
    `,
  }
  let rawFetchCount = 0
  let browserFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      rawFetchCount += 1
      return '<html></html>'
    },
    fetchBrowserText: async () => {
      browserFetchCount += 1
      return '<html></html>'
    },
  })

  assert.deepEqual(enriched, {
    ...job,
    publicExperienceChecked: true,
  })
  assert.equal(rawFetchCount, 0)
  assert.equal(browserFetchCount, 0)
})

test('enrichJobWithPublicExperience skips refetching concise provider-verified public job descriptions', async () => {
  const job = {
    title: 'Forward Deployed Engineer',
    company: 'Mudrex',
    source: 'mudrex',
    applyUrl: 'https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822/apply',
    sourceUrl: 'https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822',
    publicExperienceChecked: true,
    jobDescription: 'Own technical onboarding from first API call to production go-live.',
  }
  let rawFetchCount = 0
  let browserFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      rawFetchCount += 1
      return '<html></html>'
    },
    fetchBrowserText: async () => {
      browserFetchCount += 1
      return '<html></html>'
    },
  })

  assert.deepEqual(enriched, {
    ...job,
    publicExperienceChecked: true,
  })
  assert.equal(rawFetchCount, 0)
  assert.equal(browserFetchCount, 0)
})

test('enrichJobWithPublicExperience skips refetching when the source already provides rich experience-backed job text', async () => {
  const job = {
    title: 'Platform Engineer',
    company: 'Example Company',
    source: 'example',
    applyUrl: 'https://example.flexiele.com/careers/example/apply/4057',
    sourceUrl: 'https://example.flexiele.com/careers/example/job-description/4057',
    experienceRequired: '5-8 Years',
    jobDescription: `
      Role Objective: Build and evolve internal platform engineering systems that support order orchestration,
      inventory workflows, and high-availability fulfillment operations across India. Responsibilities include
      designing backend services, maintaining AWS infrastructure, improving Kubernetes-based deployments, driving
      observability, and collaborating with security, data, and product teams to deliver resilient software.
    `,
  }
  let rawFetchCount = 0
  let browserFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async () => {
      rawFetchCount += 1
      return '<html></html>'
    },
    fetchBrowserText: async () => {
      browserFetchCount += 1
      return '<html></html>'
    },
  })

  assert.deepEqual(enriched, {
    ...job,
    publicExperienceChecked: true,
  })
  assert.equal(rawFetchCount, 0)
  assert.equal(browserFetchCount, 0)
})

test('enrichJobWithPublicExperience refetches stale Oracle shell descriptions even when they were previously marked checked', async () => {
  const job = {
    title: 'Resident Multispecialty',
    company: 'Fortis Healthcare',
    applyUrl: 'https://fa-ermg-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/8438',
    sourceUrl: 'https://fa-ermg-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/8438',
    experienceRequired: null,
    publicExperienceChecked: true,
    jobDescription: `
      location Group of locations © Map Tiler © Open Street Map contributors | © Oracle Corporation Terms Legal Notices
      Copy to Clipboard Similar Jobs Resident Multispecialty Navi Mumbai, Maharashtra, India
      Work Summary This summary is generated by AI Assist.
      Page Resident Multispecialty - Fortis Career Careers loaded
    `,
  }
  let rawFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Resident Multispecialty</h1>
            <p>location Group of locations</p>
            <p>Mumbai, Maharashtra, India</p>
            <p>Be the First to Apply</p>
            <section>
              <h2>About Us</h2>
              <p>Fortis Healthcare is committed to clinical excellence through nurturing talent and providing world class infrastructure and medical technology.</p>
            </section>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('enrichJobWithPublicExperience refetches stale section-heading templates even when they were previously marked checked', async () => {
  const job = {
    title: 'Housekeeping Attendant',
    company: 'Example Hospitality',
    applyUrl: 'https://careers.example.com/apply/housekeeping-attendant',
    sourceUrl: 'https://careers.example.com/jobs/housekeeping-attendant',
    experienceRequired: null,
    publicExperienceChecked: true,
    jobDescription: `
      About Example Hospitality Example Hospitality is a long-running hotel group with a broad portfolio across India.
      Careers at Example Hospitality foster innovation and collaboration.
      Job Objective Essential Job Tasks Areas of Responsibility Required Qualifications
      Work Experience Languages Needed in Position Key Interfaces- External Key Interfaces- Internal
      Behavioural Competencies Equal Opportunities Employment at Example Hospitality Apply now
    `,
  }
  let rawFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Housekeeping Attendant</h1>
            <section>
              <h2>About Example Hospitality</h2>
              <p>Example Hospitality is a long-running hotel group with a broad portfolio across India.</p>
            </section>
            <section>
              <h2>Job Objective</h2>
              <h2>Essential Job Tasks</h2>
              <h2>Areas of Responsibility</h2>
              <h2>Required Qualifications</h2>
              <h2>Work Experience</h2>
              <h2>Languages Needed in Position</h2>
              <h2>Key Interfaces- External</h2>
              <h2>Key Interfaces- Internal</h2>
              <h2>Behavioural Competencies</h2>
            </section>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('enrichJobWithPublicExperience refetches duplicated section-heading shells with competency values and equal-opportunity copy', async () => {
  const job = {
    title: 'Housekeeping Attendant',
    company: 'Example Hospitality',
    applyUrl: 'https://careers.example.com/apply/housekeeping-attendant',
    sourceUrl: 'https://careers.example.com/jobs/housekeeping-attendant',
    experienceRequired: null,
    publicExperienceChecked: true,
    jobDescription: `
      About Example Hospitality Example Hospitality is a long-running hotel group with a broad portfolio across India.
      Careers at Example Hospitality foster innovation, collaboration, and personal growth.
      Job Objective Essential Job Tasks Areas of Responsibility Required Qualifications Work Experience Languages Needed in Position
      Key Interfaces- External Key Interfaces- Internal Behavioural Competencies Effective Communication Resilience Accountability Teamwork
      Judgement & Analysis Learning Agility Equal Opportunities Employment at Example Hospitality At Example Hospitality, we celebrate diversity and are committed to creating
      an inclusive environment for all employees. Qualifications Work Experience Languages Needed in Position Key Interfaces- External
      Key Interfaces- Internal Behavioural Competencies Effective Communication Resilience Accountability Teamwork Judgement & Analysis
      Learning Agility Equal Opportunities Employment at Example Hospitality Apply now Find similar jobs: Housekeeping
    `,
  }
  let rawFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Housekeeping Attendant</h1>
            <section>
              <h2>About Example Hospitality</h2>
              <p>Example Hospitality is a long-running hotel group with a broad portfolio across India.</p>
              <p>Careers at Example Hospitality foster innovation, collaboration, and personal growth.</p>
              <p>Join us in creating memorable experiences and shaping the future of hospitality.</p>
            </section>
            <section>
              <h2>Job Objective</h2>
              <h2>Essential Job Tasks</h2>
              <h2>Areas of Responsibility</h2>
              <h2>Required Qualifications</h2>
              <h2>Work Experience</h2>
              <h2>Languages Needed in Position</h2>
              <h2>Key Interfaces- External</h2>
              <h2>Key Interfaces- Internal</h2>
              <h2>Behavioural Competencies</h2>
              <p>Effective Communication Resilience Accountability Teamwork Judgement & Analysis Learning Agility</p>
              <h2>Equal Opportunities Employment at Example Hospitality</h2>
              <p>At Example Hospitality, we celebrate diversity and are committed to creating an inclusive environment for all employees.</p>
              <p>We encourage all qualified individuals to apply and join our team, where every voice is valued and respected.</p>
              <h2>Qualifications</h2>
              <h2>Work Experience</h2>
              <h2>Languages Needed in Position</h2>
              <h2>Key Interfaces- External</h2>
              <h2>Key Interfaces- Internal</h2>
              <h2>Behavioural Competencies</h2>
              <p>Effective Communication Resilience Accountability Teamwork Judgement & Analysis Learning Agility</p>
              <h2>Equal Opportunities Employment at Example Hospitality</h2>
              <p>At Example Hospitality, we celebrate diversity and are committed to creating an inclusive environment for all employees.</p>
            </section>
            <a href="/apply">Apply now</a>
            <p>Find similar jobs: Housekeeping</p>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('enrichJobWithPublicExperience refetches stale Nagarro motivational shells and keeps them verified when the public job page stays title-matched', async () => {
  const job = {
    title: 'Associate Staff Engineer',
    company: 'Nagarro',
    applyUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999982757594-associate-staff-engineer?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999982757594-associate-staff-engineer',
    experienceRequired: null,
    publicExperienceChecked: true,
    jobDescription: `
      By this point in your career, it is not just about the tech you know or how well you can code.
      It is about what more you want to do with that knowledge.
      Were you given the tools to go beyond solving for X?
      Can you help your teammates proceed in the right direction?
      Can you tackle the challenges our clients face while always looking to take our solutions one step further to succeed at an even higher level?
      Yes? You may be ready to join us.
    `,
  }
  let rawFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Associate Staff Engineer</h1>
            <p>By this point in your career, it is not just about the tech you know or how well you can code.</p>
            <p>It is about what more you want to do with that knowledge.</p>
            <p>Were you given the tools to go beyond solving for X?</p>
            <p>Can you help your teammates proceed in the right direction?</p>
            <p>Can you tackle the challenges our clients face while always looking to take our solutions one step further to succeed at an even higher level?</p>
            <p>Yes? You may be ready to join us.</p>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('enrichJobWithPublicExperience preserves newly verified Nagarro shells when browser fallback stays empty', async () => {
  const job = {
    title: 'Senior Analyst, UXD',
    company: 'Nagarro',
    applyUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999908778257-senior-analyst-uxd?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Nagarro1/743999908778257-senior-analyst-uxd',
    experienceRequired: null,
    publicExperienceChecked: false,
    jobDescription: null,
  }
  let rawFetchCount = 0
  let browserFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Senior Analyst, UXD</h1>
            <p>Job Description: By this point in your career, it is not just about the tech you know or how well you can code.</p>
            <p>Were you given the tools to go beyond solving for X? Can you help your teammates proceed in the right direction?</p>
          </body>
        </html>
      `
    },
    fetchBrowserText: async () => {
      browserFetchCount += 1
      return '<html></html>'
    },
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(browserFetchCount, 0)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, true)
})

test('enrichJobWithPublicExperience does not retain stale short previews after refresh', async () => {
  const stalePreview = `
    Yubi stands for ubiquitous. But Yubi will also stand for transparency, collaboration,
    and the power of possibility. From being a disruptor in India’s ...
  `
  const job = {
    title: 'Lead Engineer - Agentic AI',
    company: 'Yubi',
    applyUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000026385417/Lead-Engineer---Agentic-AI?source=CareerSite',
    sourceUrl: 'https://go-yubi.zohorecruit.in/jobs/Careers/66789000026385417/Lead-Engineer---Agentic-AI?source=CareerSite',
    experienceRequired: null,
    publicExperienceChecked: true,
    description: stalePreview,
    jobDescription: stalePreview,
  }
  let rawFetchCount = 0

  const enriched = await enrichJobWithPublicExperience(job, {
    fetchText: async (url) => {
      rawFetchCount += 1
      assert.equal(url, job.sourceUrl)
      return `
        <html>
          <body>
            <h1>Lead Engineer - Agentic AI</h1>
            <p>Yubi stands for ubiquitous. But Yubi will also stand for transparency, collaboration, and the power of possibility. From being a disruptor in India’s ...</p>
          </body>
        </html>
      `
    },
    useBrowserFallback: false,
  })

  assert.equal(rawFetchCount, 1)
  assert.equal(enriched.experienceRequired, null)
  assert.equal(enriched.jobDescription, null)
  assert.equal(enriched.publicExperienceChecked, false)
})

test('inferExperienceFromPublicPageHtml captures contextual month-based experience from public job pages', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'HR Recruiter',
    company: 'Aabasoft',
    applyUrl: 'https://www.aabasoft.com/in-en/CarrerDetails/HR-Recruiter1644',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <section>
          <h2>What we expect from you</h2>
          <p>Minimum 6 months of experience in end-to-end recruitment.</p>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, '6+ months')
})

test('inferExperienceFromPublicPageHtml ignores timeline month ranges that are not experience requirements', () => {
  const enriched = inferExperienceFromPublicPageHtml({
    title: 'Product Owner - Design Automation',
    company: 'SKF',
    applyUrl: 'https://career.skf.com/talentcommunity/apply/1393716433/?locale=en_GB',
    experienceRequired: null,
  }, `
    <html>
      <body>
        <section>
          <h2>Role overview</h2>
          <p>Maintain a tactical/operational roadmap covering 3-6 months.</p>
        </section>
      </body>
    </html>
  `)

  assert.equal(enriched.experienceRequired, null)
})
