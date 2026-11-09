import assert from 'node:assert/strict'
import test from 'node:test'

import { extractJobDetail } from '../detailExtractors/index.js'

test('extractJobDetail parses Workday responsibilities and qualifications into plain text fields', async () => {
  const result = await extractJobDetail({
    provider: 'workday',
    html: `
      <section data-automation-id="jobPostingDescription">
        <div>
          <p>Build backend systems for payments and identity.</p>
        </div>
      </section>
      <section>
        <h3>Basic Qualifications</h3>
        <ul>
          <li>B.E./B.Tech in CSE or IT</li>
          <li>0-1 years of experience</li>
        </ul>
      </section>
      <section>
        <h3>Preferred Qualifications</h3>
        <ul>
          <li>Node.js</li>
          <li>AWS</li>
        </ul>
      </section>
      <dl>
        <dt>Department</dt>
        <dd>Platform Engineering</dd>
        <dt>Job Requisition ID</dt>
        <dd>JR-42</dd>
      </dl>
    `,
  })

  assert.match(result.jobDescription, /Build backend systems/i)
  assert.match(result.minimumQualification, /B\.E\.\/B\.Tech/i)
  assert.match(result.experienceRequired, /0-1 years/i)
  assert.deepEqual(result.requiredSkills, ['B.E.', 'B.Tech in CSE or IT', 'Node.js', 'AWS'])
  assert.equal(result.department, 'Platform Engineering')
  assert.equal(result.requisitionId, 'JR-42')
})

test('extractJobDetail falls back to Workday JSON-LD when the detail page is rendered as an app shell', async () => {
  const result = await extractJobDetail({
    provider: 'workday',
    html: `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "ECG India Program Manager",
              "identifier": {
                "@type": "PropertyValue",
                "value": "JR0285085"
              },
              "description": "Job Details: Job Description: Build backend systems for manufacturing analytics. Qualifications: 0-1 years of experience with Node.js and AWS. Posting Statement: Equal opportunity employer."
            }
          </script>
        </head>
        <body><div id="root"></div></body>
      </html>
    `,
  })

  assert.equal(result.jobDescription, 'Build backend systems for manufacturing analytics.')
  assert.equal(result.minimumQualification, '0-1 years of experience with Node.js and AWS.')
  assert.equal(result.experienceRequired, '0-1 years')
  assert.equal(result.requisitionId, 'JR0285085')
})

test('extractJobDetail parses Google qualifications and experience cues into normalized detail fields', async () => {
  const result = await extractJobDetail({
    provider: 'google',
    html: `
      <section>
        <h2>About the job</h2>
        <div>Build distributed systems for ads serving and developer workflows.</div>
      </section>
      <section>
        <h3>Minimum qualifications</h3>
        <ul>
          <li>Bachelor's degree in Computer Science</li>
          <li>2 years of experience with Java and distributed systems</li>
        </ul>
      </section>
      <section>
        <h3>Preferred qualifications</h3>
        <ul>
          <li>Experience with GCP and Kubernetes</li>
        </ul>
      </section>
    `,
  })

  assert.match(result.jobDescription, /Build distributed systems/i)
  assert.match(result.minimumQualification, /Bachelor's degree/i)
  assert.match(result.preferredQualification, /GCP and Kubernetes/i)
  assert.match(result.experienceRequired, /2 years of experience/i)
  assert.deepEqual(result.requiredSkills, ['Bachelor\'s degree in Computer Science', '2 years of experience with Java', 'distributed systems', 'Experience with GCP', 'Kubernetes'])
})

test('extractJobDetail parses Rubrik requirements into reusable detail fields', async () => {
  const result = await extractJobDetail({
    provider: 'rubrik',
    html: `
      <section>
        <h2>What you'll do</h2>
        <ul>
          <li>Build internal tools for customer support workflows</li>
          <li>Partner with product and design teams</li>
        </ul>
      </section>
      <section>
        <h2>Requirements</h2>
        <ul>
          <li>3+ years of software engineering experience</li>
          <li>Strong JavaScript and React fundamentals</li>
        </ul>
      </section>
    `,
  })

  assert.match(result.jobDescription, /Build internal tools/i)
  assert.match(result.minimumQualification, /3\+ years of software engineering experience/i)
  assert.match(result.experienceRequired, /3\+ years/i)
  assert.deepEqual(result.requiredSkills, ['Strong JavaScript', 'React fundamentals'])
})

test('extractJobDetail returns the empty detail shape for unsupported providers', async () => {
  const result = await extractJobDetail({
    provider: 'unknown-provider',
    html: '<section><p>Ignored</p></section>',
  })

  assert.deepEqual(result, {
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: null,
    publicExperienceChecked: false,
    postingDate: null,
    department: null,
    requisitionId: null,
  })
})
