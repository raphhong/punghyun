import {inflateRawSync} from 'node:zlib';
import {posix} from 'node:path';
import {SaxesParser} from 'saxes';
import {sha,type Source,type Segment} from './review';
export type XlsxCell={cell:string;type:string;value:string|null;rawStoredValue:string|null;formula:string|null;formulaAttributes:Record<string,string>;formulaState:'not_formula'|'cached_unverified'|'cache_missing';numberFormatId:string;customNumberFormat:string|null;hiddenRow:boolean;hiddenColumn:boolean};
export type XlsxSheet={sheet:number;name:string;state:string;part:string;cells:XlsxCell[];mergedRanges:string[];columns:Record<string,string>[]};
export const xlsxNodeParserVersion='xlsx-node-v115-package-allowlist';
export const xlsxMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type XlsxNodeExtraction={parserVersion:typeof xlsxNodeParserVersion;sourceId:string;version:string;sha256:string;format:'xlsx';status:'extracted_needs_review';semanticVerified:false;inventoryComplete:false;dateSystem:'1900'|'1904';sheets:XlsxSheet[];segments:Segment[];warnings:string[]};
const fail=(reason:string)=>Object.assign(Error('source_unreadable'),{extractionReason:reason});
function need(ok:unknown,reason='malformed_document'):asserts ok{if(!ok)throw fail(reason);}
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
/** ZIP metadata is validated before any inflate. No ZIP64, encryption, filename aliases or trailing records. */
function unzip(bytes:Uint8Array,check:()=>void){
 const b=Buffer.from(bytes);need(b.length>=22,'unsupported_format');let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}}
 need(end>=0);need(b.readUInt16LE(end+4)===0&&b.readUInt16LE(end+6)===0&&b.readUInt16LE(end+8)===b.readUInt16LE(end+10),'unsupported_archive');
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),start=b.readUInt32LE(end+16);need(count>0&&count<=500&&start+size===end,'archive_limit');
 const entries:{name:string;flags:number;method:number;crc:number;compressed:number;size:number;offset:number}[]=[],names=new Set<string>();let cursor=start,total=0;
 for(let i=0;i<count;i++){
  check();need(cursor+46<=end&&b.readUInt32LE(cursor)===0x02014b50);const flags=b.readUInt16LE(cursor+8),method=b.readUInt16LE(cursor+10),crc=b.readUInt32LE(cursor+16),compressed=b.readUInt32LE(cursor+20),plain=b.readUInt32LE(cursor+24),nl=b.readUInt16LE(cursor+28),el=b.readUInt16LE(cursor+30),cl=b.readUInt16LE(cursor+32),offset=b.readUInt32LE(cursor+42);
  need(cursor+46+nl+el+cl<=end&&nl>0&&nl<=200);const raw=b.subarray(cursor+46,cursor+46+nl),name=raw.toString('utf8');need(Buffer.from(name).equals(raw)&&/^[\x20-\x7e]+$/.test(name)&&!/[\\%?#:]/.test(name)&&!name.startsWith('/')&&!name.split('/').some(p=>p==='..'||p==='.'),'unsafe_archive_path');
  need(!names.has(name.toLowerCase()),'archive_limit');names.add(name.toLowerCase());need((flags&~0x0808)===0&&(method===0||method===8),'unsupported_archive');need(b.readUInt16LE(cursor+34)===0&&((b.readUInt32LE(cursor+38)>>>16)&0xf000)!==0xa000,'unsupported_archive');
  need(plain<=8*1024*1024&&compressed!==0xffffffff&&offset!==0xffffffff&&plain<=Math.max(1,compressed)*200&&(total+=plain)<=32*1024*1024,'archive_limit');
  // ZIP64 and Unicode path extras would create alternate interpretations; reject them.
  for(let x=cursor+46+nl;x<cursor+46+nl+el;){need(x+4<=cursor+46+nl+el);const tag=b.readUInt16LE(x),len=b.readUInt16LE(x+2);need(![1,0x7075,0x6375].includes(tag)&&x+4+len<=cursor+46+nl+el,'unsupported_archive');x+=4+len;}
  entries.push({name,flags,method,crc,compressed,size:plain,offset});cursor+=46+nl+el+cl;
 }
 need(cursor===end);const out=new Map<string,Uint8Array>();let next=0;
 for(const e of [...entries].sort((a,c)=>a.offset-c.offset)){
  check();const o=e.offset;need(o===next&&o+30<=start&&b.readUInt32LE(o)===0x04034b50);need(b.readUInt16LE(o+6)===e.flags&&b.readUInt16LE(o+8)===e.method);const nl=b.readUInt16LE(o+26),el=b.readUInt16LE(o+28),data=o+30+nl+el;need(data+e.compressed<=start&&b.subarray(o+30,o+30+nl).toString('utf8')===e.name);
  for(let x=o+30+nl;x<data;){need(x+4<=data);const tag=b.readUInt16LE(x),len=b.readUInt16LE(x+2);need(![1,0x7075,0x6375].includes(tag)&&x+4+len<=data,'unsupported_archive');x+=4+len;}
  if(!(e.flags&8))need(b.readUInt32LE(o+14)===e.crc&&b.readUInt32LE(o+18)===e.compressed&&b.readUInt32LE(o+22)===e.size);
  const packed=b.subarray(data,data+e.compressed);let decoded:Buffer;
  try{if(e.method===0)decoded=Buffer.from(packed);else{const inflated=inflateRawSync(packed,{info:true,maxOutputLength:Math.max(1,e.size)}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}};need(inflated.engine.bytesWritten===packed.length,'unsupported_archive');decoded=inflated.buffer;}}catch{throw fail('archive_limit');}
  need(decoded.length===e.size&&crc32(decoded)===e.crc,'source_integrity');next=data+e.compressed;
  if(e.flags&8){need(next+12<=start);if(b.readUInt32LE(next)===0x08074b50)next+=4;need(next+12<=start&&b.readUInt32LE(next)===e.crc&&b.readUInt32LE(next+4)===e.compressed&&b.readUInt32LE(next+8)===e.size);next+=12;}
  out.set(e.name,decoded);
 }
 need(next===start);return out;
}
type X={local:string;uri:string;attrs:Record<string,string>;children:X[];text:string};
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main',R='http://schemas.openxmlformats.org/package/2006/relationships',O='http://schemas.openxmlformats.org/officeDocument/2006/relationships',C='http://schemas.openxmlformats.org/package/2006/content-types';
const children=(n:X,local:string,uri=S)=>n.children.filter(c=>c.local===local&&c.uri===uri);
const one=(n:X,local:string,uri=S)=>{const found=children(n,local,uri);need(found.length<=1);return found[0];};
const descendants=(n:X,local:string,uri=S):X[]=>n.children.flatMap(c=>[...(c.local===local&&c.uri===uri?[c]:[]),...descendants(c,local,uri)]);
function xml(bytes:Uint8Array,check:()=>void,budget:{nodes:number;characters:number}):X{
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail('unsafe_xml');}
 need(!text.includes('\0')&&!/<!\s*(?:DOCTYPE|ENTITY)/i.test(text),'unsafe_xml');const stack:X[]=[],roots:X[]=[];
 const p=new SaxesParser({xmlns:true});p.on('error',()=>{throw fail('unsafe_xml');});p.on('doctype',()=>{throw fail('unsafe_xml');});p.on('processinginstruction',()=>{throw fail('unsafe_xml');});
 p.on('opentag',tag=>{check();need(++budget.nodes<=100000&&stack.length<64,'document_limit');const attrs:Record<string,string>=Object.create(null);for(const a of Object.values(tag.attributes)){const key=a.uri?`{${a.uri}}${a.local}`:a.local;attrs[key]=a.value;}const x:X={local:tag.local,uri:tag.uri,attrs,children:[],text:''};if(stack.length)stack.at(-1)!.children.push(x);else roots.push(x);stack.push(x);});
 const add=(value:string)=>{budget.characters+=value.length;need(budget.characters<=6*1024*1024,'document_limit');if(stack.length)stack.at(-1)!.text+=value;};p.on('text',add);p.on('cdata',add);p.on('closetag',()=>{stack.pop();});
 try{p.write(text).close();}catch(e){if(e instanceof Error&&e.message==='source_unreadable')throw e;throw fail('unsafe_xml');}need(roots.length===1&&!stack.length);return roots[0];
}
const base='application/vnd.openxmlformats-officedocument.',types={book:base+'spreadsheetml.sheet.main+xml',sheet:base+'spreadsheetml.worksheet+xml',styles:base+'spreadsheetml.styles+xml',strings:base+'spreadsheetml.sharedStrings+xml',theme:base+'theme+xml',app:base+'extended-properties+xml',custom:base+'custom-properties+xml',core:'application/vnd.openxmlformats-package.core-properties+xml',rels:'application/vnd.openxmlformats-package.relationships+xml'};
function validIsoDate(value:string){const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))?)?$/.exec(value);if(!m)return false;const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]),leap=y%4===0&&(y%100!==0||y%400===0);const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];return y>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&(!m[4]||(Number(m[4])<24&&Number(m[5])<60&&Number(m[6])<60))&&(!m[8]||(Number(m[8])<=14&&Number(m[9])<60&&(Number(m[8])<14||Number(m[9])===0)));}
function expectedType(name:string):string|null{return name==='xl/workbook.xml'?types.book:name==='xl/styles.xml'?types.styles:name==='xl/sharedStrings.xml'?types.strings:/^xl\/worksheets\/sheet[1-9][0-9]*\.xml$/.test(name)?types.sheet:/^xl\/theme\/theme[1-9][0-9]*\.xml$/.test(name)?types.theme:name==='docProps/core.xml'?types.core:name==='docProps/app.xml'?types.app:name==='docProps/custom.xml'?types.custom:/^(?:_rels\/\.rels|xl\/_rels\/workbook\.xml\.rels|xl\/worksheets\/_rels\/sheet[1-9][0-9]*\.xml\.rels)$/.test(name)?types.rels:null;}
const relationTypes:Record<string,string>={[O+'/officeDocument']:types.book,[O+'/worksheet']:types.sheet,[O+'/styles']:types.styles,[O+'/sharedStrings']:types.strings,[O+'/theme']:types.theme,[O+'/extended-properties']:types.app,[O+'/custom-properties']:types.custom,['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties']:types.core};
export async function extractXlsxNode(source:Source,signal?:AbortSignal):Promise<XlsxNodeExtraction>{
 const deadline=Date.now()+8000,check=()=>{if(signal?.aborted)throw fail('extraction_cancelled');if(Date.now()>deadline)throw fail('extraction_timeout');};check();
 need(source.mime.split(';')[0]===xlsxMime&&source.bytes.length>4&&source.bytes.length<=8*1024*1024,'unsupported_format');need(source.id&&source.version&&sha(source.bytes)===source.sha256,'source_integrity');
 const zip=unzip(source.bytes,check),trees=new Map<string,X>(),xmlBudget={nodes:0,characters:0};
 for(const [name,data]of zip){check();if(name.endsWith('/')){need(data.length===0);continue;}need(name==='[Content_Types].xml'||expectedType(name),'unsupported_active_package');trees.set(name,xml(data,check,xmlBudget));}
 const ct=trees.get('[Content_Types].xml');need(ct&&ct.uri===C&&ct.local==='Types');const defaults=new Map<string,string>(),overrides=new Map<string,string>();
 for(const e of ct.children){need(e.uri===C&&['Default','Override'].includes(e.local));const key=e.local==='Default'?e.attrs.Extension:e.attrs.PartName,type=e.attrs.ContentType;need(key&&type&&!/[\\%?#]/.test(key));const map=e.local==='Default'?defaults:overrides;need(!map.has(key));map.set(key,type);need(['application/xml',...Object.values(types)].includes(type),'unsupported_active_package');if(e.local==='Override')need(key.startsWith('/')&&zip.has(key.slice(1)));}
 for(const name of trees.keys()){if(name==='[Content_Types].xml')continue;const declared=overrides.get('/'+name)??defaults.get(name.split('.').at(-1)!);need(declared===expectedType(name),'unsupported_active_package');}
 const rels=new Map<string,Map<string,{type:string;target:string}>>();
 for(const [name,t]of trees){if(!name.endsWith('.rels'))continue;need(t.uri===R&&t.local==='Relationships');const map=new Map<string,{type:string;target:string}>();rels.set(name,map);const relsource=name==='_rels/.rels'?'':name.replace(/\/_rels\/([^/]+)\.rels$/,'/$1');if(relsource)need(trees.has(relsource));
  for(const rel of t.children){need(rel.uri===R&&rel.local==='Relationship');const {Id:id,Type:type,Target:target,TargetMode:mode}=rel.attrs;need(id&&!map.has(id));need(mode===undefined||mode==='Internal','external_links');need(target&&!/[\\%?#:]/.test(target)&&!target.startsWith('//'),'unsafe_archive_path');need(relationTypes[type],'unsupported_active_package');const resolved=target.startsWith('/')?posix.normalize(target.slice(1)):posix.normalize(posix.join(relsource?posix.dirname(relsource):'',target));need(!resolved.startsWith('../')&&zip.has(resolved)&&expectedType(resolved)===relationTypes[type],'unsupported_active_package');map.set(id,{type,target:resolved});}
 }
 const book=trees.get('xl/workbook.xml');need(book&&book.uri===S&&book.local==='workbook');const packageRels=rels.get('_rels/.rels');need(packageRels&&[...packageRels.values()].filter(x=>x.type===O+'/officeDocument'&&x.target==='xl/workbook.xml').length===1);
 need(!one(book,'externalReferences'),'external_links');const named=one(book,'definedNames');need(!named||named.children.length===0,'unsupported_named_ranges');
 const sharedTree=trees.get('xl/sharedStrings.xml');if(sharedTree)need(sharedTree.uri===S&&sharedTree.local==='sst');const shared=sharedTree?children(sharedTree,'si').map(si=>descendants(si,'t').map(t=>t.text).join('')):[];need(shared.length<=10000&&shared.reduce((n,s)=>n+s.length,0)<=1000000,'document_limit');
 const style=trees.get('xl/styles.xml');if(style)need(style.uri===S&&style.local==='styleSheet');const formats=new Map<string,string>();if(style)for(const f of descendants(style,'numFmt')){need(f.attrs.numFmtId&&!formats.has(f.attrs.numFmtId));formats.set(f.attrs.numFmtId,f.attrs.formatCode);}const xf=style?one(style,'cellXfs'):undefined,xfs=xf?children(xf,'xf'):[];
 const sheetsNode=one(book,'sheets'),bookRels=rels.get('xl/_rels/workbook.xml.rels');need(sheetsNode&&bookRels);const date1904=one(book,'workbookPr')?.attrs.date1904;need([undefined,'0','1','false','true'].includes(date1904),'unsupported_sheet_features');const sheets:XlsxSheet[]=[],sheetNames=new Set<string>(),sheetIds=new Set<string>(),used=new Set<string>();let total=0;
 for(const item of children(sheetsNode,'sheet')){
  check();need(sheets.length<30,'document_limit');need(/^[1-9][0-9]*$/.test(item.attrs.sheetId??'')&&!sheetIds.has(item.attrs.sheetId));sheetIds.add(item.attrs.sheetId);const name=item.attrs.name,rel=bookRels.get(item.attrs[`{${O}}id`]);need(name&&name.length<=31&&!sheetNames.has(name.toLowerCase()));sheetNames.add(name.toLowerCase());need(rel&&rel.type===O+'/worksheet'&&!used.has(rel.target),'unsupported_sheet_type');used.add(rel.target);const tree=trees.get(rel.target);need(tree&&tree.uri===S&&tree.local==='worksheet');need(['visible','hidden','veryHidden'].includes(item.attrs.state??'visible'));
  need(!tree.children.some(x=>x.uri===S&&['oleObjects','drawing','legacyDrawing','extLst','hyperlinks','controls','tableParts','webPublishItems'].includes(x.local)),'unsupported_sheet_features');
  const colsNode=one(tree,'cols'),columns=colsNode?children(colsNode,'col'):[],hiddenColumns=new Set<number>(),coveredColumns=new Set<number>();
  for(const column of columns){const a=column.attrs;need(/^[1-9][0-9]*$/.test(a.min??'')&&/^[1-9][0-9]*$/.test(a.max??'')&&Number(a.min)<=Number(a.max)&&Number(a.max)<=16384&&[undefined,'0','1','false','true'].includes(a.hidden),'unsupported_sheet_features');for(let n=Number(a.min);n<=Number(a.max);n++){need(!coveredColumns.has(n),'unsupported_sheet_features');coveredColumns.add(n);if(['1','true'].includes(a.hidden))hiddenColumns.add(n);}}
  need(!['1','true'].includes(one(tree,'sheetFormatPr')?.attrs.zeroHeight??''),'unsupported_sheet_features');
  const data=one(tree,'sheetData'),cells:XlsxCell[]=[],refs=new Set<string>();need(data);const rows=new Set<string>();
  for(const row of children(data,'row')){need([undefined,'0','1','false','true'].includes(row.attrs.hidden),'unsupported_sheet_features');need(/^[1-9][0-9]*$/.test(row.attrs.r)&&Number(row.attrs.r)<=1048576&&!rows.has(row.attrs.r));rows.add(row.attrs.r);for(const c of children(row,'c')){
   check();need(++total<=10000,'document_limit');const ref=c.attrs.r,match=/^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(ref??'');need(match&&match[2]===row.attrs.r&&!refs.has(ref));refs.add(ref);let col=0;for(const ch of match[1])col=col*26+ch.charCodeAt(0)-64;need(col<=16384,'document_limit');
   const type=c.attrs.t??'n';need(['n','s','inlineStr','str','b','e','d'].includes(type),'unsupported_cell_type');const f=one(c,'f'),v=one(c,'v'),raw=v?v.text:null,formula=f?f.text:null;let value=raw;
   if(formula!==null)need(!/\[|\]|https?:|WEBSERVICE|HYPERLINK|RTD\s*\(|\|/i.test(formula),'external_links');
   if(type==='s'){need(raw!==null&&/^\d+$/.test(raw)&&Number(raw)<shared.length);value=shared[Number(raw)];}if(type==='inlineStr')value=descendants(c,'t').map(t=>t.text).join('');need([value,raw,formula].every(s=>s===null||s.length<=8192),'document_limit');
   if(type==='n'&&value!==null)need(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)&&Number.isFinite(Number(value)),'unsupported_cell_type');if(type==='b'&&value!==null)need(value==='0'||value==='1');if(type==='d'&&value!==null)need(validIsoDate(value),'unsupported_cell_type');
   const si=c.attrs.s??'0';need(/^\d+$/.test(si));const index=Number(si);need(index<xfs.length||index===0&&!xfs.length);const fmt=xfs[index]?.attrs.numFmtId??'0';
   cells.push({cell:ref,type,value,rawStoredValue:raw,formula,formulaAttributes:f?{...f.attrs}:{},formulaState:f?(raw===null?'cache_missing':'cached_unverified'):'not_formula',numberFormatId:fmt,customNumberFormat:formats.get(fmt)??null,hiddenRow:['1','true'].includes(row.attrs.hidden),hiddenColumn:hiddenColumns.has(col)});
  }}
  sheets.push({sheet:sheets.length+1,name,state:item.attrs.state??'visible',part:rel.target,cells,mergedRanges:descendants(tree,'mergeCell').map(x=>x.attrs.ref),columns:columns.map(x=>({...x.attrs}))});
 }
 need(sheets.length>0);const segments:Segment[]=[];let chars=0;
 for(const sheet of sheets)for(const cell of sheet.cells){if(cell.formulaState!=='not_formula'||cell.type==='e'||(cell.hiddenRow||cell.hiddenColumn)||sheet.state!=='visible'||!cell.value?.trim())continue;const locator='sheet:'+sheet.sheet+';name:'+encodeURIComponent(sheet.name)+';cell:'+cell.cell+';part:value';chars+=cell.value.length;need(chars<=1000000&&segments.length<10000,'document_limit');segments.push({id:'seg-'+sha(JSON.stringify([source.id,source.version,source.sha256,xlsxNodeParserVersion,locator])),sourceId:source.id,version:source.version,sha256:source.sha256,locator,text:cell.value,assetId:source.assetId});}
 check();return {parserVersion:xlsxNodeParserVersion,sourceId:source.id,version:source.version,sha256:source.sha256,format:'xlsx',status:'extracted_needs_review',semanticVerified:false,inventoryComplete:false,dateSystem:date1904==='1'||date1904==='true'?'1904':'1900',sheets,segments,warnings:['formula_cache_not_recalculated','formula_and_hidden_cells_excluded_from_model_segments','units_dates_vat_not_inferred','rows_not_deduplicated','deposits_not_sales','internal_transfer_not_classified',...(segments.length>128||chars>12000?['large_workbook_select_required']:[])]};
}
