export const KREDITBEE_CATALOG = {
  source: 'kreditbee',
  companyName: 'KreditBee',
  officialBrandName: 'KreditBee',
  adapter: 'script',
  modulePath: '../../scraper/kreditbee/script.js',
  dryRunFile: 'kreditbee/jobs.json',
  homepageUrl: 'https://www.kreditbee.in/',
  companyCareerPage: 'https://www.kreditbee.in/careers',
  sitemapUrl: 'https://www.kreditbee.in/sitemap.xml',
  verifiedDetailProbeUrls: [
    'https://www.kreditbee.in/careers/data-engineer',
    'https://www.kreditbee.in/careers/Team-Lead',
  ],
  companyDomain: 'kreditbee.in',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'careers-shell-plus-sitemap-and-detail-route-verification',
  extractionStrategy:
    'verified-react-shell-careers-page+limited-sitemap-signal+non-verifiable-detail-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.kreditbee.in/careers was only a React shell, that direct probes of https://www.kreditbee.in/careers/data-engineer and https://www.kreditbee.in/careers/Team-Lead did not expose trustworthy server-rendered job content, and that https://www.kreditbee.in/sitemap.xml only exposed the top-level careers URL. This provider therefore fails closed and returns an empty array until a trustworthy first-party public jobs surface is verifiable.',
}

export default KREDITBEE_CATALOG

