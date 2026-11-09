import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKASA_AIR_CATALOG = {
  source: 'akasaair',
  companyName: 'Akasa Air',
  officialBrandName: 'Akasa Air',
  adapter: 'script',
  careersRedirectUrl: 'https://www.akasaair.com/careers',
  companyCareerPage: 'https://www.akasaair.com/careers-at-akasa-air/now-hiring',
  companyDomain: 'akasaair.com',
  sitemapUrl: 'https://www.akasaair.com/sitemap.xml',
  rolePageUrls: [
    'https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air',
  ],
  brokenPeopleStrongJoblistUrl: 'https://careers-akasa.peoplestrong.com/job/joblist',
  pilotApplyUrl:
    'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-landing-page-plus-sitemap-role-page-discovery',
  extractionStrategy:
    'verified-first-party-role-pages+jobposting-schema+working-office-form-handoff+broken-peoplestrong-handoffs-filtered',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.akasaair.com/careers redirects to the live first-party careers landing page at https://www.akasaair.com/careers-at-akasa-air/now-hiring, that https://www.akasaair.com/sitemap.xml publishes the first-party role pages https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air, https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air, and https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air, that the pilot page currently hands applicants to the public Microsoft Forms URL https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl, and that the crew and corporate Apply buttons still point to https://careers-akasa.peoplestrong.com/job/joblist which returned 404 during live checks.',
  dryRunFile: 'akasaair/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AKASA_AIR_CATALOG
