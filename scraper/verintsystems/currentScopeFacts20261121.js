import {all,props,authoredLines,semanticCriteria,need} from './currentFacts20261120.js'
import {constraints} from './currentDates20261121.js'

const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applications=/^(?:apply|application|jobapplication|job|detail)(?:url|uri|link)$/

// Authored facts inside the selected recruitment mount remain constraints even
// when their carrier is hidden. This view reads their facts, never visibility
// or renderer activation, and never expands into unrelated corporate prose.
export function qualifyCurrentProperties(properties,{at,urls,countryAlternatives=[]}){
 const normalized=properties.map(property=>key(property.key)==='worklocationcountry'?{...property,key:'workcountry'}:property)
 constraints(normalized,[],{employer:'Verint',observedAt:at,countryAlternatives})
 for(const property of properties)if(applications.test(key(property.key)))need(typeof property.value==='string'&&urls.includes(new URL(property.value,urls[0]).href),'Current recruitment application alias differs')
}
export function qualifyCurrentScope(root,config){
 const view=node=>({...node,inactive:false,inert:false,children:node.children.map(child=>typeof child==='string'?child:view(child))})
 const current=view(root),semantic=semanticCriteria(current),properties=[...props(all(current,()=>true)),...semantic.properties]
 qualifyCurrentProperties(properties,config)
 constraints([], [...authoredLines(current),...semantic.lines],{employer:'Verint',observedAt:config.at,countryAlternatives:config.countryAlternatives??[]})
}
