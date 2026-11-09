import assert from 'node:assert/strict'
import test from 'node:test'

const loadBgstModule = async () => {
  try {
    return await import('../../scraper/boschglobalsoftwaretechnologies/script.js')
  } catch {
    return null
  }
}

const sampleListingPayload = {
  _embedded: {
    'rh:result': [
      {
        meta: [{ count: 2 }],
        data: [
          {
            refNumber: 'REF310001A',
            name: 'Senior SW developer sensor',
            releasedDate: '2026-06-30T08:00:00.000Z',
            jobUrl: 'REF310001A-senior-sw-developer-sensor',
            function: {
              id: 'engineering',
              label: 'Engineering',
            },
            location: {
              workLocation: 'Bengaluru',
              country: 'in',
              hybrid: true,
              city: 'Bengaluru',
              remote: false,
            },
            legal_entity: {
              valueId: 'Robert Bosch Engineering and Business Solutions Private Ltd.',
              valueLabel: 'Bosch Global Software Technologies Private Limited',
            },
            type_of_contract: {
              valueLabel: 'Unlimited',
            },
          },
          {
            refNumber: 'REF310002B',
            name: 'Software Architect',
            releasedDate: '2026-06-29T08:00:00.000Z',
            jobUrl: 'REF310002B-software-architect',
            function: {
              id: 'engineering',
              label: 'Engineering',
            },
            location: {
              workLocation: 'Coimbatore',
              country: 'in',
              hybrid: false,
              city: 'Coimbatore',
              remote: false,
            },
            legal_entity: {
              valueId: 'Robert Bosch Engineering and Business Solutions Private Ltd.',
              valueLabel: 'Bosch Global Software Technologies Private Limited',
            },
            type_of_contract: {
              valueLabel: 'Unlimited',
            },
          },
        ],
      },
    ],
  },
}

const sampleDetailPayloadByRef = {
  REF310001A: [
    {
      releasedDate: '2026-06-30T08:00:00.000Z',
      refNumber: 'REF310001A',
      name: 'Senior SW developer sensor',
      jobAd: {
        sections: {
          companyDescription: {
            text: '<p>Bosch Global Software Technologies builds software and engineering solutions.</p>',
          },
          jobDescription: {
            text: '<p>Build embedded sensing software for next-generation products.</p>',
          },
          qualifications: {
            text: '<p>Strong C++ and system design experience.</p>',
          },
          additionalInformation: {
            text: '<p>Experience : 6+ years</p>',
          },
        },
      },
    },
  ],
  REF310002B: [
    {
      releasedDate: '2026-06-29T08:00:00.000Z',
      refNumber: 'REF310002B',
      name: 'Software Architect',
      jobAd: {
        sections: {
          companyDescription: {
            text: '<p>Bosch Global Software Technologies builds software and engineering solutions.</p>',
          },
          jobDescription: {
            text: '<p>Lead architecture decisions across distributed product teams.</p>',
          },
          qualifications: {
            text: '<p>Deep architecture and cloud platform knowledge.</p>',
          },
          additionalInformation: {
            text: '<p>10+</p>',
          },
        },
      },
    },
  ],
}

test('extractSearchResults maps Bosch Global Software Technologies listings and details into job records', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)

  const jobs = bgst.extractSearchResults({
    listingPayload: sampleListingPayload,
    detailPayloadByRef: sampleDetailPayloadByRef,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior SW developer sensor',
    company: 'Bosch Global Software Technologies',
    department: 'Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'REF310001A',
    requisitionId: 'REF310001A',
    sourceUrl: 'https://jobs.bosch.com/en/job/REF310001A-senior-sw-developer-sensor',
    applyUrl: 'https://jobs.bosch.com/en/job/REF310001A-senior-sw-developer-sensor',
    employmentType: 'Unlimited',
    experienceRequired: '6+ years',
    minimumQualification: 'Strong C++ and system design experience.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30T08:00:00.000Z',
    closingDate: null,
    jobDescription: 'Bosch Global Software Technologies builds software and engineering solutions. Build embedded sensing software for next-generation products. Strong C++ and system design experience. Experience : 6+ years',
    publicExperienceChecked: true,
  })
  assert.equal(jobs[1].company, 'Bosch Global Software Technologies')
  assert.equal(jobs[1].city, 'Coimbatore')
  assert.equal(jobs[1].jobId, 'REF310002B')
  assert.equal(jobs[1].experienceRequired, '10+ years')
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('extractSearchResults normalizes bare Bosch experience bands that use alternate separators', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)

  const jobs = bgst.extractSearchResults({
    listingPayload: {
      _embedded: {
        'rh:result': [
          {
            meta: [{ count: 1 }],
            data: [
              {
                refNumber: 'REF310003C',
                name: 'Tech Lead - MASTRO',
                releasedDate: '2026-06-28T08:00:00.000Z',
                jobUrl: 'REF310003C-tech-lead-mastro',
                function: {
                  id: 'engineering',
                  label: 'Engineering',
                },
                location: {
                  workLocation: 'Bengaluru',
                  country: 'in',
                  hybrid: true,
                  city: 'Bengaluru',
                  remote: false,
                },
                legal_entity: {
                  valueId: 'Robert Bosch Engineering and Business Solutions Private Ltd.',
                  valueLabel: 'Bosch Global Software Technologies Private Limited',
                },
                type_of_contract: {
                  valueLabel: 'Unlimited',
                },
              },
            ],
          },
        ],
      },
    },
    detailPayloadByRef: {
      REF310003C: [
        {
          releasedDate: '2026-06-28T08:00:00.000Z',
          refNumber: 'REF310003C',
          name: 'Tech Lead - MASTRO',
          jobAd: {
            sections: {
              companyDescription: {
                text: '<p>Bosch Global Software Technologies builds software and engineering solutions.</p>',
              },
              jobDescription: {
                text: '<p>Lead cross-functional delivery for cloud-based industrial software.</p>',
              },
              qualifications: {
                text: '<p>Bachelor degree in Computer Science</p>',
              },
              additionalInformation: {
                text: '<p>8~12</p>',
              },
            },
          },
        },
      ],
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '8-12 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('run fetches Bosch Global Software Technologies listings and details through the public Bosch content API', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)

  const requestedUrls = []
  const scraper = bgst.createBoschGlobalSoftwareTechnologiesScraper()

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === bgst.buildSearchUrl({ page: 1, pageSize: 25 })) {
        return sampleListingPayload
      }

      const refNumber = Object.keys(sampleDetailPayloadByRef).find(
        (candidate) => url === bgst.buildDetailUrl(candidate),
      )

      if (refNumber) {
        return sampleDetailPayloadByRef[refNumber]
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      bgst.buildSearchUrl({ page: 1, pageSize: 25 }),
      bgst.buildDetailUrl('REF310001A'),
      bgst.buildDetailUrl('REF310002B'),
    ],
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'boschglobalsoftwaretechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(bgst.buildSearchUrl({ page: 1, pageSize: 25 }), /Robert%20Bosch%20Engineering/i)
  assert.equal(bgst.CAREER_PAGE_URL, 'https://jobs.bosch.com/en/?pages=1&country=in')
})

test('run bounds Bosch detail requests while preserving every listing identity', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)
  const listings = Array.from({ length: 17 }, (_, index) => ({
    ...sampleListingPayload._embedded['rh:result'][0].data[0],
    refNumber: 'REF' + String(index + 1).padStart(6, '0'),
    name: 'Engineer ' + (index + 1),
    jobUrl: 'REF' + String(index + 1).padStart(6, '0') + '-engineer',
  }))
  const listingPayload = {
    _embedded: { 'rh:result': [{ meta: [{ count: listings.length }], data: listings }] },
  }
  let active = 0
  let maxActive = 0
  const scraper = bgst.createBoschGlobalSoftwareTechnologiesScraper({ detailConcurrency: 6 })
  const jobs = await scraper.run({
    fetchJson: async (url) => {
      if (url === bgst.buildSearchUrl({ page: 1, pageSize: 25 })) return listingPayload
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return []
    },
  })
  assert.equal(maxActive, 6)
  assert.equal(jobs.length, listings.length)
  assert.deepEqual(jobs.map((job) => job.jobId), listings.map((listing) => listing.refNumber))
})

test('run propagates cancellation to active Bosch details and does not start queued requests', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)
  const listings = Array.from({ length: 18 }, (_, index) => ({
    ...sampleListingPayload._embedded['rh:result'][0].data[0],
    refNumber: 'CANCEL' + index,
    jobUrl: 'CANCEL' + index,
  }))
  const controller = new AbortController()
  const reason = new Error('Bosch source deadline')
  let detailRequests = 0
  const scraper = bgst.createBoschGlobalSoftwareTechnologiesScraper({ detailConcurrency: 6 })
  const runPromise = scraper.run({
    signal: controller.signal,
    fetchJson: async (url, { signal } = {}) => {
      assert.equal(signal, controller.signal)
      if (url === bgst.buildSearchUrl({ page: 1, pageSize: 25 })) {
        return { _embedded: { 'rh:result': [{ meta: [{ count: listings.length }], data: listings }] } }
      }
      detailRequests += 1
      if (detailRequests === 6) queueMicrotask(() => controller.abort(reason))
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    },
  })
  await assert.rejects(runPromise, (error) => error === reason)
  assert.equal(detailRequests, 6)
})

test('run stops Bosch workers from dequeuing after a detail failure and settles active requests', async () => {
  const bgst = await loadBgstModule()
  assert.ok(bgst)
  const listings = Array.from({ length: 12 }, (_, index) => ({
    ...sampleListingPayload._embedded['rh:result'][0].data[0],
    refNumber: 'FAIL' + index,
    jobUrl: 'FAIL' + index,
  }))
  const failure = new Error('Bosch detail failed')
  const releaseActive = []
  let detailRequests = 0
  let settled = false
  const scraper = bgst.createBoschGlobalSoftwareTechnologiesScraper({ detailConcurrency: 3 })
  const runPromise = scraper.run({
    fetchJson: async (url) => {
      if (url === bgst.buildSearchUrl({ page: 1, pageSize: 25 })) {
        return { _embedded: { 'rh:result': [{ meta: [{ count: listings.length }], data: listings }] } }
      }
      detailRequests += 1
      if (detailRequests === 1) {
        await Promise.resolve()
        throw failure
      }
      return new Promise((resolve) => releaseActive.push(() => resolve([])))
    },
  }).finally(() => {
    settled = true
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(detailRequests, 3)
  assert.equal(settled, false)
  releaseActive.forEach((release) => release())
  await assert.rejects(runPromise, (error) => error === failure)
  assert.equal(detailRequests, 3)
})
