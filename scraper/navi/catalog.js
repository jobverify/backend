import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://navi.com/careers still links to the public TurboHire board at https://navi.turbohire.co/dashboardv2?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6&type=0. The board shell now identifies NAVI TECHNOLOGIES LIMITED. Its no-auth token and filtered jobs API returned 35 India jobs.'

export const NAVI_CATALOG = {
  source: 'navi',
  companyName: 'Navi',
  officialBrandName: 'Navi Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'navi/jobs.json',
  homepageUrl: 'https://navi.com/',
  companyCareerPage: 'https://navi.com/careers',
  companyDomain: 'navi.com',
  handoffBoardUrl: 'https://navi.turbohire.co/dashboardv2?orgId=3e818601-0baa-429c-b6f8-4b21903ae0e6&type=0',
  turboHireOrgId: '3e818601-0baa-429c-b6f8-4b21903ae0e6',
  verifiedSampleJobUrl:
    'https://navi.turbohire.co/job/publicjobs/35YCNAG2eaMoNphqxvoqVsso2VVeb_4pXd1YYAnRyqkx_FjWUqeRn1k243NU%2FQrF',
  atsPlatform: 'turbohire',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-handoff-plus-public-turbohire-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-turbohire-board+noauth-token+filteredjobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NAVI_CATALOG
