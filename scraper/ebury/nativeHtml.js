import fs from 'node:fs'
import { activeScripts, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
const entities = JSON.parse(fs.readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
const numericEntities = html => String(html).replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (whole,name) =>
  Object.hasOwn(entities,name) ? [...entities[name]].map(c=>'&#'+c.codePointAt(0)+';').join('') : whole)
export const document = html => readNativeDocument(numericEntities(html))
export const visibleDocument = html => readVisibleNativeDocument(numericEntities(html))
export const text = html => { const d=document(html);return d.nodes(n=>n.tag==='root').map(d.text).join(' ').trim() }
export const remix = (html, route) => {
  const scripts=activeScripts(html).filter(s=>/^\s*window\.__remixContext\s*=/.test(s))
  if(scripts.length!==1)throw Error('Ebury native model missing or ambiguous')
  const match=scripts[0].match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/)
  if(!match)throw Error('Ebury native model malformed')
  const model=JSON.parse(match[1])
  if(model.state?.errors || !model.state?.loaderData?.[route])throw Error('Ebury native route/error state differs')
  return model.state.loaderData[route]
}
