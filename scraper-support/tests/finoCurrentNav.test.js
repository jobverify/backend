import assert from 'node:assert/strict'
import test from 'node:test'

import { extractHomepageCareerUrl, hasOfficialHomepageSignal } from '../../scraper/finopaymentsbank/script.js'

const homepage = `<html><body><h1>Open your FinoPay Account now</h1><p>FinoPay Savings Account</p><button>Investor Relations</button><script>window.__DATA__ = '{\\"text\\":\\"About Us\\",\\"url\\":\\"https://www.fino.bank.in/company/about-us\\"},{\\"text\\":\\"Careers\\",\\"url\\":\\"https://www.fino.bank.in/company/careers\\"}'</script></body></html>`

test('Fino recognizes its current embedded Company navigation and verified careers link', () => {
  assert.equal(hasOfficialHomepageSignal(homepage), true)
  assert.equal(extractHomepageCareerUrl(homepage), 'https://www.fino.bank.in/company/careers')
  assert.equal(extractHomepageCareerUrl(homepage.replace('/company/careers', '/company/contact-us')), null)
})
