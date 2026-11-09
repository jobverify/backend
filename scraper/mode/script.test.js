import assert from 'node:assert/strict'
import test from 'node:test'

import { hasThoughtSpotCareersSurfaceSignal } from './script.js'

test('hasThoughtSpotCareersSurfaceSignal accepts the verified ThoughtSpot careers redirect target', () => {
  assert.equal(
    hasThoughtSpotCareersSurfaceSignal({
      finalUrl: 'https://www.thoughtspot.com/careers',
      html: `
        <html>
          <body>
            <a href="https://www.thoughtspot.com/careers">Careers</a>
            <p>ThoughtSpot</p>
            <p>©2026 ThoughtSpot Inc.</p>
          </body>
        </html>
      `,
    }),
    true,
  )
})
