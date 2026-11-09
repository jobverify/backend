import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
const clean=v=>String(v??'').replace(/\s+/g,' ').trim()
const comparable=v=>clean(v).toLowerCase()
// Only explicit, role-owned label statements are evidence. Country words in
// company background, travel or customer descriptions do not assign a worksite.
// Unmatched city spellings are preserved; no city aliases or country defaults.
export function inspectAssignedLocations(description,places){
 const doc=readNativeDocument(typeof description==='string'?description:''),parts=[]
 const blocks=new Set(['div','p','li','h1','h2','h3','h4','h5','h6'])
 function walk(node){
  if(typeof node==='string'){parts.push(decodeNativeEntities(node));return}
  if(['script','style','template'].includes(node.tag))return
  if(blocks.has(node.tag)||node.tag==='br')parts.push('\n')
  node.children.forEach(walk)
  if(blocks.has(node.tag))parts.push('\n')
 }
 doc.nodes(n=>n.tag==='root').forEach(walk)
 const labels=new Set()
 for(const place of places){
  for(const name of [place.name,place.city])if(name){labels.add(comparable(name));labels.add(comparable([name,place.countryName].filter(Boolean).join(', ')));labels.add(comparable([name,place.state,place.countryName].filter(Boolean).join(', ')))}
  if(place.countryName)labels.add(comparable(place.countryName))
 }
 const seen=new Set(),statements=[]
 for(const raw of parts.join('').split(/\r?\n/)){
  const line=clean(raw),match=line.match(/^((?:(?:additional|primary|secondary|preferred|job|work|office|hiring|base)\s+)*(?:locations?|worksites?|cit(?:y|ies)|countr(?:y|ies)|regions?))\s*[:\-–]\s*(.+)$/i)
  if(!match||seen.has(line))continue;seen.add(line)
  const value=clean(match[2]);statements.push({line,label:match[1],value,unresolved:!labels.has(comparable(value))})
 }
 return {statements,unresolved:statements.some(row=>row.unresolved)}
}
