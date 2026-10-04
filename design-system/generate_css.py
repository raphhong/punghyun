"""Compile token aliases without resolving away the CSS dependency graph."""
from pathlib import Path
import hashlib, json, re, argparse
B=Path(__file__).resolve().parent
raw=(B/'tokens.json').read_bytes()
d=json.loads(raw)
flat={}
def walk(o,p=''):
    if isinstance(o,dict) and '$value' in o: flat[p]=o
    elif isinstance(o,dict):
        for k,v in o.items():
            if not k.startswith('$') and k!='metadata': walk(v,p+'.'+k if p else k)
walk(d)
def name(s): return '--ph-'+re.sub(r'([a-z])([A-Z])',r'\1-\2',s).lower().replace('.','-')
def resolve(k,seen=None):
    seen=set() if seen is None else seen
    if k in seen: raise ValueError('Cyclic token '+k)
    if k not in flat: raise ValueError('Missing token '+k)
    t=flat[k]; v=t['$value']; m=re.fullmatch(r'\{(.+)\}',str(v))
    if m:
        target=m[1]
        if target not in flat: raise ValueError('Missing token '+target)
        if t['$type']!=flat[target]['$type']: raise ValueError('Type mismatch '+k+' -> '+target)
        return resolve(target,seen|{k})
    if t['$type']=='color' and not re.fullmatch('#[0-9A-Fa-f]{6}',str(v)): raise ValueError('Invalid color '+k)
    if t['$type']=='dimension' and not re.fullmatch(r'\d+(?:\.\d+)?(?:px|pt|mm)',str(v)): raise ValueError('Invalid dimension '+k)
    return v
variables=[name(k) for k in flat]
if len(variables)!=len(set(variables)): raise ValueError('Duplicate CSS variable name')
lines=[f"/* Generated from tokens.json; version {d['metadata']['version']}; SHA-256 {hashlib.sha256(raw).hexdigest()}. Do not edit. */",':root {']
for k,t in flat.items():
    resolve(k)
    v=str(t['$value']);m=re.fullmatch(r'\{(.+)\}',v)
    if m:v='var('+name(m[1])+')'
    lines.append('  '+name(k)+': '+v+';')
lines+=['}','']
output='\n'.join(lines)
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
if args.check:
    if not (B/'tokens.css').exists() or (B/'tokens.css').read_text()!=output: raise SystemExit('Stale generated tokens.css')
    print('Validated fresh CSS:',len(flat),'typed tokens, unique names, no missing/cyclic aliases')
else:
    (B/'tokens.css').write_text(output)
    print('Generated',len(flat),'validated tokens')
