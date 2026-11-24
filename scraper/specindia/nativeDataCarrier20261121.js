import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {sha,need} from './nativeModels.js'

const bootstrap='<script>(self.__next_f=self.__next_f||[]).push([0])</script>'
const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)
const space=char=>char!==undefined&&/[\t\n\f\r ]/.test(char)

// Attribute value offsets come from the actual parsed tag, never from text or
// JavaScript that happens to contain an email-looking attribute spelling.
function attributes(html,node){
 const end=node.sourceOpenEnd,result=[];let at=node.sourceStart+1
 while(at<end&&!space(html[at])&&!['/','>'].includes(html[at]))at++
 while(at<end){
  if(space(html[at])||html[at]==='/'){at++;continue}
  if(html[at]==='>')break
  const start=at;if(html[at]==='=')at++
  while(at<end&&!space(html[at])&&!['/','=','>'].includes(html[at]))at++
  need(at>start,'unsupported native email attribute token')
  const name=html.slice(start,at).toLowerCase()
  while(space(html[at]))at++
  if(html[at]!=='='){result.push({name,start:at,end:at,value:''});continue}
  at++;while(space(html[at]))at++
  let first,last
  if(html[at]==='"'||html[at]==="'"){
   const quote=html[at++];first=at;last=html.indexOf(quote,at)
   need(last>=first&&last<end,'unterminated native email attribute');at=last+1
  }else{first=at;while(at<end&&!space(html[at])&&html[at]!=='>')at++;last=at}
  result.push({name,start:first,end:last,value:html.slice(first,last)})
 }
 return result
}

function emailDigest(hex){
 need(/^(?:[0-9a-f]{2}){3,321}$/i.test(hex),'unreviewed native contact cipher')
 const encoded=Buffer.from(hex,'hex'),plain=Buffer.from(encoded.subarray(1).map(byte=>byte^encoded[0]))
 need(/^[^\s@]+@[a-z0-9.-]+$/i.test(decode(plain)),'invalid decoded native contact')
 return{decodedSHA256:sha(plain),decodedBytes:plain.length}
}

function recordsOf(frames){
 const bytes=Buffer.from(frames.join('')),records=new Map();let at=0,count=0
 while(at<bytes.length){
  const start=at,colon=bytes.indexOf(58,at)
  need(colon>=at,'incomplete current native record header')
  const id=decode(bytes.subarray(at,colon));need(/^[0-9a-f]*$/i.test(id),'invalid current native record identity');at=colon+1
  let raw,kind='line'
  if(bytes[at]===84){
   const comma=bytes.indexOf(44,at),hex=decode(bytes.subarray(at+1,comma))
   need(comma>at&&/^[0-9a-f]+$/i.test(hex),'invalid current native text length')
   const length=Number.parseInt(hex,16)
   need(Number.isSafeInteger(length)&&length>=0&&comma+1+length<=bytes.length,'truncated current native text')
   raw=decode(bytes.subarray(comma+1,comma+1+length));at=comma+1+length;kind='text'
  }else{
   const newline=bytes.indexOf(10,at),end=newline<0?bytes.length:newline
   raw=decode(bytes.subarray(at,end));at=newline<0?end:end+1
  }
  // Include the exact ID/header/length/newline bytes, and every empty-ID
  // resource hint and duplicate occurrence. No decoded byte is discarded.
  const rows=records.get(id)??[]
  rows.push({kind,raw,completeSHA256:sha(bytes.subarray(start,at)),completeBytes:at-start})
  records.set(id,rows);count++
  need(count<=1000,'current native record bound exceeded')
 }
 const inventory=[...records].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,rows])=>({id,records:rows}))
 need(inventory.reduce((sum,row)=>sum+row.records.reduce((n,record)=>n+record.completeBytes,0),0)===bytes.length,'unaccounted current native carrier bytes')
 return{records,recordsSHA256:sha(JSON.stringify(inventory)),decodedPayloadBytes:bytes.length,recordCount:count}
}

// A second DATA-only identity accounts for this deployment's exact streamed
// header/reveal delivery. It does not sort ordinary HTML or qualify rendering.
// The full header, full initializer, every literal call and dependency order
// are checked before their positions may vary; all other bytes stay ordered.
function reactDeliveryProjection(remaining,projection){
 if(projection.emails.length)return null
 const bodies=readNativeDocument(remaining,{sourceRanges:true}).nodes(node=>node.tag==='body')
 if(bodies.length!==1)return null
 const nodes=bodies[0].children.filter(node=>typeof node!=='string')
 const headers=nodes.filter(node=>node.tag==='div'&&node.attrs.id==='S:1')
 if(headers.length!==1)return null
 const header=headers[0],headerText=remaining.slice(header.sourceStart,header.sourceEnd)
 const headerSHA='5db850b97f53069ebac4a23db47813d9a1695a1f97cc61f8febd2b33b92ddff6'
 const initializerSHA='7a3c441a297b4368e7168f53d44323873b11a160d3567f2d4695187785c22646'
 if(header.sourceNamespace!=='html'||Buffer.byteLength(headerText)!==2823||sha(headerText)!==headerSHA)return null
 const reveals=[]
 for(const node of nodes.filter(node=>node.tag==='script'&&(node.raw??'').includes('$RC('))){
  if(node.sourceNamespace!=='html'||remaining.slice(node.sourceStart,node.sourceOpenEnd)!=='<script>'||remaining.slice(node.sourceCloseStart,node.sourceEnd)!=='</script>')return null
  const match=/^([\s\S]*?)(\$RC\("B:([0-3])","S:\3"\))$/.exec(node.raw)
  if(!match)return null
  reveals.push({node,prefix:match[1],id:match[3]})
 }
 if(reveals.length!==4||reveals.map(row=>row.id).sort().join('')!=='0123')return null
 if(Buffer.byteLength(reveals[0].prefix)!==829||sha(reveals[0].prefix)!==initializerSHA||reveals.slice(1).some(row=>row.prefix!==''))return null
 for(const reveal of reveals){
  const targets=nodes.filter(node=>node.tag==='div'&&node.attrs.id==='S:'+reveal.id)
  if(targets.length!==1||targets[0].sourceEnd>reveal.node.sourceStart)return null
 }
 if(header.sourceEnd!==reveals.find(row=>row.id==='1').node.sourceStart)return null
 const spans=[header,...reveals.map(row=>row.node)].sort((a,b)=>a.sourceStart-b.sourceStart)
 let stripped='',at=0
 for(const span of spans){if(span.sourceStart<at)return null;stripped+=remaining.slice(at,span.sourceStart);at=span.sourceEnd}
 stripped+=remaining.slice(at)
 const reactDelivery={header:{bytes:2823,sha256:headerSHA},initializer:{bytes:829,sha256:initializerSHA},calls:['0','1','2','3'].map(id=>'$RC("B:'+id+'","S:'+id+'")')}
 return sha(JSON.stringify({...projection,remainingOriginalSHA256:sha(stripped),reactDelivery}))
}

// This is a DATA-only projection. Exact literal stream delivery and bootstrap
// positions are recorded but may vary; no browser execution or rendering
// equivalence follows. Every remaining original byte stays significant.
export function readCurrentDataCarrier(html){
 const doc=readNativeDocument(html,{sourceRanges:true}),root=doc.nodes(node=>node.tag==='root')[0],nodes=[]
 const walk=node=>{nodes.push(node);for(const child of node.children)if(typeof child!=='string')walk(child)}
 walk(root)
 const spans=[],frames=[],carrierPositions=[],emails=[];let bootstraps=0
 for(const node of nodes){
  if(node.tag==='script'){
   const original=html.slice(node.sourceStart,node.sourceEnd),raw=node.raw??''
   if(raw==='(self.__next_f=self.__next_f||[]).push([0])'){
    need(original===bootstrap&&node.sourceNamespace==='html','unreviewed current native bootstrap')
    bootstraps++;spans.push({start:node.sourceStart,end:node.sourceEnd,text:''})
    carrierPositions.push({kind:'bootstrap',start:node.sourceStart,end:node.sourceEnd,sha256:sha(original)})
   }else if(/^self\.__next_f\.push\(/.test(raw.trim())){
    need(node.sourceNamespace==='html'&&html.slice(node.sourceStart,node.sourceOpenEnd)==='<script>'&&html.slice(node.sourceCloseStart,node.sourceEnd)==='</script>','unreviewed current native carrier attributes')
    const call=/^self\.__next_f\.push\(([\s\S]*)\);?$/.exec(raw)
    need(call,'nonliteral current native data frame')
    let value;try{value=JSON.parse(call[1])}catch{need(false,'invalid current native data frame')}
    need(Array.isArray(value)&&value.length===2&&value[0]===1&&typeof value[1]==='string','invalid current native text frame')
    frames.push(value[1]);spans.push({start:node.sourceStart,end:node.sourceEnd,text:''})
    carrierPositions.push({kind:'literal-data',start:node.sourceStart,end:node.sourceEnd,sha256:sha(original)})
   }
  }
  if(!['a','span'].includes(node.tag))continue
  const tokens=attributes(html,node)
  for(const attr of tokens){
   const prefix=attr.name==='href'&&node.tag==='a'&&attr.value.startsWith('/cdn-cgi/l/email-protection#')?'/cdn-cgi/l/email-protection#':''
   const encoded=prefix||attr.name==='data-cfemail'&&(node.attrs.class??'').split(/\s+/).includes('__cf_email__')
   if(!encoded)continue
   need(tokens.filter(token=>token.name===attr.name).length===1&&node.attrs[attr.name]===attr.value,'ambiguous native contact attribute')
   const hex=attr.value.slice(prefix.length),digest=emailDigest(hex)
   emails.push({kind:prefix?'email-protection-href':'data-cfemail',...digest})
   spans.push({start:attr.start+prefix.length,end:attr.end,text:'$EXACT_DECODED_EMAIL_SHA256:'+digest.decodedSHA256})
  }
 }
 need(bootstraps===1&&frames.length>0&&frames.length<=32,'current native data carrier inventory changed')
 spans.sort((a,b)=>a.start-b.start)
 let remaining='',at=0
 for(const span of spans){need(span.start>=at&&span.end>=span.start,'overlapping native carrier spans');remaining+=html.slice(at,span.start)+span.text;at=span.end}
 remaining+=html.slice(at)
 const inventory=recordsOf(frames),projection={remainingOriginalSHA256:sha(remaining),recordsSHA256:inventory.recordsSHA256,decodedPayloadBytes:inventory.decodedPayloadBytes,recordCount:inventory.recordCount,bootstrapSHA256:sha(bootstrap),emails}
 return{records:inventory.records,projection,projectionSHA256:sha(JSON.stringify(projection)),nativeDataDeliveryProjectionSHA256:reactDeliveryProjection(remaining,projection),carrierPositions,frameCount:frames.length}
}
