# -*- coding: utf-8 -*-
import zipfile, re, html
z=zipfile.ZipFile(r'C:\Users\sol hong\Downloads\punghyun_invest_model_SRB_2.xlsx')
ss=[html.unescape(s) for s in re.findall(r'<t[^>]*>(.*?)</t>', z.read('xl/sharedStrings.xml').decode('utf-8'), re.S)]
def ctoi(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-64)
    return n
pl=z.read('xl/worksheets/sheet3.xml').decode('utf-8')
label={}
for cell in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*)>(.*?)</c>', pl, re.S):
    col,row,attrs,inner=cell.group(1),int(cell.group(2)),cell.group(3),cell.group(4)
    ci=ctoi(col)
    if ci not in (1,2): continue
    t=re.search(r't="([^"]+)"',attrs); t=t.group(1) if t else 'n'
    vm=re.search(r'<v>(.*?)</v>', inner, re.S)
    if not vm: continue
    val=ss[int(vm.group(1))] if t=='s' else vm.group(1)
    label.setdefault(row,{})[ci]=val
def lab(r):
    d=label.get(r,{}); return (d.get(1,'')+' '+d.get(2,'')).strip()
su=z.read('xl/worksheets/sheet2.xml').decode('utf-8')
rows={}
for cell in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*)>(.*?)</c>', su, re.S):
    col,row,attrs,inner=cell.group(1),int(cell.group(2)),cell.group(3),cell.group(4)
    ci=ctoi(col)
    t=re.search(r't="([^"]+)"',attrs); t=t.group(1) if t else 'n'
    vm=re.search(r'<v>(.*?)</v>', inner, re.S)
    fm=re.search(r'<f>(.*?)</f>', inner, re.S)
    val=''
    if vm: val = ss[int(vm.group(1))] if t=='s' else vm.group(1)
    rows.setdefault(row,{})[ci]=(val, fm.group(1) if fm else None)
for r in sorted(rows):
    cells=rows[r]
    srcrow=None
    for ci in sorted(cells):
        v,f=cells[ci]
        if f:
            m=re.search(r"P&L'!C(\d+)", f)
            if m: srcrow=int(m.group(1)); break
    vals=[cells[ci][0] for ci in sorted(cells) if cells[ci][0] != '']
    plabel=lab(srcrow) if srcrow else ''
    def num(x):
        try: return round(float(x)/100,1)
        except: return x
    nums=[num(v) for v in vals if re.match(r'^-?\d', str(v))]
    print(r, '[PL', srcrow, plabel, ']', nums[:4])
