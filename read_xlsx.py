# -*- coding: utf-8 -*-
import zipfile, re, html
p=r'C:\Users\sol hong\Downloads\punghyun_invest_model_SRB_2.xlsx'
z=zipfile.ZipFile(p)
ss=[html.unescape(s) for s in re.findall(r'<t[^>]*>(.*?)</t>', z.read('xl/sharedStrings.xml').decode('utf-8'), re.S)]
wb=z.read('xl/workbook.xml').decode('utf-8')
sheets=re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wb)
rels=z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
relmap=dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))

def col_to_idx(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-64)
    return n

def read_sheet(target):
    path='xl/'+target if not target.startswith('/') else target[1:]
    xmld=z.read(path).decode('utf-8')
    rows={}
    for cell in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*)>(.*?)</c>', xmld, re.S):
        col,row,attrs,inner=cell.group(1),int(cell.group(2)),cell.group(3),cell.group(4)
        t=re.search(r't="([^"]+)"',attrs)
        t=t.group(1) if t else 'n'
        vm=re.search(r'<v>(.*?)</v>', inner, re.S)
        fm=re.search(r'<f>(.*?)</f>', inner, re.S)
        val=''
        if t=='s' and vm: val=ss[int(vm.group(1))]
        elif vm: val=vm.group(1)
        rows.setdefault(row,{})[col_to_idx(col)]=(val, html.unescape(fm.group(1)) if fm else None)
    return rows

for name,rid in sheets:
    name=html.unescape(name)
    if name not in ('가정·레버','연간 요약'): continue
    print('\n===== SHEET:',name,'=====')
    rows=read_sheet(relmap[rid])
    for rnum in sorted(rows):
        cells=rows[rnum]
        line=[]
        for cidx in sorted(cells):
            v,f=cells[cidx]
            s=v
            if f: s=v+'  {='+f+'}'
            line.append(s)
        txt=' | '.join(line).strip()
        if txt: print(rnum, txt)
