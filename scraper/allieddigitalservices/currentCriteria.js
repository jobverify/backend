// Current own-role WordPress SSR qualification, separate from historical payload readers.
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const declarations=style=>new Map(String(style??'').replace(/\/\*[\s\S]*?\*\//g,'').split(';').map(part=>{const at=part.indexOf(':');return at<0?null:[part.slice(0,at).trim().toLowerCase(),part.slice(at+1).replace(/\s*!important\s*$/i,'').trim().toLowerCase()]}).filter(Boolean))
const zero=value=>/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[a-z%]+)?$/.test(value??'')
const transparent=value=>value==='transparent'||/^#[\da-f]{3}0$|^#[\da-f]{6}00$/i.test(value??'')||/^(?:rgba|hsla)\([^)]*,\s*0(?:\.0*)?\s*\)$|^(?:rgb|hsl)a?\([^)]*\/\s*0(?:\.0*)?%?\s*\)$/i.test(value??'')
const hazardous=style=>{
 const d=declarations(style),overflow=[d.get('overflow'),d.get('overflow-y'),d.get('overflow-x')].some(v=>/^(?:hidden|clip)$/.test(v??''))
 return zero(d.get('opacity'))||zero(d.get('font-size'))||transparent(d.get('color'))||transparent(d.get('-webkit-text-fill-color'))
  ||['clip','clip-path','mask','mask-image','-webkit-mask-image'].some(key=>d.has(key)&&!['none','auto','initial','unset'].includes(d.get(key)))
  ||['line-clamp','-webkit-line-clamp'].some(key=>d.has(key)&&!['none','unset','initial'].includes(d.get(key)))
  ||overflow&&(['height','max-height','width','max-width'].some(key=>d.has(key)&&!['none','auto','initial','unset','inherit'].includes(d.get(key)))||d.get('text-overflow')==='ellipsis')
}
export function qualifyCurrentAlliedCriteria(html,detail){
 const reasons=[],descriptionText=detail.jobDescription,raw=detail.nativeRoleCriteriaHtml
 if(!detail.sourceDetailComplete||typeof raw!=='string'||!descriptionText)reasons.push('native-full-role-description-unavailable')
 const native=readNativeDocument(raw||''),nativeRoot=native.nodes(n=>n.tag==='root')[0],walk=(node,predicate)=>typeof node==='string'?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>walk(child,predicate))]
 if(walk(nativeRoot,n=>['img','svg','canvas','iframe','object','embed','audio','video'].includes(n.tag)).length)reasons.push('native-nontext-role-criteria-unqualified')
 const doc=readVisibleNativeDocument(html,{strict:true}),root=doc.nodes(n=>n.tag==='root')[0],parents=new WeakMap(),all=[]
 const index=(node,parent)=>{if(parent)parents.set(node,parent);all.push(node);for(const child of node.children.filter(n=>typeof n!=='string'))index(child,node)};index(root)
 const ownBodies=all.filter(n=>!n.inert&&(n.attrs.class||'').split(/\s+/).includes('awsm-job-entry-content'))
 if(ownBodies.length!==1||!descriptionText||!doc.text(ownBodies[0]).includes(descriptionText))reasons.push('complete-native-description-not-visible-in-own-public-role-SSR')
 const scopes=all.filter(n=>!n.inert&&['div','section','article'].includes(n.tag)&&descriptionText&&doc.text(n)===descriptionText),critical=new Set()
 if(!scopes.length)reasons.push('native-description-has-no-own-public-container')
 for(const scope of scopes){const visit=node=>{critical.add(node);for(const child of node.children.filter(n=>typeof n!=='string'))visit(child)};visit(scope);for(let n=scope;n;n=parents.get(n))critical.add(n)}
 if([...critical].some(node=>hazardous(node.attrs.style)))reasons.push('native-description-inline-clipping-or-invisible-text')
 const classes=new Set([...critical].flatMap(n=>(n.attrs.class??'').split(/\s+/).filter(Boolean))),ids=new Set([...critical].map(n=>n.attrs.id).filter(Boolean)),tags=new Set([...critical].map(n=>n.tag))
 const relevant=selector=>{if(/\\|:(?:not|is|where|has)\(/.test(selector))return true;const tokens=[...selector.matchAll(/([.#])([\w-]+)/g)];if(tokens.length)return tokens.every(([,kind,value])=>(kind==='.'?classes:ids).has(value));const types=selector.match(/(?:^|[\s>+~,])([a-z][\w-]*)/gi)?.map(v=>v.replace(/^[\s>+~,]+/,''))??[];return types.length?types.every(type=>tags.has(type.toLowerCase())):true}
 for(const style of all.filter(n=>n.tag==='style'))for(const match of (style.raw??'').replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g))if(hazardous(match[2])&&match[1].split(',').some(relevant))reasons.push('native-description-published-CSS-clipping-or-invisible-text')
 const qualified=reasons.length===0
 return{...detail,nativeRoleCriteriaText:descriptionText,nativeRoleCriteriaRendering:{qualified,reasons:[...new Set(reasons)]},jobDescription:qualified?raw:null,sourceDescription:qualified?raw:null,sourceDetailComplete:qualified,sourceDetailStatus:qualified?'complete':'native-public-criteria-unqualified'}
}
