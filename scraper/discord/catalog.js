export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://discord.com/jobs redirects to the live first-party careers page at https://discord.com/careers, that the public first-party careers script at https://discord.com/webflow-scripts/careersNew2025.js currently aggregates the three public Greenhouse boards discord, discordinternational, and internationaleor, and that the corresponding APIs at https://api.greenhouse.io/v1/boards/discord/jobs?content=true, https://api.greenhouse.io/v1/boards/discordinternational/jobs?content=true, and https://api.greenhouse.io/v1/boards/internationaleor/jobs?content=true returned 54, 1, and 2 live roles respectively for 57 live roles overall. Verified sample postings included Account Executive - Tech on the main Discord board, Program Manager, Detection & Enforcement, Counter-Extremism on the international board, and Regulatory Counsel, APAC on the international EOR board, with first-party detail routing at https://discord.com/jobs/8433948002 and Greenhouse apply handoff through the verified board URLs.'

export const DISCORD_CATALOG = {
  source: 'discord',
  companyName: 'Discord',
  adapter: 'script',
  modulePath: '../../scraper/discord/script.js',
  companyCareerPage: 'https://discord.com/careers',
  officialJobsRedirectUrl: 'https://discord.com/jobs',
  firstPartyJobDetailsBaseUrl: 'https://discord.com/jobs/',
  careersScriptUrl: 'https://discord.com/webflow-scripts/careersNew2025.js',
  greenhouseBoardIds: [
    'discord',
    'discordinternational',
    'internationaleor',
  ],
  greenhouseJobsApiUrls: [
    'https://api.greenhouse.io/v1/boards/discord/jobs',
    'https://api.greenhouse.io/v1/boards/discordinternational/jobs',
    'https://api.greenhouse.io/v1/boards/internationaleor/jobs',
  ],
  atsPlatform: 'greenhouse',
  paginationStrategy: 'three-verified-greenhouse-jobs-api-content-pages-aggregated',
  extractionStrategy:
    'verified-first-party-careers-page+verified-careers-script+three-public-greenhouse-jobs-apis+first-party-job-route+greenhouse-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'discord.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DISCORD_CATALOG

