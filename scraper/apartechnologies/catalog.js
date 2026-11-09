import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CURRENT_NATIVE_METADATA from '../../scraper-support/providers/providerExtensions/zzzz-apartechnologies-native-20261103.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APAR_TECHNOLOGIES_CATALOG = {
  ...CURRENT_NATIVE_METADATA,
  officialHomepageUrl: "https://www.apartechnologies.com/",
  usOpeningsPageUrl: "https://www.apartechnologies.com/job-posting/",
  apacOpeningsPageUrl: "https://www.apartechnologies.com/apac-2/",
  robotsTxtUrl: "https://www.apartechnologies.com/robots.txt",
  sitemapIndexUrl: "https://www.apartechnologies.com/wp-sitemap.xml",
  pageSitemapUrl: "https://www.apartechnologies.com/wp-sitemap-posts-page-1.xml",
  officialContactEmail: "sales.apartech@apar.com",
  modulePath: path.join(currentDir, 'script.js'),
}

export default APAR_TECHNOLOGIES_CATALOG
