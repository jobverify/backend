import { createJibeScraper } from '../../scraper-support/shared/jibe.js'

export const createDocuSignScraper = (options = {}) => createJibeScraper({
  source: 'docusign',
  companyName: 'DocuSign',
  baseUrl: 'https://careers.docusign.com',
  query: { country: 'India' },
  ...options,
})

export const run = (options = {}) => createDocuSignScraper().run(options)

