import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const companyFixtures = [
  {
    exportName: 'GREYTRIX_CATALOG',
    moduleDir: 'greytrix',
    expected: {
      source: 'greytrix',
      companyName: 'Greytrix',
      officialBrandName: 'Greytrix',
      adapter: 'script',
      companyCareerPage: 'https://www.greytrix.com/careers/',
      companyDomain: 'greytrix.com',
      atsPlatform: 'official-careers-page-embedded-jobs-shell-sentinel',
      countryFilter: 'India',
      paginationStrategy: 'single-first-party-careers-page-embedded-shell-sentinel',
      extractionStrategy:
        'verified-first-party-careers-copy+embedded-jobs-shell-detection+no-public-job-cards+fail-closed-sentinel',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-07-18',
      verifiedSurfaceSummary:
        'Verified on Saturday, July 18, 2026 that https://www.greytrix.com/careers/ is Greytrix\'s live first-party careers page and that the public HTML currently exposes branded recruiting copy, a fake-offer warning, a job-openings iframe shell, and a contact form, but not a trustworthy first-party public job-card inventory or machine-readable openings feed. The local scraper therefore fails closed until Greytrix publishes a stable first-party jobs surface.',
    },
  },
  {
    exportName: 'EMTEC_CATALOG',
    moduleDir: 'emtec',
    expected: {
      source: 'emtec',
      companyName: 'Emtec',
      officialBrandName: 'Bridgenext',
      adapter: 'script',
      companyCareerPage: 'https://www.bridgenext.com/company/careers/',
      companyDomain: 'emtecinc.com',
      atsPlatform: 'parent-brand-careers-page-external-icims-handoff-sentinel',
      countryFilter: 'India',
      paginationStrategy: 'single-parent-careers-page-external-handoff-sentinel',
      extractionStrategy:
        'emtec-brand-unification-verification+bridgenext-careers-india-section+external-icims-handoff-detection+fail-closed-sentinel',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-07-18',
      verifiedSurfaceSummary:
        'Verified on Saturday, July 18, 2026 that Bridgenext is the unified public brand for Emtec, that https://www.bridgenext.com/company/careers/ is the live public careers page for the merged company, and that the page exposes an India Openings section but hands applicants off to careers-bridgenext.icims.com instead of publishing a trustworthy first-party jobs inventory on the company domain. The local scraper therefore fails closed until Emtec/Bridgenext exposes stable first-party company-attributable listings.',
    },
  },
  {
    exportName: 'CONTUS_CATALOG',
    moduleDir: 'contus',
    expected: {
      source: 'contus',
      companyName: 'Contus',
      officialBrandName: 'CONTUS TECH',
      adapter: 'script',
      companyCareerPage: 'https://www.contus.com/careers.php',
      companyDomain: 'contus.com',
      atsPlatform: 'first-party-careers-page',
      countryFilter: 'India',
      paginationStrategy: 'single-first-party-openings-list',
      extractionStrategy: 'first-party-current-openings-accordion+company-role-detail-link-extraction',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-08-01',
      verifiedSurfaceSummary:
        'Verified on Saturday, August 1, 2026 that https://www.contus.com/careers.php is CONTUS TECH\'s live first-party careers page and that the public HTML exposes a Current Openings accordion with active role titles, Chennai locations, and Apply Now links to company-hosted PHP role detail pages.',
    },
  },
  {
    exportName: 'SMART_IMS_CATALOG',
    moduleDir: 'smartims',
    expected: {
      source: 'smartims',
      companyName: 'Smart IMS',
      officialBrandName: 'Smart IMS',
      adapter: 'script',
      companyCareerPage: 'https://www.smartims.com/careers/',
      companyDomain: 'smartims.com',
      atsPlatform: 'first-party-careers-page-with-current-openings',
      countryFilter: 'India',
      paginationStrategy: 'single-first-party-current-openings-accordion',
      extractionStrategy:
        'first-party-accordion-openings+cloudflare-email-decode+structured-field-extraction',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-08-04',
      verifiedSurfaceSummary:
        'Verified on Tuesday, August 4, 2026 that https://www.smartims.com/careers/ is Smart IMS\'s live first-party careers page and that the public HTML exposes a Current Job Openings accordion with three Hyderabad listings and Cloudflare-protected apply-by-email links that decode to Indiacareers@SmartIMS.com, including Data Engineer II, Java Backend Software Development Engineer (SDE-2), and Front End Developer.',
    },
  },
  {
    exportName: 'DOODLEBLUE_INNOVATION_CATALOG',
    moduleDir: 'doodleblueinnovation',
    expected: {
      source: 'doodleblueinnovation',
      companyName: 'doodleblue innovation',
      officialBrandName: 'doodleblue Innovations Pvt. Ltd.',
      adapter: 'script',
      companyCareerPage: 'https://www.doodleblue.com/careers/openings/',
      companyDomain: 'doodleblue.com',
      atsPlatform: 'first-party-openings-page',
      countryFilter: 'India',
      paginationStrategy: 'single-first-party-openings-page',
      extractionStrategy:
        'first-party-role-rows-or-legacy-opening-cards+shared-meta-line+company-hosted-detail-route-or-shared-apply-route-extraction',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-08-02',
      verifiedSurfaceSummary:
        'Verified on Sunday, August 2, 2026 that https://www.doodleblue.com/careers/openings/ is doodleblue innovation\'s live first-party openings page and that the public HTML currently lists six role headings with shared Chennai, India / Full time / experienced metadata plus company-hosted detail routes under /careers/openings/view/, including Full stack Developer (Reactjs+Nodejs) 2+ years, React Native Developer 3+ years, and Project Managers 3+ years.',
    },
  },
]

const loadModule = async (relativePath) => {
  try {
    return await import(new URL(relativePath, import.meta.url).href)
  } catch {
    assert.fail(`Expected module at ${relativePath}`)
  }
}

for (const fixture of companyFixtures) {
  test(`${fixture.expected.companyName} local catalog matches the verified first-party contract`, async () => {
    const catalogModule = await loadModule(`../../scraper/${fixture.moduleDir}/catalog.js`)
    const scriptModule = await loadModule(`../../scraper/${fixture.moduleDir}/script.js`)
    const actualCatalog = catalogModule[fixture.exportName]

    assert.deepEqual(actualCatalog, {
      ...fixture.expected,
      modulePath: path.resolve(currentDir, '..', '..', 'scraper', fixture.moduleDir, 'script.js'),
    })
    assert.equal(catalogModule.default, actualCatalog)
    assert.equal(scriptModule.PROVIDER_METADATA.source, actualCatalog.source)
    assert.equal(scriptModule.PROVIDER_METADATA.companyName, actualCatalog.companyName)
  })
}
