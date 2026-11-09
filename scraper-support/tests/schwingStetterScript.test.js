import assert from 'node:assert/strict'
import test from 'node:test'

import { run, STETTER_BOARD_URL } from '../../scraper/schwingstetter/script.js'

const careers = '<html>Ausbildung & Karriere. Weltweit beschaeftigen wir mehr als 3.000 Mitarbeiter. Finden Sie Ihren Job auf unserer Stellenboerse. bewerbung@schwing.de Stetter Stellenboerse</html>'
const board = '<html>Stetter GmbH Dr.-Karl-Lenz-Strasse 70 87700 Memmingen / Germany info@stetter.de Copyright © 2024 Schwing GmbH / Stetter GmbH <table><tr><th>Datum</th><th>Stellenbezeichnung (m/w/d)</th></tr><tr><td>01.10.2026</td><td class="title"><a href="https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse/sicherheitsfachkraft-sifa-m/w/d.html">Sicherheitsfachkraft</a></td></tr></table></html>'
const detail = '<html><title>Sicherheitsfachkraft (SiFa) (m/w/d)</title><main>Erste Tätigkeitsstätte ist der Firmensitz der Stetter GmbH in Memmingen.</main></html>'

test('Schwing Stetter verifies listed Stetter jobs are in Germany before returning no India jobs', async () => {
  const requested = []
  const jobs = await run({
    fetchText: async (url) => {
      requested.push(url)
      if (url.endsWith('/ausbildung-karriere.html')) return careers
      if (url === STETTER_BOARD_URL) return board
      if (url.endsWith('/sicherheitsfachkraft-sifa-m/w/d.html')) return detail
      throw new Error('Unexpected URL: ' + url)
    },
  })
  assert.deepEqual(jobs, [])
  assert.equal(requested.length, 3)
})

test('Schwing Stetter fails closed if a public listing lacks the verified Germany location', async () => {
  await assert.rejects(run({
    fetchText: async (url) => {
      if (url.endsWith('/ausbildung-karriere.html')) return careers
      if (url === STETTER_BOARD_URL) return board
      return detail.replace('Memmingen', 'Chennai')
    },
  }), /Germany|Memmingen|location/i)
})
