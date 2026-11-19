import fs from 'node:fs'
import zlib from 'node:zlib'

export const fixture = (source, name) => zlib.gunzipSync(fs.readFileSync(new URL(
  `../../scraper/${source}/fixtures/current-20261118/${name}.body.gz`, import.meta.url))).toString()

export const transport = entries => async url => {
  const value = entries.get(String(url))
  if (value === undefined) throw Error('Unexpected public request: ' + url)
  const item = typeof value === 'string' ? { body: value } : value
  const response = new Response(item.body, { status: item.status || 200,
    headers: { 'content-type': item.json ? 'application/json' : 'text/html' } })
  return { status: response.status, ok: response.ok, url: item.url || String(url), headers: response.headers,
    body: response.body, text: () => response.text() }
}

export const greenhousePayload = (source, name, { india = false } = {}) => {
  const payload = JSON.parse(fixture(source, name))
  if (india && payload.jobs.length) {
    const first = payload.jobs[0]
    first.location = { ...first.location, name: 'Bengaluru, India' }
    first.offices = [{ id: 90001, name: 'Bengaluru, India', location: 'Bengaluru, Karnataka, India',
      child_ids: [], parent_id: null }]
  }
  return { body: JSON.stringify(payload), json: true }
}
