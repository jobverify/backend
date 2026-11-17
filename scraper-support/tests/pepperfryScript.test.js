import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buy Furniture &amp; Home Decor Online – Up to 65% Off at Best Prices in India | Pepperfry</title>
  </head>
  <body>
    <h1>Buy Furniture &amp; Home Decor Online</h1>
    <div>Browse All Categories</div>
    <div>Partner With Us</div>
    <div>Check Out Bonhomie, Our Blog</div>
    <footer>
      <a href="https://www.pepperfry.com/pages/careers.html?type=footer">Careers</a>
    </footer>
  </body>
</html>
`

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Furniture &amp; Home Decor Online in India - Up to 70% Off | Pepperfry</title>
  </head>
  <body>
    <h1>Best Furniture &amp; Home Decor Online in India</h1>
    <div>Track Your Order</div>
    <div>Find a Store</div>
    <div>Pepperfry in the News</div>
    <div>Sell on pepperfry</div>
    <footer>
      <a href="https://www.pepperfry.com/pages/careers.html?type=footer">Careers</a>
    </footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Online Furniture Shopping Store: Shop Online in India for Furniture, Home Decor, Homeware Products @ Pepperfry</title>
  </head>
  <body>
    <section class="crpg-crnt-opening-container">
      <div class="crpg-opn-listitem">
        <span class="crpg-opn-listitem-ttl font-medium text-lg">(Assistant) Manager - Assisted Buying</span>
        <span class="crpg-opn-listitem-location text-sm"> Mumbai </span>
        <a target="_blank" rel="noopener" class="crpg-opn-view-desc-link text-sm" href="https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2">
          View Job Description
        </a>
      </div>
      <div class="crpg-opn-listitem">
        <span class="crpg-opn-listitem-ttl font-medium text-lg">Area Manager (Studios)</span>
        <span class="crpg-opn-listitem-location text-sm"> Hyderabad,Mumbai,New Delhi </span>
        <a target="_blank" rel="noopener" class="crpg-opn-view-desc-link text-sm" href="https://trendsys.darwinbox.in/ms/candidate/careers/a695b99381bd79">
          View Job Description
        </a>
      </div>
    </section>
  </body>
</html>
`



const loadModule = async () => {
  try {
    return await import('../../scraper/pepperfry/script.js')
  } catch {
    assert.fail('Expected Pepperfry scraper module at ../../scraper/pepperfry/script.js')
  }
}

test('Historical pepperfry parser fixtures remain pure helpers, separate from current acquisition', async () => {
  const pepperfry = await loadModule()

  assert.equal(pepperfry.COMPANY, 'Pepperfry')
  assert.equal(pepperfry.OFFICIAL_BRAND_NAME, 'Pepperfry')
  assert.equal(pepperfry.VERIFIED_ON, '2026-08-04')
  assert.equal(pepperfry.HOMEPAGE_URL, 'https://www.pepperfry.com/')
  assert.equal(
    pepperfry.CAREERS_PAGE_URL,
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )
  assert.equal(pepperfry.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(pepperfry.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
  assert.equal(
    pepperfry.extractVerifiedCareersPageUrl(HOMEPAGE_HTML),
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )
  assert.equal(
    pepperfry.extractVerifiedCareersPageUrl(CURRENT_HOMEPAGE_HTML),
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )

  const listings = pepperfry.extractCareerListings(CAREERS_HTML)
  assert.deepEqual(listings, [
    {
      title: '(Assistant) Manager - Assisted Buying',
      location: 'Mumbai',
      applyUrl: 'https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2',
    },
    {
      title: 'Area Manager (Studios)',
      location: 'Hyderabad, Mumbai, New Delhi',
      applyUrl: 'https://trendsys.darwinbox.in/ms/candidate/careers/a695b99381bd79',
    },
  ])
})
