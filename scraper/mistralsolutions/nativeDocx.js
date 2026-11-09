import {createHash} from 'node:crypto'
import {inflateRawSync,crc32} from 'node:zlib'
import xmlReader from 'mammoth/lib/xml/reader.js'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Mistral native DOCX: '+message)}
const decoder=new TextDecoder('utf-8',{fatal:true})
const namespaces={'http://schemas.openxmlformats.org/wordprocessingml/2006/main':'w','http://schemas.openxmlformats.org/package/2006/relationships':'rel','http://schemas.openxmlformats.org/package/2006/content-types':'ct'}
const allowedParts=new Set(['[Content_Types].xml','_rels/.rels','word/document.xml','word/_rels/document.xml.rels','word/theme/theme1.xml','word/settings.xml','word/numbering.xml','word/styles.xml','word/webSettings.xml','word/fontTable.xml','word/_rels/fontTable.xml.rels','word/fonts/NotoSansSymbols-regular.ttf','word/fonts/NotoSansSymbols-bold.ttf','docProps/core.xml','docProps/app.xml'])
const allowedMain=new Set('document body p pPr r rPr t br tab b bCs cols docGrid ilvl jc lastRenderedPageBreak numId numPr pgMar pgSz proofErr sectPr spacing sz szCs u highlight ind pgNumType rFonts rtl'.split(' ').map(n=>'w:'+n))
const children=n=>n.children||[],walk=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>walk(c,p))]
const flow=n=>n.type==='text'?n.value:n.name==='w:br'?'\n':n.name==='w:tab'?'\t':children(n).map(flow).join('')+(n.name==='w:p'?'\n':'')
const clean=s=>String(s??'').replace(/\s+/g,' ').trim()
const labels={designation:['Designation'],title:['Job Title','Position','Role'],jobId:['Job ID','JobID','Job Identifier'],employer:['Employer','Hiring Organization','Company','Company Name','Hiring Company'],location:['Location','Job Location','Work Location'],experience:['Experience','Years Of Experience','Experience Range'],country:['Country','Work Country','Job Country','Country of Employment'],assignment:['Work assignment','Workplace assignment','Assigned location','Mandatory assignment','Mandatory work assignment'],employmentType:['Employment Type']}
// Preserve every declaration, including separate declarations inside one HTML
// line. A matching declaration cannot cancel another contradictory declaration.
export function readMistralDeclarations(lines,{embedded=false}={}){
 const result=Object.fromEntries(Object.keys(labels).map(key=>[key,[]]))
 const alternatives=Object.values(labels).flat().sort((a,b)=>b.length-a.length).join('|')
 for(const line of lines){
  const matches=[...String(line).matchAll(new RegExp((embedded?'(?:^|[\\s;,.])':'^')+'('+alternatives+')\\s*(?::|[-\\u2013\\u2014])\\s*','gi'))]
  for(let i=0;i<matches.length;i++){const match=matches[i],key=Object.keys(labels).find(key=>labels[key].some(label=>label.toLowerCase()===match[1].toLowerCase())),value=clean(String(line).slice(match.index+match[0].length,matches[i+1]?.index));if(value&&!result[key].includes(value))result[key].push(value)}
 }
 return result
}
const xml=async bytes=>{const text=decoder.decode(bytes);need(!/<!DOCTYPE|<!ENTITY/i.test(text),'unreviewed XML declarations');const node=await xmlReader.readString(text,namespaces);need(node&&node.type==='element','strict XML root required');let count=0;const check=(n,depth)=>{need(++count<=30000&&depth<=80,'bounded XML tree required');for(const c of children(n))check(c,depth+1)};check(node,0);return node}

// Bound and validate original members without extracting paths, following
// relationships or executing Word code.
export function readMistralPackage(input){
 const bytes=Buffer.from(input||[]);need(bytes.length>=22&&bytes.length<=4000000,'bounded original bytes required')
 let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--
 need(end>=0&&bytes.readUInt32LE(end)===0x06054b50,'ZIP end record required')
 need(end+22+bytes.readUInt16LE(end+20)===bytes.length&&!bytes.readUInt16LE(end+4)&&!bytes.readUInt16LE(end+6),'single complete ZIP archive required')
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16)
 need(count>0&&count<=32&&count===bytes.readUInt16LE(end+8)&&start+size===end,'bounded complete ZIP directory required')
 const parts=new Map();let offset=start,total=0
 for(let i=0;i<count;i++){
  need(offset+46<=end&&bytes.readUInt32LE(offset)===0x02014b50,'native ZIP directory entry required')
  const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),checksum=bytes.readUInt32LE(offset+16),compressed=bytes.readUInt32LE(offset+20),expanded=bytes.readUInt32LE(offset+24),nameLength=bytes.readUInt16LE(offset+28),extraLength=bytes.readUInt16LE(offset+30),commentLength=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42)
  const next=offset+46+nameLength+extraLength+commentLength
  need(next<=end&&!(flags&~0x080e)&&[0,8].includes(method)&&!(method===0&&(flags&6))&&expanded<=600000&&total+expanded<=2400000,'unsupported or oversized ZIP member')
  const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength))
  need(allowedParts.has(name)&&!parts.has(name)&&!bytes.readUInt16LE(offset+34),'unreviewed or duplicate native package part: '+name)
  need(local+30<=start&&bytes.readUInt32LE(local)===0x04034b50&&bytes.readUInt16LE(local+6)===flags&&bytes.readUInt16LE(local+8)===method,'native local ZIP declaration differs')
  const localNameLength=bytes.readUInt16LE(local+26),localExtraLength=bytes.readUInt16LE(local+28),dataStart=local+30+localNameLength+localExtraLength
  need(dataStart+compressed<=start&&decoder.decode(bytes.subarray(local+30,local+30+localNameLength))===name,'native ZIP member identity differs')
  if(!(flags&8))need(bytes.readUInt32LE(local+14)===checksum&&bytes.readUInt32LE(local+18)===compressed&&bytes.readUInt32LE(local+22)===expanded,'native local ZIP lengths differ')
  const compressedBytes=bytes.subarray(dataStart,dataStart+compressed),body=method===0?Buffer.from(compressedBytes):inflateRawSync(compressedBytes,{maxOutputLength:Math.max(1,Math.min(600000,2400000-total))})
  need(body.length===expanded&&crc32(body)===checksum,'native ZIP inflated length or CRC differs')
  total+=body.length;parts.set(name,body);offset=next
 }
 need(offset===end&&parts.has('word/document.xml')&&parts.has('[Content_Types].xml')&&parts.has('_rels/.rels'),'complete native DOCX package required')
 return{bytes,parts}
}

export async function readMistralDocx(bytes){
 const archive=readMistralPackage(bytes),models=new Map()
 for(const[name,body]of archive.parts){
  if(name.endsWith('.ttf'))continue
  const model=await xml(body);models.set(name,model)
  need(!walk(model,n=>n.type==='element'&&['w:vanish','w:webHidden','w:specVanish','w:del','w:instrText','w:altChunk'].includes(n.name)).length,'hidden, revised or delegated criteria require review')
  need(!walk(model,n=>n.type==='element'&&['w:sz','w:szCs'].includes(n.name)&&Number(n.attributes?.['w:val'])===0).length,'unreadable native text size')
  need(!walk(model,n=>n.name==='rel:Relationship'&&n.attributes.TargetMode==='External').length,'external document relationships require review')
 }
 const types=models.get('[Content_Types].xml'),rels=models.get('_rels/.rels')
 need(walk(types,n=>n.name==='ct:Override'&&n.attributes.PartName==='/word/document.xml'&&n.attributes.ContentType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml').length===1,'native non-macro Word main part required')
 need(walk(rels,n=>n.name==='rel:Relationship'&&n.attributes.Type==='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'&&n.attributes.Target==='word/document.xml').length===1,'native office document relationship required')
 const model=models.get('word/document.xml')
 need(model.name==='w:document'&&walk(model,n=>n.name==='w:body').length===1,'native Word body required')
 need(!walk(model,n=>n.type==='element'&&!allowedMain.has(n.name)).length,'unreviewed criterion structure')
 const lines=flow(model).split('\n').map(clean).filter(Boolean),title=lines[0],text=lines.join('\n')
 need(title&&text.length>=150&&lines.length>=4,'whole native role criteria required')
 const fields=readMistralDeclarations(flow(model).split(/[\n\t]/).map(clean).filter(Boolean))
 return{title,text,lines,fields,bodySHA256:sha(archive.bytes),originalArchiveBase64:archive.bytes.toString('base64'),wholeNativeDocumentModel:model,packageParts:[...archive.parts].map(([name,body])=>({name,bytes:body.length,sha256:sha(body)})),allNativeTextRetained:true,unreviewedPartsOmitted:false,documentCodeExecuted:false,embeddedFontProgramsExecuted:false,documentRendered:false,externalRelationshipsOpened:false,documentPropertiesAreNotPublicationDates:true}
}
