import {need} from './currentRead20261117.js'
// The employer-declared collection module's complete scanItems/G.read/S.read
// format: uint32 row count, uint16 field count, UTF8 field and typed value.
// No native programme is executed. Every original byte must be consumed once.
export function readNativeCmsChunk(input){
 const bytes=Buffer.from(input);let offset=0
 need(bytes.length<=16*1024*1024,'CMS entity byte ceiling exceeded')
 const take=n=>{need(Number.isSafeInteger(n)&&n>=0&&offset+n<=bytes.length,'truncated CMS native binary');const part=bytes.subarray(offset,offset+n);offset+=n;return part},u8=()=>take(1).readUInt8(),u16=()=>take(2).readUInt16BE(),u32=()=>take(4).readUInt32BE(),str=()=>{const n=u32();need(n<=4*1024*1024,'native string ceiling exceeded');return new TextDecoder('utf8',{fatal:true}).decode(take(n))}
 const typed=(depth=0)=>{
  need(depth<20,'native CMS typed nesting exceeded');const type=u8();let value
  switch(type){
   case 0:return null
   case 1:{const n=u16();need(n<=256,'native CMS array ceiling exceeded');value=Array.from({length:n},()=>typed(depth+1));break}
   case 2:{const n=u8();need(n===0||n===1,'native CMS boolean malformed');value=n===1;break}
   case 3:case 5:case 6:case 12:value=str();break
   case 4:{const n=Number(take(8).readBigInt64BE());need(Number.isSafeInteger(n)&&Number.isFinite(new Date(n).getTime()),'native CMS date malformed');value=new Date(n).toISOString();break}
   case 7:case 10:value=JSON.parse(str());break
   case 8:value=take(8).readDoubleBE();need(Number.isFinite(value),'native CMS numeric value malformed');break
   case 9:{value=Object.create(null);const n=u16();need(n<=100,'native CMS object ceiling exceeded');for(let i=0;i<n;i++){const key=str();need(!Object.hasOwn(value,key),'duplicate native CMS object field');value[key]=typed(depth+1)}break}
   case 11:{const mode=u8();need(mode===0||mode===1,'native CMS rich-text representation unknown');value=mode===0?u32():str();break}
   case 13:value=u32();break
   default:need(false,'unknown native CMS typed tag')
  }
  return {type,value}
 }
 const count=u32();need(count<=40,'native CMS record ceiling exceeded');const rows=[],ids=new Set(),slugs=new Set()
 for(let i=0;i<count;i++){
  const start=offset,n=u16(),fields=Object.create(null);need(n>0&&n<=100,'native CMS row field count malformed')
  for(let j=0;j<n;j++){const key=str();need(!Object.hasOwn(fields,key),'duplicate native CMS row field');fields[key]=typed()}
  const id=fields.id,slug=fields.zwl5iu4RM;need(id?.type===12&&/^[A-Za-z0-9_-]{1,100}$/.test(id.value)&&!ids.has(id.value)&&slug?.type===12&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)&&!slugs.has(slug.value),'duplicate/malformed native CMS identity/slug');ids.add(id.value);slugs.add(slug.value)
  rows.push({offset:start,length:offset-start,fields})
 }
 need(offset===bytes.length,'trailing unconsumed native CMS bytes');return rows
}
