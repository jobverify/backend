import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createNagarroScraper, SMARTRECRUITERS_LISTING_API_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./nativeEvidence/controlled-native-shapes-20261031.json', import.meta.url)))
const replay = async (kind, { mutate, mutateListing, onDetail, maxJobs, empty = false, secondRole = false } = {}) => {
  const listing = structuredClone(fixture.listing), detail = structuredClone(fixture.cases[kind])
  mutateListing?.(listing, detail)
  mutate?.(detail)
  const details = new Map([[listing.content[0].id, detail]])
  if (empty) { listing.totalFound = 0; listing.content = [] }
  if (secondRole) {
    const next = structuredClone(detail), nextListing = structuredClone(listing.content[0])
    next.id = nextListing.id = '744000138066872'
    next.refNumber = nextListing.refNumber = 'REF-NAG-101'
    next.postingUrl = next.postingUrl.replace(detail.id, next.id)
    next.applyUrl = next.applyUrl.replace(detail.id, next.id)
    nextListing.ref = nextListing.ref.replace(detail.id, next.id)
    listing.content.push(nextListing)
    listing.totalFound++
    details.set(next.id, next)
  }
  const requested = []
  const jobs = await createNagarroScraper({ maxJobs }).run({
    fetchText: async url => {
      requested.push(url)
      assert.ok(Object.hasOwn(fixture.preflight, url), 'Uncaptured Nagarro preflight: ' + url)
      return fixture.preflight[url]
    },
    fetchJson: async url => {
      requested.push(url)
      const request = new URL(url)
      assert.equal(request.origin, 'https://api.smartrecruiters.com')
      if (request.pathname === '/v1/companies/Nagarro1/postings') return listing
      const id = request.pathname.match(/^\/v1\/companies\/Nagarro1\/postings\/([^/]+)$/)?.[1]
      assert.ok(details.has(id), 'Uncaptured Nagarro detail: ' + url)
      onDetail?.(id)
      return details.get(id)
    },
  })
  return { jobs, detail, requested }
}

for (const kind of ['rich', 'qualification-only', 'privacy-only', 'motivational-shell']) {
  test('Nagarro retains exact native fields and genuine public URLs for ' + kind + ' detail', async () => {
    const { jobs, detail } = await replay(kind)
    assert.equal(jobs.length, 1)
    const [job] = jobs
    assert.equal(job.jobDescription, detail.jobAd.sections.jobDescription.text)
    assert.equal(job.minimumQualification, detail.jobAd.sections.qualifications.text)
    assert.equal(job.preferredQualification, detail.jobAd.sections.additionalInformation.text)
    assert.equal(job.title, detail.name)
    assert.equal(job.location, detail.location.fullLocation)
    assert.equal(job.jobId, detail.id)
    assert.equal(job.requisitionId, detail.refNumber)
    assert.equal(job.applyUrl, detail.applyUrl)
    assert.equal(job.sourceUrl, detail.postingUrl)
    assert.equal(job.link, detail.postingUrl)
    const complete = kind === 'rich'
    if (complete) assert.notEqual(job.sourceDetailComplete, false)
    else assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.publicExperienceChecked, complete)
    assert.equal(extractionDetailHealth(jobs).complete, complete)
    if (!complete) assert.equal(job.sourceDetailFailureKind, 'missing-content')
    const evidence = readInventoryEvidence(jobs)
    assert.ok(evidence, 'Company wrapper must retain shared inventory evidence')
    assert.equal(evidence.surface, SMARTRECRUITERS_LISTING_API_URL)
    assert.equal(evidence.reportedTotal, 1)
    assert.equal(evidence.listingComplete, complete)
  })
}

test('Nagarro keeps real role responsibilities after a generic introduction without rewriting native content', async () => {
  const { jobs, detail } = await replay('rich', { mutate: native => {
    native.jobAd.sections.jobDescription.text = fixture.cases['motivational-shell'].jobAd.sections.jobDescription.text
      + native.jobAd.sections.jobDescription.text
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.notEqual(jobs[0].sourceDetailComplete, false)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('Nagarro marks markup-only native JD incomplete without copying qualifications into it', async () => {
  const { jobs, detail } = await replay('rich', { mutate: native => {
    native.jobAd.sections.jobDescription.text = '<p><img src="https://www.nagarro.com/role.png"></p>'
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].minimumQualification, detail.jobAd.sections.qualifications.text)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const placeholder of ['TBD', '<p>TBD</p>']) {
  test('Nagarro preserves the explicit native placeholder ' + JSON.stringify(placeholder) + ' while reporting missing role content', async () => {
    const { jobs, detail } = await replay('rich', { mutate: native => {
      native.jobAd.sections.jobDescription.text = placeholder
    } })
    const [job] = jobs
    assert.equal(job.jobDescription, placeholder)
    assert.equal(job.minimumQualification, detail.jobAd.sections.qualifications.text)
    assert.equal(job.preferredQualification, detail.jobAd.sections.additionalInformation.text)
    assert.equal(job.applyUrl, detail.applyUrl)
    assert.equal(job.sourceUrl, detail.postingUrl)
    assert.equal(job.jobId, detail.id)
    assert.equal(job.requisitionId, detail.refNumber)
    assert.equal(job.publicExperienceChecked, false)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailFailureKind, 'missing-content')
    assert.equal(extractionDetailHealth(jobs).complete, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  })
}

for (const kind of ['rich', 'qualification-only', 'privacy-only', 'motivational-shell']) {
  test('Nagarro rejects a foreign application tenant for ' + kind + ' detail', async () => {
    await assert.rejects(replay(kind, { mutate: native => {
      native.applyUrl = native.applyUrl.replace('/Nagarro1/', '/AnotherCompany/')
    } }), /SmartRecruiters company identifier changed/)
  })
}

test('a genuine Nagarro apply URL cannot hide a foreign public posting URL', async () => {
  await assert.rejects(replay('rich', { mutate: native => {
    native.postingUrl = native.postingUrl.replace('/Nagarro1/', '/AnotherCompany/')
  } }), /SmartRecruiters company identifier changed/)
})

for (const field of ['applyUrl', 'postingUrl']) {
  for (const contradiction of ['foreign tenant', 'different role']) {
    test('Nagarro rejects listing ' + field + ' with ' + contradiction + ' before detail hydration can overwrite it', async () => {
      let detailReads = 0
      await assert.rejects(replay('rich', {
        mutateListing: (listing, detail) => {
          listing.content[0][field] = contradiction === 'foreign tenant'
            ? detail[field].replace('/Nagarro1/', '/OtherCompany/')
            : detail[field].replace(detail.id, '744000138066999')
        },
        onDetail: () => detailReads++,
      }), /Nagarro.*(?:identity|company identifier)/)
      assert.equal(detailReads, 0, 'Contradictory supplied listing URLs cannot be hidden by a successful detail')
    })
  }
}

test('Nagarro preserves genuine same-role listing and detail URLs independently', async () => {
  const { jobs, detail } = await replay('rich', { mutateListing: (listing, native) => {
    listing.content[0].applyUrl = native.applyUrl
    listing.content[0].postingUrl = native.postingUrl
  } })
  assert.equal(jobs[0].applyUrl, detail.applyUrl)
  assert.equal(jobs[0].sourceUrl, detail.postingUrl)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

const responsibilities = '<div>Build and maintain distributed backend services.</div>'
for (const [name, transform] of [
  ['neutral field heading', text => '<h2>Job Description</h2>' + text],
  ['nested neutral field label', text => '<div><strong>Job Description:</strong></div>' + text],
  ['hidden role text', text => text + responsibilities.replace('<div>', '<div hidden>')],
  ['inert role text', text => text + responsibilities.replace('<div>', '<div inert>')],
  ['aria-hidden role text', text => text + responsibilities.replace('<div>', '<div aria-hidden="true">')],
  ['display-none role text', text => text + responsibilities.replace('<div>', '<div style="display:none">')],
  ['visibility-hidden role text', text => text + responsibilities.replace('<div>', '<div style="visibility:hidden">')],
  ['opacity-zero role text', text => text + responsibilities.replace('<div>', '<div style="opacity:0">')],
  ['stylesheet-hidden role text', text => text + '<style>.hiddencriteria{display:none}</style>' + responsibilities.replace('<div>', '<div class="hiddencriteria">')],
  ['template role text', text => text + '<template>' + responsibilities + '</template>'],
  ['noscript role text', text => text + '<noscript>' + responsibilities + '</noscript>'],
  ['script role text', text => text + '<script>' + responsibilities + '</script>'],
  ['encoded decimal letter', text => text.replace('Were', '&#87;ere')],
  ['encoded hexadecimal letter', text => text.replace('Were', '&#x57;ere')],
  ['encoded word spacing', text => text.replace('Were you', 'Were&#32;you')],
  ['encoded named apostrophe in the known shell', text => text.replace('Were', 'We&rsquo;re')],
  ['encoded numeric apostrophe in the known shell', text => text.replace('Were', 'We&#8217;re')],
  ['literal curly apostrophe in the known shell', text => text.replace('Were', 'We’re')],
]) test('Nagarro assesses visible motivational-only content with ' + name + ' while preserving raw JD bytes', async () => {
  const { jobs, detail } = await replay('motivational-shell', { mutate: native => {
    native.jobAd.sections.jobDescription.text = transform(native.jobAd.sections.jobDescription.text)
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].minimumQualification, detail.jobAd.sections.qualifications.text)
  assert.equal(jobs[0].preferredQualification, detail.jobAd.sections.additionalInformation.text)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('hidden-only role text cannot establish a complete visible Nagarro description', async () => {
  const { jobs, detail } = await replay('rich', { mutate: native => {
    native.jobAd.sections.jobDescription.text = '<div hidden>' + native.jobAd.sections.jobDescription.text + '</div>'
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a genuine visible responsibility heading following generic copy remains native role content', async () => {
  const { jobs, detail } = await replay('rich', { mutate: native => {
    native.jobAd.sections.jobDescription.text = fixture.cases['motivational-shell'].jobAd.sections.jobDescription.text
      + '<h2>Build and maintain distributed backend services for enterprise clients.</h2>'
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('an unrelated stylesheet hiding rule does not discard genuine visible Nagarro responsibilities', async () => {
  const { jobs, detail } = await replay('rich', { mutate: native => {
    native.jobAd.sections.jobDescription.text = '<style>.hiddencriteria{display:none}</style>'
      + fixture.cases['motivational-shell'].jobAd.sections.jobDescription.text
      + native.jobAd.sections.jobDescription.text
  } })
  assert.equal(jobs[0].jobDescription, detail.jobAd.sections.jobDescription.text)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

for (const field of ['postingUrl', 'applyUrl']) test('Nagarro binds native ' + field + ' to this exact requisition', async () => {
  await assert.rejects(replay('rich', { mutate: native => {
    native[field] = native[field].replace(native.id, '744000138066999')
  } }), /Nagarro.*(?:identity|company identifier)/)
})

test('Nagarro rejects a detail response for a different requested native role', async () => {
  await assert.rejects(replay('rich', { mutate: native => {
    const originalId = native.id
    native.id = '744000138066999'
    native.postingUrl = native.postingUrl.replace(originalId, native.id)
    native.applyUrl = native.applyUrl.replace(originalId, native.id)
  } }), /Nagarro.*identity/)
})

test('Nagarro rejects a contradictory native requisition reference', async () => {
  await assert.rejects(replay('rich', { mutate: native => {
    native.refNumber = 'REF-OTHER-ROLE'
  } }), /Nagarro.*identity/)
})

test('Nagarro ownership parsing cannot trust an official URL embedded in a foreign query', async () => {
  await assert.rejects(replay('rich', { mutate: native => {
    native.applyUrl = 'https://foreign.example/apply?next=' + native.applyUrl
  } }), /SmartRecruiters company identifier changed/)
})

test('Nagarro preserves genuine empty-inventory evidence through its wrapper', async () => {
  const { jobs } = await replay('rich', { empty: true })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 0)
})

test('a Nagarro output cap retains observed total and marks the returned inventory partial', async () => {
  const { jobs } = await replay('rich', { secondRole: true, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  const evidence = readInventoryEvidence(jobs)
  assert.ok(evidence)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
})
