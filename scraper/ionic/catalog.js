import {publicLeverMetadata, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
const IONIC_CATALOG_HISTORICAL = {
  source: 'ionic',
  companyName: 'Ionic',
  officialBrandName: 'Ionic',
  adapter: 'script',
  modulePath: '../../scraper/ionic/script.js',
  dryRunFile: 'ionic/jobs.json',
  homepageUrl: 'https://ionic.io/',
  companyCareerPage: 'https://ionic.io/about/jobs',
  companyDomain: 'ionic.io',
  leverProxyUrl: 'https://ionic.io/api/lever',
  leverBoardUrl: 'https://jobs.lever.co/Ionic',
  atsPlatform: 'official-company-site-broken-lever-surface',
  countryFilter: 'Global',
  paginationStrategy: 'verified-careers-page-plus-broken-first-party-lever-proxy-validation',
  extractionStrategy:
    'verified-first-party-careers-page+broken-first-party-lever-proxy+404-lever-board-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://ionic.io/about/jobs is the live first-party Ionic careers page, that its runtime jobs contract points to the first-party proxy https://ionic.io/api/lever, and that this proxy currently returns {"ok":true,"data":{"ok":false,"error":"Document not found"}} instead of a live openings array. Verified that the public Lever root https://jobs.lever.co/Ionic and sample job detail URLs embedded in the current jobs-page bundle return 404, so the page exposes no trustworthy public jobs surface and this provider fails closed with an empty array.',
}

export const IONIC_CATALOG = publicLeverMetadata(PUBLIC_LEVER_PROFILES.ionic, IONIC_CATALOG_HISTORICAL)

export default IONIC_CATALOG

