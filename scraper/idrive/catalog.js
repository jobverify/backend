import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IDRIVE_CATALOG = {
  source: 'idrive',
  companyName: 'IDrive',
  officialBrandName: 'IDrive',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.idrive.com/jobs/',
  officialJobsWidgetUrl: 'https://widgets.sociablekit.com/indeed-jobs/iframe/25575419',
  jobsFeedUrl: 'https://data.accentapi.com/feed/25575419.json',
  widgetSettingsUrl: 'https://data.accentapi.com/settings/25575419/settings.json',
  widgetEmbedInfoUrl: 'https://api.sociablekit.com/api/user_embed/info/25575419',
  widgetEmbedId: '25575419',
  companyDomain: 'idrive.com',
  atsPlatform: 'indeed-via-sociablekit',
  countryFilter: 'India',
  paginationStrategy: 'official-widget-feed-single-request',
  extractionStrategy: 'official-careers-page+embedded-sociablekit-indeed-feed-json',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'idrive/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.idrive.com/jobs/ is the official IDrive careers page and that it embeds the public SociableKIT Indeed widget at https://widgets.sociablekit.com/indeed-jobs/iframe/25575419. The widget references the public feed https://data.accentapi.com/feed/25575419.json, which on July 16, 2026 identified IDrive and advertised "0 IDrive jobs" with no populated posts array. This remains a trustworthy official public jobs surface, so the scraper is implemented against the embedded feed and currently returns an empty list until the official widget publishes jobs.',
}

export default IDRIVE_CATALOG
