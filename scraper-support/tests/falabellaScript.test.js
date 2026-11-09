import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'
const PUBLIC_TOKEN = '329E7hbFSYyGUJrFlk2DqmW6sirxjvt4T2Sh0jWReX8'

const entryPage = {
  status: 200,
  url: 'https://muevete.falabella.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          content="Vive el Desafío Falabella, conoce las oportunidades laborales en nuestros negocios en Muévete, el portal de empleos de Grupo Falabella. ¡Haz click aquí!"
          name="description"
        />
        <title>Trabaja en Falabella – Empleos en el Grupo Falabella – Muévete</title>
        <script type="module" crossorigin src="/assets/index-BEcRIvKY.js"></script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `,
}

const homePage = {
  status: 200,
  url: 'https://muevete.falabella.com/',
  html: entryPage.html,
}

const bundleJs = `
  class Io {
    constructor(t) {
      this.url = "undefinedofertalaboral";
      this.type = t;
      this.token = "${PUBLIC_TOKEN}";
      this.url_bff = "https://ftc-hr-tama-atrc.falabella.tech";
    }
    getOfertasLaborales(t) {
      return this.requestWithRetry(\`\${this.url_bff}/bff-sgdt-job-offer/api/ofertalaboral/\${this.type}/\${t}\`, "GET", null, this.buildAuthConfig());
    }
    getAllOfertasLaborales() {
      return this.requestWithRetry(\`\${this.url_bff}/bff-sgdt-job-offer/api/ofertalaboral/type/\${this.type}\`, "GET", null, this.buildAuthConfig());
    }
    getOfertasLaboralesByFilter(t) {
      return this.requestWithRetry(\`\${this.url_bff}/bff-sgdt-job-offer/api/ofertalaboral/filter\`, "POST", t, this.buildAuthConfig());
    }
  }
  const publicClient = new Io("external");
  const internalClient = new Io("internal");
  const campaign = {
    url: "https://falabella.airavirtual.com/offer_info/B673kVNCinevRIVb5luq?fbrefresh=STPm1B6TRvQvIzI8&id=1678396020"
  };
`

const offersPayload = [
  {
    offer_id: '611174',
    title: 'CAJERO',
    description:
      '¡ÚNETE A NUESTRO EQUIPO! En Sodimac ARBOLEDAS estamos buscando personas comprometidas y con actitud de servicio para integrarse como Cajero(a).',
    referencenumber: '4453203',
    url: 'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
    date: '2026-07-15T00:01:26.000Z',
    company_code: 'sodimac_mexico',
    company: 'Sodimac',
    city: 'Tlalnepantla de Baz',
    state: 'Estado de México',
    country: 'México',
    jobtype: 'Full Time',
    contracttype: 'Permanente (Indefinido)',
    offertype: 'external',
    area: 'Venta y Post Venta - Personas (B2C)',
    requisition_company: 'Sodimac México',
    education: null,
    requirements: '-Disponibilidad de horario<br/>-Manejo de efectivo y caja registradora<br/>-Habilidad de servicio',
    process: 'Súmate a nuestro equipo y se parte de la transformación de Falabella.',
    type: 'falabella_jobs',
  },
  {
    offer_id: '609677',
    title: 'Analista Senior de Planificación y Análisis Financiero',
    description:
      '¡En Falabella Corporativo nos encontramos en búsqueda de un/a Analista Senior de Planificación y Análisis Financiero (FP&A)!',
    referencenumber: '4446254',
    url: 'https://falabella.airavirtual.com/postula/Z72tjqQjy0iMbitE9Mue?logged_action=apply&register=true',
    date: '2026-07-07T16:55:45.000Z',
    company_code: 'falabella_equipo_corporativo',
    company: 'Falabella Corporativo',
    city: 'Las Condes',
    state: 'Metropolitana',
    country: 'Chile',
    jobtype: 'Full Time',
    contracttype: 'Permanente (Indefinido)',
    offertype: 'external',
    area: 'Finanzas, Control de Gestión y Contabilidad',
    requisition_company: 'Falabella SA Chile',
    education:
      'Ingeniería Comercial<br/>Ingeniería Civil Industrial<br/>Carrera afín',
    requirements:
      '-2 a 5 años de experiencia en Planificación Financiera<br/>-Manejo avanzado de Excel y PowerPoint<br/>-Deseable manejo de Power BI, SQL o Python',
    process:
      'El proceso de selección se realiza a través de Aira - plataforma de reclutamiento diseñado para mejorar tu experiencia de postulación.',
    type: 'falabella_jobs',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/falabella/script.js')
  } catch {
    assert.fail('Expected Falabella scraper module at ../../scraper/falabella/script.js')
  }
}

test('Falabella helpers stay pinned to the verified careers shell, bundle-derived public API config, and public apply URLs', async () => {
  const falabella = await loadModule()

  assert.equal(falabella.SOURCE, 'falabella')
  assert.equal(falabella.COMPANY_NAME, 'Falabella')
  assert.equal(falabella.OFFICIAL_BRAND_NAME, 'Grupo Falabella')
  assert.equal(falabella.CAREERS_ENTRY_URL, 'https://jobs.falabella.com/')
  assert.equal(falabella.CAREERS_HOME_URL, 'https://muevete.falabella.com/')
  assert.equal(
    falabella.PUBLIC_JOBS_API_URL,
    'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external',
  )
  assert.equal(falabella.hasVerifiedCareersEntrySignal(entryPage), true)
  assert.equal(falabella.hasVerifiedCareersShellSignal(homePage), true)
  assert.equal(
    falabella.extractBundleUrl(homePage.html),
    'https://muevete.falabella.com/assets/index-BEcRIvKY.js',
  )
  assert.deepEqual(falabella.extractPublicApiConfig(bundleJs), {
    token: PUBLIC_TOKEN,
    urlBff: 'https://ftc-hr-tama-atrc.falabella.tech',
    publicType: 'external',
    publicJobsApiUrl:
      'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external',
    sampleOfferInfoUrl:
      'https://falabella.airavirtual.com/offer_info/B673kVNCinevRIVb5luq?fbrefresh=STPm1B6TRvQvIzI8&id=1678396020',
  })
  assert.equal(falabella.hasOfferRecordsShape(offersPayload), true)

  const mapped = falabella.mapOffer(offersPayload[0])
  assert.deepEqual(
    {
      title: mapped.title,
      company: mapped.company,
      department: mapped.department,
      location: mapped.location,
      city: mapped.city,
      state: mapped.state,
      country: mapped.country,
      jobId: mapped.jobId,
      requisitionId: mapped.requisitionId,
      sourceUrl: mapped.sourceUrl,
      applyUrl: mapped.applyUrl,
      employmentType: mapped.employmentType,
      minimumQualification: mapped.minimumQualification,
      requiredSkills: mapped.requiredSkills,
      postingDate: mapped.postingDate,
    },
    {
      title: 'CAJERO',
      company: 'Sodimac México',
      department: 'Venta y Post Venta - Personas (B2C)',
      location: 'Tlalnepantla de Baz, Estado de México, México',
      city: 'Tlalnepantla de Baz',
      state: 'Estado de México',
      country: 'México',
      jobId: '611174',
      requisitionId: '4453203',
      sourceUrl:
        'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
      applyUrl:
        'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
      employmentType: 'Full Time | Permanente (Indefinido)',
      minimumQualification: null,
      requiredSkills: [
        'Disponibilidad de horario',
        'Manejo de efectivo y caja registradora',
        'Habilidad de servicio',
      ],
      postingDate: '2026-07-15T00:01:26.000Z',
    },
  )
  assert.match(mapped.jobDescription, /Sodimac ARBOLEDAS/i)
})

test('Falabella run validates the verified public redirect, shell, bundle contract, and jobs API before returning jobs', async () => {
  const falabella = await loadModule()
  const requests = []

  const jobs = await falabella.createFalabellaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requests.push(['page', url])

      if (url === falabella.CAREERS_ENTRY_URL) return entryPage
      if (url === falabella.CAREERS_HOME_URL) return homePage

      throw new Error(`Unexpected Falabella page URL: ${url}`)
    },
    fetchText: async (url) => {
      requests.push(['text', url])

      if (url === falabella.extractBundleUrl(homePage.html)) return bundleJs

      throw new Error(`Unexpected Falabella text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push(['json', url, options.headers?.authorization ?? null])

      if (url === falabella.PUBLIC_JOBS_API_URL) {
        return offersPayload
      }

      throw new Error(`Unexpected Falabella JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    ['page', falabella.CAREERS_ENTRY_URL],
    ['page', falabella.CAREERS_HOME_URL],
    ['text', 'https://muevete.falabella.com/assets/index-BEcRIvKY.js'],
    ['json', falabella.PUBLIC_JOBS_API_URL, PUBLIC_TOKEN],
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      location: job.location,
      employmentType: job.employmentType,
      department: job.department,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'CAJERO',
        company: 'Sodimac México',
        jobId: '611174',
        requisitionId: '4453203',
        location: 'Tlalnepantla de Baz, Estado de México, México',
        employmentType: 'Full Time | Permanente (Indefinido)',
        department: 'Venta y Post Venta - Personas (B2C)',
        source: 'falabella',
        link:
          'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Analista Senior de Planificación y Análisis Financiero',
        company: 'Falabella SA Chile',
        jobId: '609677',
        requisitionId: '4446254',
        location: 'Las Condes, Metropolitana, Chile',
        employmentType: 'Full Time | Permanente (Indefinido)',
        department: 'Finanzas, Control de Gestión y Contabilidad',
        source: 'falabella',
        link:
          'https://falabella.airavirtual.com/postula/Z72tjqQjy0iMbitE9Mue?logged_action=apply&register=true',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.match(jobs[1].jobDescription, /Analista Senior de Planificación/i)
  assert.deepEqual(jobs[1].requiredSkills, [
    '2 a 5 años de experiencia en Planificación Financiera',
    'Manejo avanzado de Excel y PowerPoint',
    'Deseable manejo de Power BI, SQL o Python',
  ])
})

test('Falabella fails closed when the redirect, shell, bundle contract, or jobs payload drifts', async () => {
  const falabella = await loadModule()

  await assert.rejects(
    falabella.createFalabellaScraper().run({
      fetchPage: async (url) => {
        if (url === falabella.CAREERS_ENTRY_URL) {
          return {
            ...entryPage,
            url: falabella.CAREERS_ENTRY_URL,
          }
        }

        throw new Error(`Unexpected Falabella page URL: ${url}`)
      },
      fetchText: async () => bundleJs,
      fetchJson: async () => offersPayload,
    }),
    /careers entry/i,
  )

  await assert.rejects(
    falabella.createFalabellaScraper().run({
      fetchPage: async (url) => {
        if (url === falabella.CAREERS_ENTRY_URL) return entryPage
        if (url === falabella.CAREERS_HOME_URL) {
          return {
            ...homePage,
            html: homePage.html.replace(
              'Trabaja en Falabella – Empleos en el Grupo Falabella – Muévete',
              'Trabaja en Falabella – Empleos en el Grupo Falabella – Carreras',
            ),
          }
        }

        throw new Error(`Unexpected Falabella page URL: ${url}`)
      },
      fetchText: async () => bundleJs,
      fetchJson: async () => offersPayload,
    }),
    /careers shell/i,
  )

  await assert.rejects(
    falabella.createFalabellaScraper().run({
      fetchPage: async (url) => {
        if (url === falabella.CAREERS_ENTRY_URL) return entryPage
        if (url === falabella.CAREERS_HOME_URL) return homePage

        throw new Error(`Unexpected Falabella page URL: ${url}`)
      },
      fetchText: async () => bundleJs.replace('new Io("external")', 'new Io("public")'),
      fetchJson: async () => offersPayload,
    }),
    /bundle contract/i,
  )

  await assert.rejects(
    falabella.createFalabellaScraper().run({
      fetchPage: async (url) => {
        if (url === falabella.CAREERS_ENTRY_URL) return entryPage
        if (url === falabella.CAREERS_HOME_URL) return homePage

        throw new Error(`Unexpected Falabella page URL: ${url}`)
      },
      fetchText: async () => bundleJs,
      fetchJson: async () => [{ offer_id: null }],
    }),
    /jobs api/i,
  )
})
