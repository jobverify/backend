import { createJibeScraper } from '../../scraper-support/shared/jibe.js'

export const createZSAssociatesScraper = (options = {}) => createJibeScraper({
  source: 'zsassociates',
  companyName: 'ZS Associates',
  baseUrl: 'https://jobs.zs.com',
  query: {
    country: 'India',
    internal: 'false',
    separator: '|',
    facetField: 'country|tags4|tags',
  },
  ...options,
})

export const run = (options = {}) => createZSAssociatesScraper().run(options)

