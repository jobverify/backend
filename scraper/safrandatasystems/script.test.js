import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T12:00:00.000Z'

const SEARCH_PAGE_1_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Résultat de votre recherche (3 offres, page 1) / Mots clés : Safran Data Systems</title>
  </head>
  <body>
    <ul>
      <li class="ts-ol-criterias-list__item">Safran Data Systems</li>
    </ul>
    <a href="../handlers/offerRss.ashx?lcid=1036&amp;Keywords=Safran%20Data%20Systems">Flux RSS</a>
    <a href="liste-toutes-offres.aspx?Keywords=Safran%20Data%20Systems&amp;page=2">2</a>

    <li class="ts-offer-list-item offerlist-item " title="" onclick="location.href='/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx';">
      <h3 class="ts-offer-list-item__title styleh3">
        <a class="ts-offer-list-item__title-link " href="/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx" title="Bid Manager F/H (Réf. : 2026-185635) - Support contractuel">
          Bid Manager F/H
        </a>
      </h3>
      <ul class="ts-offer-list-item__description ">
        <li>Réf. : 2026-185635</li>
        <li>14/08/2026</li>
        <li>CDI</li>
        <li class="noBorder">AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH</li>
      </ul>
    </li>

    <li class="ts-offer-list-item offerlist-item " title="" onclick="location.href='/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx';">
      <h3 class="ts-offer-list-item__title styleh3">
        <a class="ts-offer-list-item__title-link " href="/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx" title="Export Control Manager F/H (Réf. : 2026-184115) - Contrôle des exportations">
          Export Control Manager F/H
        </a>
      </h3>
      <ul class="ts-offer-list-item__description ">
        <li>Réf. : 2026-184115</li>
        <li>13/08/2026</li>
        <li>CDD</li>
        <li class="noBorder">ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis</li>
      </ul>
    </li>
  </body>
</html>
`

const SEARCH_PAGE_2_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Résultat de votre recherche (3 offres, page 2) / Mots clés : Safran Data Systems</title>
  </head>
  <body>
    <ul>
      <li class="ts-ol-criterias-list__item">Safran Data Systems</li>
    </ul>
    <a href="../handlers/offerRss.ashx?lcid=1036&amp;Keywords=Safran%20Data%20Systems">Flux RSS</a>
    <a href="liste-toutes-offres.aspx?Keywords=Safran%20Data%20Systems&amp;page=2">2</a>

    <li class="ts-offer-list-item offerlist-item " title="" onclick="location.href='/offre-de-emploi/emploi-planificateur-trice-pdp-f-h_183901.aspx';">
      <h3 class="ts-offer-list-item__title styleh3">
        <a class="ts-offer-list-item__title-link " href="/offre-de-emploi/emploi-planificateur-trice-pdp-f-h_183901.aspx" title="Planificateur / trice PDP F/H (Réf. : 2026-183901) - Supply chain">
          Planificateur / trice PDP F/H
        </a>
      </h3>
      <ul class="ts-offer-list-item__description ">
        <li>Réf. : 2026-183901</li>
        <li>12/08/2026</li>
        <li>CDI</li>
        <li class="noBorder">Le Gerhoui 35510 Cesson-Sevigne</li>
      </ul>
    </li>
  </body>
</html>
`

const BID_MANAGER_URL =
  'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx'
const EXPORT_CONTROL_URL =
  'https://careers.safran-group.com/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx'
const PLANIFICATEUR_URL =
  'https://careers.safran-group.com/offre-de-emploi/emploi-planificateur-trice-pdp-f-h_183901.aspx'

const BID_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Bid Manager F/H</title>
    <meta name="Description" content="Offre d'emploi Safran Data Systems SAS - La Teste de 'Bid Manager F/H'. Lieu : AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH. Date : 14/08/2026. Ref : 2026-185635." />
  </head>
  <body>
    <input type="submit" value="Je postule à cette offre" />
    <h2>Description du poste</h2>
    <p id="fldjobdescription_jobtitle">Bid Manager F/H</p>
    <p id="fldjobdescription_contract">CDI</p>
    <p id="fldjobdescription_description1">Safran Data Systems recrute un-e Bid Manager pour rejoindre l'equipe commerciale des stations sols pour suivi des satellites.</p>
    <p id="fldjobdescription_longtext2">Vous repondez a des appels d'offres francais ou internationaux.</p>
    <p id="fldjobdescription_description2">Une experience solide dans la gestion de reponse aux appels d'offres complexes est requise.</p>
    <h2>Localisation du poste</h2>
    <p id="fldlocation_location_geographicalareacollection">Europe, France, Nouvelle Aquitaine, Gironde</p>
    <p id="fldlocation_joblocation"><div>AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH</div></p>
    <p id="fldapplicantcriteria_educationlevel">BAC+5</p>
    <p id="fldapplicantcriteria_experiencelevel">Superieure a 8 ans</p>
  </body>
</html>
`

const EXPORT_CONTROL_DETAIL_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Export Control Manager F/H</title>
    <meta name="Description" content="Offre d'emploi Safran Data Systems SAS - Les Ulis de 'Export Control Manager F/H'. Lieu : ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis. Date : 13/08/2026. Ref : 2026-184115." />
  </head>
  <body>
    <input type="submit" value="Je postule à cette offre" />
    <h2>Description du poste</h2>
    <p id="fldjobdescription_jobtitle">Export Control Manager F/H</p>
    <p id="fldjobdescription_contract">CDD</p>
    <p id="fldjobdescription_description1">Safran Data Systems gere les contraintes de controle des exportations pour ses activites spatiales critiques.</p>
    <p id="fldjobdescription_description2">Vous serez rattache au Responsable controle des exportations et douanes.</p>
    <h2>Localisation du poste</h2>
    <p id="fldlocation_location_geographicalareacollection">Europe, France, Ile de France, Essonne</p>
    <p id="fldlocation_joblocation"><div>ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis</div></p>
    <p id="fldapplicantcriteria_educationlevel">BAC+5</p>
    <p id="fldapplicantcriteria_experiencelevel">Superieure a 5 ans</p>
  </body>
</html>
`

const PLANIFICATEUR_DETAIL_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Planificateur / trice PDP F/H</title>
    <meta name="Description" content="Offre d'emploi Safran Data Systems SAS - Cesson-Sevigne de 'Planificateur / trice PDP F/H'. Lieu : Le Gerhoui 35510 Cesson-Sevigne. Date : 12/08/2026. Ref : 2026-183901." />
  </head>
  <body>
    <input type="submit" value="Je postule à cette offre" />
    <h2>Description du poste</h2>
    <p id="fldjobdescription_jobtitle">Planificateur / trice PDP F/H</p>
    <p id="fldjobdescription_contract">CDI</p>
    <p id="fldjobdescription_description1">Safran Data Systems renforce son pilotage industriel pour les communications spatiales.</p>
    <p id="fldjobdescription_description2">Vous orchestrez le plan directeur de production avec les equipes supply chain.</p>
    <h2>Localisation du poste</h2>
    <p id="fldlocation_location_geographicalareacollection">Europe, France, Bretagne, Ille-et-Vilaine</p>
    <p id="fldlocation_joblocation"><div>Le Gerhoui 35510 Cesson-Sevigne</div></p>
    <p id="fldapplicantcriteria_educationlevel">BAC+3</p>
    <p id="fldapplicantcriteria_experiencelevel">Entre 3 et 5 ans</p>
  </body>
</html>
`

const loadScriptModule = async () => import('./script.js')

test('Safran Data Systems retains the France keyword audit surface and native detail extraction contract', async () => {
  const safranDataSystems = await loadScriptModule()

  assert.equal(safranDataSystems.SOURCE, 'safrandatasystems')
  assert.equal(safranDataSystems.COMPANY, 'Safran Data Systems')
  assert.equal(safranDataSystems.OFFICIAL_BRAND_NAME, 'Safran Data Systems SAS')
  // This date labels the retained France audit, not the current India adapter.
  assert.match(safranDataSystems.VERIFIED_ON, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(Number.isFinite(Date.parse(safranDataSystems.VERIFIED_ON)))
  assert.equal(
    safranDataSystems.SEARCH_URL,
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Data%20Systems',
  )
  assert.equal(
    safranDataSystems.buildSearchUrl(),
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran+Data+Systems',
  )
  assert.equal(
    safranDataSystems.buildSearchUrl(2),
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran+Data+Systems&page=2',
  )
  assert.equal(safranDataSystems.hasVerifiedSearchPageSignal(SEARCH_PAGE_1_HTML), true)
  assert.equal(safranDataSystems.hasVerifiedDetailSignal(BID_MANAGER_DETAIL_HTML), true)
  assert.equal(safranDataSystems.extractTotalPages(SEARCH_PAGE_1_HTML), 2)

  const cards = safranDataSystems.extractJobCards(SEARCH_PAGE_1_HTML)
  assert.deepEqual(cards, [
    {
      title: 'Bid Manager F/H',
      company: 'Safran Data Systems',
      department: 'Support contractuel',
      location: "AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH",
      city: 'LA TESTE DE BUCH',
      state: null,
      country: 'France',
      jobId: '185635',
      requisitionId: '2026-185635',
      sourceUrl: BID_MANAGER_URL,
      applyUrl: BID_MANAGER_URL,
      employmentType: 'CDI',
      postingDate: '2026-08-14',
      jobDescription: null,
    },
    {
      title: 'Export Control Manager F/H',
      company: 'Safran Data Systems',
      department: 'Contrôle des exportations',
      location: "ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis",
      city: 'Les Ulis',
      state: null,
      country: 'France',
      jobId: '184115',
      requisitionId: '2026-184115',
      sourceUrl: EXPORT_CONTROL_URL,
      applyUrl: EXPORT_CONTROL_URL,
      employmentType: 'CDD',
      postingDate: '2026-08-13',
      jobDescription: null,
    },
  ])

  assert.deepEqual(safranDataSystems.extractJobDetail(BID_MANAGER_DETAIL_HTML, cards[0]), {
    title: 'Bid Manager F/H',
    company: 'Safran Data Systems',
    department: 'Support contractuel',
    location: "AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH, France",
    city: 'LA TESTE DE BUCH',
    state: 'Nouvelle Aquitaine',
    country: 'France',
    jobId: '185635',
    requisitionId: '2026-185635',
    sourceUrl: BID_MANAGER_URL,
    applyUrl: BID_MANAGER_URL,
    employmentType: 'CDI',
    experienceRequired: 'Superieure a 8 ans',
    minimumQualification: 'BAC+5',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-14',
    closingDate: null,
    jobDescription:
      "Safran Data Systems recrute un-e Bid Manager pour rejoindre l'equipe commerciale des stations sols pour suivi des satellites. Vous repondez a des appels d'offres francais ou internationaux. Une experience solide dans la gestion de reponse aux appels d'offres complexes est requise.",
  })
})

test('Safran Data Systems default fetch uses the accessible careers host response directly and throws on HTTP errors', async () => {
  const safranDataSystems = await loadScriptModule()
  const calls = []
  const fetchText = safranDataSystems.createDefaultFetchText({
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return {
        ok: true,
        text: async () => SEARCH_PAGE_1_HTML,
      }
    },
  })

  const html = await fetchText(safranDataSystems.SEARCH_URL)

  assert.equal(html, SEARCH_PAGE_1_HTML)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, safranDataSystems.SEARCH_URL)
  assert.equal(calls[0].options.redirect, 'follow')
  assert.equal(calls[0].options.headers['Accept-Language'], 'fr-FR,fr;q=0.9,en;q=0.8')

  await assert.rejects(
    safranDataSystems.createDefaultFetchText({
      fetchImpl: async () => ({
        ok: false,
        status: 403,
      }),
    })(safranDataSystems.SEARCH_URL),
    /HTTP 403/i,
  )
})

test('Safran Data Systems retained France factory follows keyword pagination and same-domain details', async () => {
  const safranDataSystems = await loadScriptModule()
  const requestedUrls = []

  const jobs = await safranDataSystems.createSafranDataSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === safranDataSystems.buildSearchUrl(1)) return SEARCH_PAGE_1_HTML
      if (url === safranDataSystems.buildSearchUrl(2)) return SEARCH_PAGE_2_HTML
      if (url === BID_MANAGER_URL) return BID_MANAGER_DETAIL_HTML
      if (url === EXPORT_CONTROL_URL) return EXPORT_CONTROL_DETAIL_HTML
      if (url === PLANIFICATEUR_URL) return PLANIFICATEUR_DETAIL_HTML

      throw new Error(`Unexpected Safran Data Systems URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    safranDataSystems.buildSearchUrl(1),
    BID_MANAGER_URL,
    EXPORT_CONTROL_URL,
    safranDataSystems.buildSearchUrl(2),
    PLANIFICATEUR_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      requisitionId: job.requisitionId,
      location: job.location,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Bid Manager F/H',
        requisitionId: '2026-185635',
        location: "AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH, France",
        source: 'safrandatasystems',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Export Control Manager F/H',
        requisitionId: '2026-184115',
        location: "ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis, France",
        source: 'safrandatasystems',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Planificateur / trice PDP F/H',
        requisitionId: '2026-183901',
        location: 'Le Gerhoui 35510 Cesson-Sevigne, France',
        source: 'safrandatasystems',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.equal(jobs[0].link, BID_MANAGER_URL)
  assert.equal(jobs[2].link, PLANIFICATEUR_URL)
})

test('Safran Data Systems retained France audit fails closed on keyword search or detail drift', async () => {
  const safranDataSystems = await loadScriptModule()

  await assert.rejects(
    safranDataSystems.createSafranDataSystemsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified keyword search page/i,
  )

  await assert.rejects(
    safranDataSystems.createSafranDataSystemsScraper().run({
      fetchText: async (url) => {
        if (url === safranDataSystems.buildSearchUrl(1)) return SEARCH_PAGE_1_HTML
        return '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'
      },
    }),
    /detail page no longer matches/i,
  )
})

test('Safran Data Systems accepts a Space & Communication detail only with matching SDS identity', async () => {
  const safranDataSystems = await loadScriptModule()
  const detail = BID_MANAGER_DETAIL_HTML
    .replace("Offre d'emploi Safran Data Systems SAS -", "Offre d'emploi Space &amp; Communication -")
    .replace('Ref : 2026-185635.', 'Ref : SDS/GS3/27-185635.')
  const card = { jobId: '185635' }

  assert.equal(safranDataSystems.hasVerifiedDetailSignal(detail, card), true)
  assert.equal(safranDataSystems.hasVerifiedDetailSignal(detail, { jobId: 'other' }), false)
  assert.equal(safranDataSystems.hasVerifiedDetailSignal(
    detail.replace('Safran Data Systems recrute', 'Another business recruits'),
    card,
  ), false)
})
