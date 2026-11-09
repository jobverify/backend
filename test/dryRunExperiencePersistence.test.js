import assert from 'node:assert/strict'
import nodeFs from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js'

test('saveDryRunSnapshot enriches missing experience before writing dry-run jobs.json', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    await saveDryRunSnapshot([
      {
        title: 'Cloud Engineer',
        company: 'Virtusa',
        location: 'Hyderabad, India',
        applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
        sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
        experienceRequired: null,
      },
    ], outputPath, {
      fetchText: async (url) => {
        assert.equal(url, 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123')
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
      useBrowserFallback: false,
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, '5 years')
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot can reuse a caller-provided browser fallback fetcher', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    await saveDryRunSnapshot([
      {
        title: 'Associate Engineer',
        company: 'Example Labs',
        location: 'Bengaluru, India',
        applyUrl: 'https://example.com/jobs/associate-engineer',
        sourceUrl: 'https://example.com/jobs/associate-engineer',
        experienceRequired: null,
      },
    ], outputPath, {
      fetchBrowserText: async (url) => {
        assert.equal(url, 'https://example.com/jobs/associate-engineer')
        return `
          <html>
            <body>
              <section>
                <h2>Required Experience</h2>
                <p>2-4 years</p>
              </section>
            </body>
          </html>
        `
      },
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, '2-4 years')
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot marks public pages as checked even when experience stays unspecified', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    await saveDryRunSnapshot([
      {
        title: 'Cloud Engineer',
        company: 'Example Cloud',
        location: 'Bengaluru, India',
        applyUrl: 'https://example.com/jobs/cloud-engineer',
        sourceUrl: 'https://example.com/jobs/cloud-engineer',
        experienceRequired: null,
      },
    ], outputPath, {
      fetchText: async (url) => {
        assert.equal(url, 'https://example.com/jobs/cloud-engineer')
        return `
          <html>
            <head>
              <title>Cloud Engineer</title>
            </head>
            <body>
              <section>
                <h2>Job Description</h2>
                <p>Build internal cloud platforms, automate delivery pipelines, and collaborate with SRE teams.</p>
              </section>
            </body>
          </html>
        `
      },
      useBrowserFallback: false,
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, null)
    assert.equal(parsed[0].publicExperienceChecked, true)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot keeps provider-supplied qualification evidence checked when the linked public page is only a generic shell', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    let fetchCount = 0

    await saveDryRunSnapshot([
      {
        title: 'DFT-DV Engineer',
        company: 'AMD',
        location: 'Hyderabad, India',
        applyUrl: 'https://global-external-amd.icims.com/jobs/84984/login',
        sourceUrl: 'https://global-external-amd.icims.com/jobs/84984/login',
        experienceRequired: null,
        jobDescription: `
          <section>
            <h2>What you do at AMD changes everything</h2>
            <p>Join a collaborative silicon design team building next-generation compute products.</p>
            <p>The role focuses on DFT validation, verification workflows, debug ownership, and cross-functional delivery.</p>
          </section>
        `,
        minimumQualification: `
          <section>
            <p>Benefits offered are described on the AMD careers site.</p>
          </section>
        `,
        preferredQualification: `
          <section>
            <h2>Key Responsibilities</h2>
            <ul>
              <li>Own DFT-DV planning and execution for complex SoCs.</li>
              <li>Collaborate with design, ATPG, and post-silicon partners.</li>
            </ul>
          </section>
        `,
      },
    ], outputPath, {
      fetchText: async (url) => {
        fetchCount += 1
        assert.equal(url, 'https://global-external-amd.icims.com/jobs/84984/login')
        return `
          <html>
            <head><title>Login</title></head>
            <body>
              <p>Our Careers Site has Moved.</p>
              <p>Returning User Login</p>
            </body>
          </html>
        `
      },
      useBrowserFallback: false,
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, null)
    assert.equal(parsed[0].publicExperienceChecked, true)
    assert.equal(fetchCount, 0)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot recognizes split heading artifacts in provider-supplied public evidence before falling back to a generic shell', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    let fetchCount = 0

    await saveDryRunSnapshot([
      {
        title: 'DFT-DV Engineer',
        company: 'AMD',
        location: 'Hyderabad, India',
        applyUrl: 'https://global-external-amd.icims.com/jobs/84984/login',
        sourceUrl: 'https://global-external-amd.icims.com/jobs/84984/login',
        experienceRequired: null,
        jobDescription: `
          <section>
            <p>What you do at AMD changes everything.</p>
            <p>SMTS SILICON DESIGN ENGINEER T HE ROLE: Build DFT validation flows for advanced silicon programs.</p>
            <p>THE PERSON: You collaborate across architecture, design, and post-silicon teams.</p>
          </section>
        `,
        preferredQualification: `
          <section>
            <p>K EY RESPONSIBLITIES: Implementation and verification of DFT architecture and features.</p>
            <p>P REFERRED EXPERIENCE: Understanding of design for test methodologies and DFT verification experience.</p>
          </section>
        `,
      },
    ], outputPath, {
      fetchText: async (url) => {
        fetchCount += 1
        assert.equal(url, 'https://global-external-amd.icims.com/jobs/84984/login')
        return `
          <html>
            <head><title>Login</title></head>
            <body>
              <p>Our Careers Site has Moved.</p>
              <p>Returning User Login</p>
            </body>
          </html>
        `
      },
      useBrowserFallback: false,
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, null)
    assert.equal(parsed[0].publicExperienceChecked, true)
    assert.equal(fetchCount, 0)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot treats expertise-led role descriptions as verified public evidence when no numeric experience is published', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    let fetchCount = 0

    await saveDryRunSnapshot([
      {
        title: 'Account Manager/ Sr Account Manager-SEO',
        company: 'HiveMinds',
        location: 'Bengaluru, India',
        applyUrl: 'https://hiveminds.keka.com/careers/jobdetails/6670',
        sourceUrl: 'https://hiveminds.keka.com/careers/jobdetails/6670',
        experienceRequired: null,
        jobDescription: `
          <section>
            <p>Expertise - Should have executed keyword research, content planning, backlink building, technical SEO audits, and page speed performance work.</p>
            <p>Comfortable analysing high volumes of data daily, using different SEO tools, and handling team coordination across projects.</p>
            <p>Familiarity with WordPress or other content management systems is a plus, along with competitive analysis across the industry.</p>
          </section>
        `,
      },
    ], outputPath, {
      fetchText: async (url) => {
        fetchCount += 1
        assert.equal(url, 'https://hiveminds.keka.com/careers/jobdetails/6670')
        return `
          <html>
            <head><title>Login</title></head>
            <body>
              <p>Sign in to continue.</p>
            </body>
          </html>
        `
      },
      useBrowserFallback: false,
    })

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].experienceRequired, null)
    assert.equal(parsed[0].publicExperienceChecked, true)
    assert.equal(fetchCount, 0)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot skips rewriting jobs.json when the normalized dry-run snapshot is unchanged', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')

  try {
    const jobs = [
      {
        title: 'Software Engineer',
        company: 'Example Labs',
        location: 'Bengaluru, India',
        applyUrl: 'https://example.com/jobs/software-engineer',
        sourceUrl: 'https://example.com/jobs/software-engineer',
        experienceRequired: '3-5 years',
        publicExperienceChecked: true,
      },
    ]

    await saveDryRunSnapshot(jobs, outputPath, {
      enrichPublicExperience: false,
    })

    const originalWriteFile = nodeFs.promises.writeFile
    const originalRename = nodeFs.promises.rename
    let writeAttempts = 0
    let renameAttempts = 0

    nodeFs.promises.writeFile = async (...args) => {
      writeAttempts += 1
      return originalWriteFile(...args)
    }
    nodeFs.promises.rename = async (...args) => {
      renameAttempts += 1
      return originalRename(...args)
    }

    try {
      await saveDryRunSnapshot(jobs, outputPath, {
        enrichPublicExperience: false,
      })
    } finally {
      nodeFs.promises.writeFile = originalWriteFile
      nodeFs.promises.rename = originalRename
    }

    assert.equal(writeAttempts, 0)
    assert.equal(renameAttempts, 0)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot preserves the last good jobs.json when an atomic temp write fails with ENOSPC', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')
  const originalContent = JSON.stringify([{ title: 'Last known good snapshot' }], null, 2)

  try {
    await fs.writeFile(outputPath, originalContent, 'utf8')

    const originalWriteFile = nodeFs.promises.writeFile
    const originalRename = nodeFs.promises.rename
    const diskFullError = Object.assign(
      new Error('ENOSPC: no space left on device, write'),
      { code: 'ENOSPC' },
    )

    nodeFs.promises.writeFile = async (filePath, ...args) => {
      if (String(filePath) !== outputPath) {
        throw diskFullError
      }

      return originalWriteFile(filePath, ...args)
    }
    nodeFs.promises.rename = async (...args) => originalRename(...args)

    try {
      await assert.rejects(
        saveDryRunSnapshot([
          {
            title: 'Cloud Engineer',
            company: 'Example Labs',
            location: 'Bengaluru, India',
            applyUrl: 'https://example.com/jobs/cloud-engineer',
            sourceUrl: 'https://example.com/jobs/cloud-engineer',
            experienceRequired: null,
          },
        ], outputPath, {
          enrichPublicExperience: false,
        }),
        (error) => error?.code === 'ENOSPC',
      )
    } finally {
      nodeFs.promises.writeFile = originalWriteFile
      nodeFs.promises.rename = originalRename
    }

    assert.equal(await fs.readFile(outputPath, 'utf8'), originalContent)
    assert.deepEqual(await fs.readdir(tempDir), ['jobs.json'])
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('saveDryRunSnapshot can fall back to an in-place rewrite when atomic temp writes hit ENOSPC', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const outputPath = path.join(tempDir, 'jobs.json')
  const originalContent = JSON.stringify([{ title: 'Last known good snapshot' }], null, 2)

  try {
    await fs.writeFile(outputPath, originalContent, 'utf8')

    const originalWriteFile = nodeFs.promises.writeFile
    const originalRename = nodeFs.promises.rename
    const diskFullError = Object.assign(
      new Error('ENOSPC: no space left on device, write'),
      { code: 'ENOSPC' },
    )

    nodeFs.promises.writeFile = async (filePath, ...args) => {
      if (String(filePath) !== outputPath) {
        throw diskFullError
      }

      return originalWriteFile(filePath, ...args)
    }
    nodeFs.promises.rename = async (...args) => originalRename(...args)

    try {
      await saveDryRunSnapshot([
        {
          title: 'Cloud Engineer',
          company: 'Example Labs',
          location: 'Bengaluru, India',
          applyUrl: 'https://example.com/jobs/cloud-engineer',
          sourceUrl: 'https://example.com/jobs/cloud-engineer',
          experienceRequired: null,
          publicExperienceChecked: true,
        },
      ], outputPath, {
        enrichPublicExperience: false,
        allowInPlaceRewriteOnEnospc: true,
      })
    } finally {
      nodeFs.promises.writeFile = originalWriteFile
      nodeFs.promises.rename = originalRename
    }

    const rewritten = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert.equal(rewritten.length, 1)
    assert.equal(rewritten[0].title, 'Cloud Engineer')
    assert.equal(rewritten[0].publicExperienceChecked, true)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
