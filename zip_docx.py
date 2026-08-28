# -*- coding: utf-8 -*-
import zipfile, os
src=r'C:\Users\sol hong\Downloads\ir_unpacked'
out=r'C:\Users\sol hong\Downloads\punghyun_IR_full.docx'
if os.path.exists(out): os.remove(out)
z=zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)
for root,_,files in os.walk(src):
    for f in files:
        full=os.path.join(root,f)
        arc=os.path.relpath(full,src).replace(os.sep,'/')
        z.write(full,arc)
z.close()
print('wrote',out,os.path.getsize(out))
