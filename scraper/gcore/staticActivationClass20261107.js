import {createHash} from 'node:crypto'
import {parse} from 'acorn'

// Static issued-data class only. These complete programs instrument requests,
// cookies/storage and DOM/iframe state in a browser. This reader never executes
// them, computes their generated values, or forwards them to any request.
const sha=body=>createHash('sha256').update(body).digest('hex')
const frames={
 0:'fc4cbf6b00f98404545a9cacf9da5401e2613d6fe6865aca8f223049dbbaadd3',
 3:'797a183cf35aaf4b223c417d7c635035560425f28e1532f54131ff3408f16044',
 4:'ec78909af9b43665ff432a16dfb6912d2091ac47332fd09bc4877f9a16d014ff',
}
const carriers={
 'https://gcore.com/careers':'0f9612b50c51c18585a8bb2789343cf13dec4f280b5350eb0f85e2f41be72fe9',
 'https://gcore.com/open-positions':'2a70eddb0e6e5cc6be63e0ad90339c8214b05cf390f4e60dcde191bb3d308d55',
}
const paths={
 0:['body.0.expression.callee.body.body.0.consequent.body.1.declarations.1.init'],
 3:['body.2.body.body.0.argument.left.arguments.0','body.2.body.body.0.argument.right.arguments.0'],
 4:['body.4.declarations.0.init.body.body.9.expression.right.body.body.1.expression.right.right','body.4.declarations.0.init.body.body.10.expression.right.body.body.8.alternate.expression.arguments.0','body.6.body.body.0.block.body.3.consequent.body.0.expression.arguments.1.right.arguments.0','body.6.body.body.0.block.body.15.expression.right.left.right.right'],
}
const rawString=(value,raw,quote)=>typeof value==='string'&&raw===quote+value+quote&&!raw.includes('\\')
const hex32=(value,raw)=>rawString(value,raw,'"')&&/^[a-f0-9]{32}$/.test(value)
const charcode=(value,raw)=>Number.isSafeInteger(value)&&/^[1-9]\d{1,2}$/.test(raw)
 &&(value>=65&&value<=90||value>=97&&value<=122)
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const cookieSuffix=(value,raw)=>{
 if(!rawString(value,raw,"'")||value.length!==58)return false
 const expiry=/expires=([^;]*)/i.exec(value)
 if(!expiry||sha(value.replace(/(expires=)[^;]*/i,'$1<COOKIE-DATE>'))!=='f74e8e3932d68e4ded1eaa6bb84f9a4ba2026b22c132d9eec5541f547e6d0e49')return false
 // Exact observed cookie-date spelling, not vacancy publication chronology.
 const m=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(expiry[1])
 if(!m)return false
 const year=Number(m[4])+(Number(m[4])>=70?1900:2000),month=months.indexOf(m[3])
 const d=new Date(Date.UTC(year,month,Number(m[2]),Number(m[5]),Number(m[6]),Number(m[7])))
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month&&d.getUTCDate()===Number(m[2])
  &&d.getUTCHours()===Number(m[5])&&d.getUTCMinutes()===Number(m[6])&&d.getUTCSeconds()===Number(m[7])
  &&weekdays[d.getUTCDay()]===m[1]
}
const fallback=(value,raw)=>rawString(value,raw,'"')&&/^.{3}[a-f0-9]{35}$/.test(value)
 &&sha(value.slice(0,3)+'<LOWER-HEX35>')==='2ede8c2033bb9c218a9ab05b683d03e86522e585955242f668e7fdab3ff26e7c'
const timestamp=(value,raw)=>Number.isSafeInteger(value)&&/^[1-9]\d{9}$/.test(raw)
const formats={
 // Preserve the existing all-zero negative as an unsupported sentinel. This
 // is not a nonce entropy, authorization, or cryptographic validity claim.
 0:[(value,raw)=>hex32(value,raw)&&value!=='0'.repeat(32)],
 3:[charcode,charcode],
 4:[cookieSuffix,fallback,hex32,timestamp],
}
function sourceFrame(text,slot){
 if(typeof text!=='string')return null
 const ast=parse(text,{ecmaVersion:'latest',sourceType:'script'})
 const spans=paths[slot].map((path,index)=>{
  const node=path.split('.').reduce((n,key)=>n?.[key],ast)
  if(node?.type!=='Literal'||!Number.isInteger(node.start)||!Number.isInteger(node.end)
   ||node.start<0||node.end<=node.start||node.end>text.length
   ||!formats[slot][index](node.value,text.slice(node.start,node.end)))return null
  return{start:node.start,end:node.end,marker:'<PASSIVE-LITERAL-'+index+':'+typeof node.value+'>'}
 })
 if(spans.some(span=>span===null))return null
 spans.sort((a,b)=>b.start-a.start)
 for(let i=1;i<spans.length;i++)if(spans[i].end>spans[i-1].start)return null
 for(const span of spans)text=text.slice(0,span.start)+span.marker+text.slice(span.end)
 // Every other byte, including comments, whitespace, literal syntax outside
 // the seven sites and their full use contexts, remains exact.
 return sha(text)
}
export function matchesStaticActivationClass(url,activation,programs){
 try{
  if(!Object.hasOwn(carriers,url)||programs.length!==9||activation.scripts.length!==9)return false
  for(const slot of [0,3,4])if(sourceFrame(programs[slot],slot)!==frames[slot])return false
  const scripts=activation.scripts.map((script,slot)=>Object.hasOwn(frames,slot)
   ?{...script,bodySha256:'<SOURCE-FRAME:'+frames[slot]+'>'}:script)
  return sha(JSON.stringify({bases:activation.bases,scripts,carriers:activation.carriers}))===carriers[url]
 }catch{
  // Malformed programs/typed sites are unknown activation, never executable
  // fallbacks. The caller preserves its existing typed publisher error.
  return false
 }
}
