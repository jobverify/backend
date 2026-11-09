import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T12:00:00.000Z'

const searchHtml = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Résultat de votre recherche (2 offres, page 1) / Mots clés : Safran Data Systems</title>
  </head>
  <body>
    <ul>
      <li class="ts-ol-criterias-list__item">Safran Data Systems</li>
    </ul>
    <a href="../handlers/offerRss.ashx?lcid=1036&amp;Keywords=Safran%20Data%20Systems">Flux RSS</a>

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

const bidManagerDetailHtml = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Bid Manager F/H</title>
    <meta name="Description" content="Offre d'emploi Safran Data Systems SAS - La Teste de 'Bid Manager F/H'. Lieu : AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH. Date : 14/08/2026. Ref : 2026-185635." />
  </head>
  <body>
    <input type="submit" value="Je postule à cette offre" />
    <h2 class="JobDescription">Description du poste</h2>
    <p id="fldjobdescription_jobtitle">Bid Manager F/H</p>
    <p id="fldjobdescription_contract">CDI</p>
    <p id="fldjobdescription_description1">Safran Data Systems recrute un-e Bid Manager pour rejoindre l'équipe commerciale des stations sols pour suivi des satellites.</p>
    <p id="fldjobdescription_longtext2">Vous répondez à des appels d'offres Français ou Internationaux.</p>
    <p id="fldjobdescription_description2">Une expérience solide dans la gestion de réponse aux appels d'offres complexes est requise.</p>
    <h2 class="Location">Localisation du poste</h2>
    <p id="fldlocation_location_geographicalareacollection">Europe, France, Nouvelle Aquitaine, Gironde</p>
    <p id="fldlocation_joblocation"><div>AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH</div></p>
    <p id="fldapplicantcriteria_educationlevel">BAC+5</p>
    <p id="fldapplicantcriteria_experiencelevel">Supérieure à 8 ans</p>
  </body>
</html>
`

const exportControlDetailHtml = `
<!doctype html>
<html lang="fr">
  <head>
    <title>Safran - Export Control Manager F/H</title>
    <meta name="Description" content="Offre d'emploi Safran Data Systems SAS - Les Ulis de 'Export Control Manager F/H'. Lieu : ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis. Date : 13/08/2026. Ref : 2026-184115." />
  </head>
  <body>
    <input type="submit" value="Je postule à cette offre" />
    <h2 class="JobDescription">Description du poste</h2>
    <p id="fldjobdescription_jobtitle">Export Control Manager F/H</p>
    <p id="fldjobdescription_contract">CDD</p>
    <p id="fldjobdescription_description1">Safran Data Systems est une filiale de Safran Electronics &amp; Defense spécialisée dans l'instrumentation d'essais, la télémesure et les communications pour l'espace.</p>
    <p id="fldjobdescription_description2">Vous serez rattaché.e au Responsable contrôle des exportations &amp; douanes.</p>
    <h2 class="Location">Localisation du poste</h2>
    <p id="fldlocation_location_geographicalareacollection">Europe, France, Ile de France, Essonne</p>
    <p id="fldlocation_joblocation"><div>ZONE D'ACTIVITE COURTABOEUF - 5 Avenue des Andes 91940 Les Ulis</div></p>
    <p id="fldapplicantcriteria_educationlevel">BAC+5</p>
    <p id="fldapplicantcriteria_experiencelevel">Supérieure à 5 ans</p>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/safrandatasystems/script.js')
  } catch {
    assert.fail('Expected Safran Data Systems scraper module at ../../scraper/safrandatasystems/script.js')
  }
}

test('Safran Data Systems pins the accessible keyword search page and exact-company detail contract', async () => {
  const safranDataSystems = await loadScriptModule()

  assert.equal(safranDataSystems.SOURCE, 'safrandatasystems')
  assert.equal(safranDataSystems.COMPANY, 'Safran Data Systems')
  assert.equal(safranDataSystems.OFFICIAL_BRAND_NAME, 'Safran Data Systems SAS')
  assert.equal(safranDataSystems.VERIFIED_ON, '2026-10-08')
  assert.equal(
    safranDataSystems.buildSearchUrl(2),
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran+Data+Systems&page=2',
  )
  assert.equal(safranDataSystems.hasVerifiedSearchPageSignal(searchHtml), true)
  assert.equal(safranDataSystems.hasVerifiedDetailSignal(bidManagerDetailHtml), true)

  assert.deepEqual(safranDataSystems.extractJobCards(searchHtml), [
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
      sourceUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx',
      applyUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx',
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
      sourceUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx',
      applyUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx',
      employmentType: 'CDD',
      postingDate: '2026-08-13',
      jobDescription: null,
    },
  ])

  assert.deepEqual(
    safranDataSystems.extractJobDetail(bidManagerDetailHtml, safranDataSystems.extractJobCards(searchHtml)[0]),
    {
      title: 'Bid Manager F/H',
      company: 'Safran Data Systems',
      department: 'Support contractuel',
      location: "AERODROME D'ARCACHON VILLEMARIE 33260 LA TESTE DE BUCH, France",
      city: 'LA TESTE DE BUCH',
      state: 'Nouvelle Aquitaine',
      country: 'France',
      jobId: '185635',
      requisitionId: '2026-185635',
      sourceUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx',
      applyUrl: 'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx',
      employmentType: 'CDI',
      experienceRequired: 'Supérieure à 8 ans',
      minimumQualification: 'BAC+5',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-14',
      closingDate: null,
      jobDescription: "Safran Data Systems recrute un-e Bid Manager pour rejoindre l'équipe commerciale des stations sols pour suivi des satellites. Vous répondez à des appels d'offres Français ou Internationaux. Une expérience solide dans la gestion de réponse aux appels d'offres complexes est requise.",
    },
  )
})

test('Safran Data Systems run validates the accessible keyword search and exact-company detail pages', async () => {
  const safranDataSystems = await loadScriptModule()
  const requestedUrls = []

  const jobs = await safranDataSystems.createSafranDataSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === safranDataSystems.buildSearchUrl(1)) return searchHtml
      if (url.endsWith('emploi-bid-manager-f-h_185635.aspx')) return bidManagerDetailHtml
      if (url.endsWith('emploi-export-control-manager-f-h_184115.aspx')) return exportControlDetailHtml
      throw new Error(`Unexpected Safran Data Systems URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    safranDataSystems.buildSearchUrl(1),
    'https://careers.safran-group.com/offre-de-emploi/emploi-bid-manager-f-h_185635.aspx',
    'https://careers.safran-group.com/offre-de-emploi/emploi-export-control-manager-f-h_184115.aspx',
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
    ],
  )
})

test('Safran Data Systems fails closed when the accessible search page or exact-company detail page drifts', async () => {
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
        if (url === safranDataSystems.buildSearchUrl(1)) return searchHtml
        return '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>'
      },
    }),
    /detail page no longer matches/i,
  )
})
