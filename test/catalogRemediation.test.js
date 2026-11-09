import assert from 'node:assert/strict'
import test from 'node:test'
import { identifyPublicAtsBoard, discoverOfficialAtsBoards, auditCatalogProvider } from '../scripts/remediateScraperCatalog.js'

test('ATS discovery recognizes exact supported hosts and tokens, including embed URLs', () => {
  assert.deepEqual(identifyPublicAtsBoard('https://boards.greenhouse.io/embed/job_board?for=acme'), { atsPlatform: 'greenhouse', boardToken: 'acme' })
  assert.deepEqual(identifyPublicAtsBoard('https://api.ashbyhq.com/posting-api/job-board/acme'), { atsPlatform: 'ashby', boardToken: 'acme' })
  assert.deepEqual(identifyPublicAtsBoard('https://jobs.lever.co/Acme/123'), { atsPlatform: 'lever', boardToken: 'Acme' })
  assert.equal(identifyPublicAtsBoard('https://boards.greenhouse.io.evil.test/acme'), null)
  assert.equal(identifyPublicAtsBoard('https://jobs.ashbyhq.com/${company}'), null)
})

test('official careers page proves an actual board link without guessing a tenant from the source name', async () => {
  const pages = {
    'https://acme.test/careers': { status: 200, url: 'https://acme.test/careers', html: '<a href="https://jobs.ashbyhq.com/acme-real">Open roles</a>' },
  }
  const result = await discoverOfficialAtsBoards({ source: 'acme', companyCareerPage: 'https://acme.test/careers' }, {
    fetchPage: async url => pages[url] || { status: 404, url, html: '' },
  })
  assert.equal(result.boards.length, 1)
  assert.equal(result.boards[0].boardToken, 'acme-real')
  assert.equal(result.boards[0].bindingEvidence.officialURL, 'https://acme.test/careers')
})

test('an ATS URL alone or guessed company name does not establish employer identity', async () => {
  let calls = 0
  const result = await discoverOfficialAtsBoards({ source: 'linkedin', companyCareerPage: 'https://jobs.lever.co/linkedin', companyDomain: 'jobs.lever.co' }, {
    fetchPage: async () => { calls++; return { status: 200, html: '' } },
  })
  assert.equal(result.boards.length, 0)
  assert.equal(calls, 0)
  assert.equal(result.reason, 'missing-official-company-surface')
})

test('homepage links are followed to careers, but unrelated ATS links are ignored', async () => {
  const pages = {
    'https://acme.test/': { status: 200, url: 'https://acme.test/', html: '<a href="https://jobs.lever.co/customer">Customer story</a><a href="/careers">Careers</a>' },
    'https://acme.test/careers': { status: 200, url: 'https://acme.test/careers', html: '<iframe src="https://boards.greenhouse.io/embed/job_board?for=acme"></iframe>' },
  }
  const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test' }, { fetchPage: async url => pages[url] || { status: 404, url, html: '' } })
  assert.deepEqual(result.boards.map(x => [x.atsPlatform, x.boardToken]), [['greenhouse', 'acme']])
})

test('conflicting official boards require review rather than choosing a successful unrelated feed', async () => {
  const result = await auditCatalogProvider({ source: 'acme', companyCareerPage: 'https://acme.test/careers' }, {
    fetchPage: async url => ({ status: 200, url, html: '<a href="https://jobs.ashbyhq.com/acme">Open roles</a><a href="https://jobs.lever.co/other">View jobs</a>' }),
    scrape: async () => { throw new Error('Ambiguous boards must not be extracted automatically') },
  })
  assert.equal(result.outcome, 'ambiguous-official-boards')
  assert.equal(result.rawJobs, null)
})

test('inactive markup and unrelated careers-page links cannot establish an employer binding', async () => {
  const link = '<a href="https://jobs.ashbyhq.com/other">Open roles</a>'
  for (const html of [`<!--${link}-->`, `<template>${link}</template>`, `<div hidden>${link}</div>`, `<textarea>${link}</textarea>`, `<xmp>${link}</xmp>`, `<object data="/existing.pdf" type="application/pdf">${link}</object>`, '<object data="/existing.pdf"><iframe src="https://jobs.ashbyhq.com/other"></iframe></object>', '<a href="https://jobs.lever.co/customer">Customer story</a>', '<iframe src="https://jobs.ashbyhq.com/other" srcdoc=""></iframe>']) {
    const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test', companyCareerPage: 'https://acme.test/careers' }, {
      fetchPage: async url => ({ status: 200, url, html }),
    })
    assert.equal(result.boards.length, 0, html)
  }
})

test('actual final response and trusted company host are mandatory for binding', async () => {
  for (const response of [
    { status: 200, html: '<a href="https://jobs.ashbyhq.com/acme">Open roles</a>' },
    { status: 200, url: 'https://unrelated.test/careers', html: '<a href="https://jobs.ashbyhq.com/acme">Open roles</a>' },
  ]) {
    const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test', companyCareerPage: 'https://acme.test/careers' }, { fetchPage: async () => response })
    assert.equal(result.boards.length, 0)
  }
  let calls = 0
  const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test', companyCareerPage: 'https://linkedin.com/company/acme/jobs' }, {
    fetchPage: async url => { calls++; return { status: 200, url, html: '' } },
  })
  assert.equal(calls, 1, 'only the declared first-party company root can be requested')
  assert.equal(result.boards.length, 0)
})

test('script URL examples remain unverified candidates instead of binding evidence', async () => {
  for (const external of [false, true]) {
    const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test', companyCareerPage: 'https://acme.test/careers' }, {
      fetchPage: async url => ({ status: 200, url, html: url.endsWith('.js') ? 'const documentationExample="https://jobs.ashbyhq.com/example"' : external ? '<script src="/careers.js"></script>' : '<script>const example="https://jobs.ashbyhq.com/example"</script>' }),
    })
    assert.equal(result.boards.length, 0)
    assert.equal(result.candidateBoards.length, 1)
    assert.equal(result.candidateBoards[0].bindingEvidence.verified, false)
  }
})

test('a successful current first-party redirect can establish an ATS binding', async () => {
  const result = await discoverOfficialAtsBoards({ source: 'acme', companyDomain: 'acme.test', companyCareerPage: 'https://acme.test/careers' }, {
    fetchPage: async () => ({ status: 200, url: 'https://jobs.ashbyhq.com/acme', html: '' }),
  })
  assert.equal(result.boards.length, 1)
  assert.equal(result.boards[0].bindingEvidence.bindingMethod, 'official-redirect')
})

test('audit uses actual shared extraction, preserves first-party evidence, and separates zero India inventory', async () => {
  const result = await auditCatalogProvider({ source: 'acme', companyName: 'Acme', companyCareerPage: 'https://acme.test/careers' }, {
    fetchPage: async url => ({ status: 200, url, html: '<a href="https://boards.greenhouse.io/acme">Open roles</a>' }),
    fetchJson: async () => ({ jobs: [{ id: 1, title: 'Engineer', location: { name: 'Bangalore, India' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/1', content: 'Develop reliable software systems.', first_published: new Date().toISOString() }], meta: { total: 1 } }),
  })
  assert.equal(result.outcome, 'ready-for-validation')
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.jobs[0].company, 'Acme')
  assert.equal(result.inventoryEvidence.listingComplete, true)
})

test('missing or truncated native totals cannot qualify an empty remediation result', async () => {
  for (const payload of [{ jobs: [] }, { jobs: [], meta: { total: 1 } }]) {
    const result = await auditCatalogProvider({ source: 'acme', companyName: 'Acme', companyCareerPage: 'https://acme.test/careers' }, {
      fetchPage: async url => ({ status: 200, url, html: '<a href="https://boards.greenhouse.io/acme">Open roles</a>' }),
      fetchJson: async () => payload,
    })
    assert.equal(result.outcome, 'extraction-failed')
    assert.equal(result.rawJobs, null)
    assert.equal(result.eligibleJobs, null)
    assert.equal(result.inventoryEvidence, null)
  }
})
