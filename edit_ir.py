# -*- coding: utf-8 -*-
import re

path=r'C:\Users\sol hong\Downloads\ir_unpacked\word\document.xml'
x=open(path,encoding='utf-8').read()

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def run(text, bold=False, color=None, sz=None):
    rpr=''
    if bold: rpr+='<w:b/><w:bCs/>'
    if color: rpr+='<w:color w:val="%s"/>'%color
    if sz: rpr+='<w:sz w:val="%d"/><w:szCs w:val="%d"/>'%(sz,sz)
    rpr='<w:rPr>%s</w:rPr>'%rpr if rpr else ''
    return '<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>'%(rpr, esc(text))

def heading(text):
    return ('<w:p><w:pPr><w:keepNext/><w:spacing w:after="140" w:before="300"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="1F5C4D"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t></w:r></w:p>'%esc(text))

def subheading(text):
    return ('<w:p><w:pPr><w:keepNext/><w:spacing w:after="90" w:before="180"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14243B"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t></w:r></w:p>'%esc(text))

def body(runs):
    if isinstance(runs,str): runs=[(runs,False)]
    r=''.join(run(t,b) for (t,b) in runs)
    return '<w:p><w:pPr><w:spacing w:after="130" w:line="300"/></w:pPr>%s</w:p>'%r

def numitem(mark, label, text, accent='1F5C4D'):
    return ('<w:p><w:pPr><w:spacing w:after="100" w:line="294"/><w:ind w:left="360" w:hanging="360"/></w:pPr>'
            + run(mark+' ', bold=True, color=accent)
            + run(label, bold=True)
            + run(text) + '</w:p>')

def spacer():
    return '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>'

def table(headers, rows, widths, aligns=None):
    n=len(headers)
    if aligns is None:
        aligns=['left']+['center']*(n-1)
    grid=''.join('<w:gridCol w:w="%d"/>'%w for w in widths)
    def cell(w, content_runs, align, header=False):
        borders=('<w:tcBorders>'
                 '<w:top w:val="single" w:color="CCCCCC" w:sz="1"/>'
                 '<w:left w:val="single" w:color="CCCCCC" w:sz="1"/>'
                 '<w:bottom w:val="single" w:color="CCCCCC" w:sz="1"/>'
                 '<w:right w:val="single" w:color="CCCCCC" w:sz="1"/></w:tcBorders>')
        shd='<w:shd w:fill="14243B" w:val="clear"/>' if header else ''
        mar='<w:tcMar><w:top w:type="dxa" w:w="70"/><w:left w:type="dxa" w:w="110"/><w:bottom w:type="dxa" w:w="70"/><w:right w:type="dxa" w:w="110"/></w:tcMar>'
        p='<w:p><w:pPr><w:jc w:val="%s"/></w:pPr>%s</w:p>'%(align, content_runs)
        return ('<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="%d"/>%s%s%s<w:vAlign w:val="center"/></w:tcPr>%s</w:tc>'
                %(w, borders, shd, mar, p))
    hcells=''.join(cell(widths[i], run(headers[i], bold=True, color='FFFFFF'), 'left' if i==0 else 'center', header=True) for i in range(n))
    trs='<w:tr><w:trPr><w:tblHeader/></w:trPr>%s</w:tr>'%hcells
    for r in rows:
        cells=''
        for i in range(n):
            txt=r[i]
            if isinstance(txt, tuple):
                content=run(txt[0], bold=txt[1])
            else:
                content=run(txt)
            cells+=cell(widths[i], content, aligns[i])
        trs+='<w:tr>%s</w:tr>'%cells
    return ('<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="10000"/></w:tblPr>'
            '<w:tblGrid>%s</w:tblGrid>%s</w:tbl>'%(grid, trs)) + spacer()

def callout(title, paras, accent='1F5C4D', bg='F0F5F3'):
    tcborders=('<w:tcBorders>'
               '<w:top w:val="single" w:color="DDDDDD" w:sz="1"/>'
               '<w:left w:val="single" w:color="%s" w:sz="18"/>'
               '<w:bottom w:val="single" w:color="DDDDDD" w:sz="1"/>'
               '<w:right w:val="single" w:color="DDDDDD" w:sz="1"/></w:tcBorders>'%accent)
    shd='<w:shd w:fill="%s" w:val="clear"/>'%bg
    mar='<w:tcMar><w:top w:type="dxa" w:w="120"/><w:left w:type="dxa" w:w="200"/><w:bottom w:type="dxa" w:w="120"/><w:right w:type="dxa" w:w="160"/></w:tcMar>'
    ptitle='<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:color w:val="%s"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>'%(accent, esc(title))
    pbody=''
    for i,pr in enumerate(paras):
        last = (i==len(paras)-1)
        af = '0' if last else '80'
        r = run(pr) if isinstance(pr,str) else ''.join(run(t,b) for (t,b) in pr)
        pbody+='<w:p><w:pPr><w:spacing w:after="%s" w:line="294"/></w:pPr>%s</w:p>'%(af, r)
    return ('<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="10000"/></w:tblPr><w:tblGrid><w:gridCol w:w="10000"/></w:tblGrid>'
            '<w:tr><w:tc><w:tcPr><w:tcW w:type="dxa" w:w="10000"/>%s%s%s</w:tcPr>%s%s</w:tc></w:tr></w:tbl>'
            %(tcborders, shd, mar, ptitle, pbody)) + spacer()

# ---- GTM chapter ----
gtm = heading('\u2166. \uc2dc\uc7a5 \uc9c4\uc785 \uc804\ub7b5 (Go-to-Market)')
gtm += body('6% \uc6d4 \uc131\uc7a5\uc740 \ub9c9\uc5f0\ud55c \ubaa9\ud45c\uac00 \uc544\ub2c8\ub77c, \uc774\ubbf8 \uac00\ub3d9 \uac00\ub2a5\ud55c \uace0\uac1d \ucc44\ub110\uacfc \ub300\ud45c\uc758 \uac80\uc99d\ub41c \ucc98\ub9ac \uc5ed\ub7c9\uc5d0\uc11c \ub3c4\ucd9c\ub41c \uc218\uce58\uc785\ub2c8\ub2e4. \uc544\ub798\ub294 \uadf8 \ub3c4\ub2ec \uacbd\ub85c\uc785\ub2c8\ub2e4.')
gtm += subheading('\ucd08\uae30 \uace0\uac1d \ud655\ubcf4 \uacbd\ub85c')
gtm += numitem('\u2460','\ub300\ud45c \ubcf4\uc720 \ub124\ud2b8\uc6cc\ud06c: ','BLQ \uc6b4\uc601 \uacfc\uc815\uc5d0\uc11c \ucd95\uc801\ud55c \uc0ac\uc5c5\uc790\u00b7\uc815\uc0b0 \ud30c\ud2b8\ub108 \uad00\uacc4\ub97c \ucd08\uae30 \uc601\uc5c5 \ud30c\uc774\ud504\ub77c\uc778\uc73c\ub85c \uc989\uc2dc \ud65c\uc6a9\ud569\ub2c8\ub2e4. \uc2e0\uaddc \uc2dc\uc7a5\uc744 \ucc98\uc74c\ubd80\ud130 \uac1c\ucc99\ud558\ub294 \uac83\uc774 \uc544\ub2d9\ub2c8\ub2e4.')
gtm += numitem('\u2461','\uc18c\ud48d\ubca4\ucc98\uc2a4 \ud3ec\ud2b8\ud3f4\ub9ac\uc624: ','JV \ud30c\ud2b8\ub108\uc778 \uc18c\ud48d\uc758 \ud3ec\ud2b8\ud3f4\ub9ac\uc624\uc0ac\u00b7\ud22c\uc790 \ub124\ud2b8\uc6cc\ud06c\ub97c \ud1b5\ud574 \uc2e0\uc6d0\uacfc \uc0ac\uc5c5\uc131\uc774 \ud655\uc778\ub41c \uc0ac\uc5c5\uc790\ub97c \uc18c\uc2f1\ud569\ub2c8\ub2e4.')
gtm += numitem('\u2462','\uce74\ub4dc\u00b7\uc815\uc0b0 \ucc44\ub110 \uc81c\ud734: ','\uce74\ub4dc\ub9e4\ucd9c \ub370\uc774\ud130\ub97c \uae30\ubc18\uc73c\ub85c \uc790\uae08 \uc218\uc694\uc640 \uc0c1\ud658\ub825\uc774 \ud655\uc778\ub41c \uc0ac\uc5c5\uc790\ub97c \uc120\ubcc4 \ud0c0\uac9f\ud305\ud558\uc5ec, \ubd80\uc2e4 \uac00\ub2a5\uc131\uc774 \ub0ae\uc740 \uace0\uac1d\ubd80\ud130 \ud655\ubcf4\ud569\ub2c8\ub2e4.')
gtm += numitem('\u2463','\ub514\uc9c0\ud138 \uc778\ubc14\uc6b4\ub4dc: ','\uac80\uc0c9 \ucd5c\uc801\ud654(SEO)\ub41c \uc6f9\uc0ac\uc774\ud2b8\ub97c \uc774\ubbf8 \uad6c\ucd95\ud558\uc5ec, \uc790\ubc1c\uc801 \ubb38\uc758 \uc720\uc785 \ucc44\ub110\uc744 \ucd08\uae30\ubd80\ud130 \uac00\ub3d9\ud569\ub2c8\ub2e4.')
gtm += subheading('\uc131\uc7a5 \ube0c\ub9ac\uc9c0 \u2014 \uc6d4 6%\uc758 \ubd84\ud574')
gtm += body('\ud3c9\uade0 \uacc4\uc57d \uaddc\ubaa8\ub97c \uc57d 2,000\ub9cc\uc6d0\uc73c\ub85c \uac00\uc815\ud558\uba74, \uc2dc\uc791 \uc6d4 \ucde8\uae09 5\uc5b5\uc6d0\uc740 \uc6d4 \uc2e0\uaddc \uc57d 25\uac74\uc5d0 \ud574\ub2f9\ud569\ub2c8\ub2e4. 3\ucc28\ub144 \ubaa9\ud45c(\uc6d4 \ucde8\uae09 \uc57d 38\uc5b5\uc6d0, \uc2e0\uaddc \uc57d 190\uac74)\uae4c\uc9c0\uc758 \uc131\uc7a5\uc740 \uc544\ub798\uc640 \uac19\uc774 \uc778\ub825\u00b7\ucc44\ub110 \ud655\uc7a5\uc73c\ub85c \ub2ec\uc131 \uac00\ub2a5\ud55c \ubc94\uc704 \ub0b4\uc5d0 \uc788\uc2b5\ub2c8\ub2e4.')
gtm += table(
    ['\uad6c\ubd84','1\ucc28\ub144 \ub9d0','2\ucc28\ub144 \ub9d0','3\ucc28\ub144 \ub9d0'],
    [['\uc6d4 \ucde8\uae09\uc561(run-rate)','\uc57d 9.5\uc5b5\uc6d0','\uc57d 19\uc5b5\uc6d0','\uc57d 38\uc5b5\uc6d0'],
     ['\uc6d4 \uc2e0\uaddc \uacc4\uc57d(\ud3c9\uade0 2\ucc9c\ub9cc\uc6d0 \uae30\uc900)','\uc57d 48\uac74','\uc57d 95\uac74','\uc57d 190\uac74'],
     ['\uc601\uc5c5\u00b7\uc2ec\uc0ac\u00b7\uc815\uc0b0 \uc778\ub825','2~3\uba85','4~5\uba85','6~8\uba85']],
    [2800,2400,2400,2400])
gtm += callout('\uc65c 6%\uac00 \ubcf4\uc218\uc801\uc778\uac00',
    ['\ub300\ud45c\ub294 BLQ\uc5d0\uc11c \uc6d4\uac04 \ucd5c\ub300 40\uc5b5\uc6d0 \uaddc\ubaa8\uc758 \ucc44\uad8c\u00b7\uc815\uc0b0 \ud750\ub984\uc744 \uc2e4\uc81c\ub85c \uc6b4\uc601\ud55c \uc774\ub825\uc774 \uc788\uc2b5\ub2c8\ub2e4. \ud48d\ud604\uc758 3\ucc28\ub144 \ubaa9\ud45c \uc6d4 \ucde8\uae09\uc561(\uc57d 38\uc5b5\uc6d0)\uc740 \uc774 \uac80\uc99d\ub41c \ucc98\ub9ac \uc5ed\ub7c9\uc758 \ubc94\uc704 \uc548\uc5d0 \uc788\uc73c\uba70, \uc2dc\uc791 \uaddc\ubaa8 5\uc5b5\uc6d0\uc740 \uadf8 8\ubd84\uc758 1 \uc218\uc900\uc5d0 \ubd88\uacfc\ud569\ub2c8\ub2e4.',
     '\uc989 6% \uc131\uc7a5\uc740 \u2018\uc5c6\ub358 \uc5ed\ub7c9\uc744 \uc0c8\ub85c \ub9cc\ub4dc\ub294 \uac83\u2019\uc774 \uc544\ub2c8\ub77c \u2018\uc774\ubbf8 \ub2e4\ub904 \ubcf8 \uaddc\ubaa8\ub85c \ub418\ub3cc\uc544\uac00\ub294 \uac83\u2019\uc785\ub2c8\ub2e4. \uc131\uc7a5 \uacf1\uc120\uc758 \uc0c1\ub2e8\uc774 \ub300\ud45c\uc758 \uc2e4\uc99d \uacbd\ud5d8 \uc774\ub0b4\ub77c\ub294 \uc810\uc774 \uc774 \uacc4\ud68d\uc758 \ud604\uc2e4\uc131\uc744 \ub4b7\ubc1b\uce68\ub2c8\ub2e4.'])

# ---- 대손 subsection ----
loss = subheading('\ub300\uc190 \uac00\uc815 \ubc0f \uc190\uc2e4 \ud761\uc218\ub825')
loss += body('\uc790\uc0b0 \uae08\uc735\uc5d0\uc11c \uac00\uc7a5 \uc911\uc694\ud55c \uac83\uc740 \uc131\uc7a5\ub960\uc774 \uc544\ub2c8\ub77c \u2018\ub5bc\uc774\uc9c0 \uc54a\ub294 \uac83\u2019\uc785\ub2c8\ub2e4. \ud48d\ud604\uc758 \ud68c\uc218 \uad6c\uc870\ub294 3\ub2e8\uacc4\ub85c \uc190\uc2e4\uc744 \ubc29\uc5b4\ud558\uba70, \uc7ac\ubb34 \uc804\ub9dd\uc5d0\ub294 \uc544\ub798\uc758 \ubcf4\uc218\uc801 \ub300\uc190 \uac00\uc815\uc774 \ubc18\uc601\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4.')
loss += table(
    ['\ub2e8\uacc4','\uac00\uc815','\uadfc\uac70'],
    [['\u2460 \uc5f0\uccb4\uc728(gross)','\ucde8\uae09\uc561\uc758 \uc57d 5%','\uc790\uc0b0 \ubcf4\uc720\u00b7\uc0c1\ud658\ub825 \ud655\uc778 \uc0ac\uc5c5\uc790 \uc120\ubcc4\uc2ec\uc0ac \ubc18\uc601, \ub3d9\uc885 \ub2e8\uae30\uae08\uc735 \ub300\ube44 \ubcf4\uc218\uc801'],
     ['\u2461 \ub2f4\ubcf4 \ud68c\uc218\uc728','\uc6d0\uae08\uc758 \uc57d 90%','\uc2dc\uac00 \ub300\ube44 20% \ud560\uc778 \ub9e4\uc785\u00b7\uc18c\uc720\uad8c \ubcf4\uc720\ub85c \uc790\uc0b0 \ucc98\ubd84 \ud68c\uc218 + \uce74\ub4dc\ub9e4\ucd9c \ub4f1 \uc815\uc0b0 \ud1b5\uc81c \ubcd1\ud589'],
     ['\u2462 \uac74\ub2f9 \uc21c\uc190\uc2e4','\uc6d0\uae08\uc758 \uc57d 10%','\uc911\uace0 \ucc98\ubd84\uac00 \ubcc0\ub3d9\u00b7\ucc98\ubd84 \ube44\uc6a9\u00b7\uc18c\uc694 \uae30\uac04\uc744 \ubcf4\uc218\uc801\uc73c\ub85c \ubc18\uc601'],
     [('\ud3ec\ud2b8\ud3f4\ub9ac\uc624 \uc21c\ub300\uc190\uc728',True),('\ucde8\uae09\uc561\uc758 \uc57d 0.5%',True),('\u2460 \u00d7 \u2462 = 5% \u00d7 10%',True)]],
    [2600,2000,5400],
    aligns=['left','center','left'])
loss += callout('\uc190\uc2e4 \ud761\uc218\ub825 \u00b7 \uc2a4\ud2b8\ub808\uc2a4 \uc2dc\ub098\ub9ac\uc624',
    ['\uc21c\ub300\uc190\uc728 \uc57d 0.5%\ub294 \uc601\uc5c5\uc774\uc775\ub960(7.5~8.9%)\ub85c \ucda9\ubd84\ud788 \ud761\uc218 \uac00\ub2a5\ud55c \uc218\uc900\uc785\ub2c8\ub2e4. \ub300\uc190\uc744 \ubc18\uc601\ud55c \ub4a4\uc5d0\ub3c4 \uc0ac\uc5c5\uc740 \uc548\uc815\uc801\uc778 \ud751\uc790 \uad6c\uc870\ub97c \uc720\uc9c0\ud569\ub2c8\ub2e4.',
     '\uc2a4\ud2b8\ub808\uc2a4 \uc2dc\ub098\ub9ac\uc624\ub85c \uc5f0\uccb4\uc728\uc774 2\ubc30(10%)\ub85c \uc624\ub974\uace0 \uc911\uace0 \ucc98\ubd84 \uc2e4\ud604\uac00\uac00 30% \ucd94\uac00 \ud558\ub77d\ud558\ub354\ub77c\ub3c4, \uc21c\ub300\uc190\uc728\uc740 \uc57d 2% \uc218\uc900\uc5d0 \uba38\ubb3c\ub7ec \uc0ac\uc5c5\uc740 \ud751\uc790\ub97c \uc720\uc9c0\ud569\ub2c8\ub2e4. \u2018\uc2e4\ubb3c \uc790\uc0b0\uc744 \uc2dc\uac00\ubcf4\ub2e4 \uc2f8\uac8c, \uc18c\uc720\uad8c\uae4c\uc9c0 \ud655\ubcf4\u2019\ud558\ub294 \uad6c\uc870\uac00 \uc190\uc2e4\uc758 \ud558\ubc29\uc744 \uad6c\uc870\uc801\uc73c\ub85c \ub9c9\uc544 \uc8fc\uae30 \ub54c\ubb38\uc785\ub2c8\ub2e4.'])

# ---- Renumber existing chapters ----
x=x.replace('\u2168\uc7a5','\u2169\uc7a5')  # Ⅸ장 -> Ⅹ장 reference
for a,b in [('\u2168. \ud22c\uc790','\u2169. \ud22c\uc790'),
            ('\u2167. \uaddc\uc81c','\u2168. \uaddc\uc81c'),
            ('\u2166. \uc7ac\ubb34','\u2167. \uc7ac\ubb34'),
            ('\u2165. \uacbd\uc7c1','\u2166. \uacbd\uc7c1')]:
    assert a in x, 'MISSING renumber target: '+repr(a)
    x=x.replace(a,b)

# ---- Fix Ⅳ overclaim ----
old_claim='\uc790\uc0b0 \ud68c\uc218\u00b7\ub9e4\uac01\uc73c\ub85c \uc6d0\uae08 \uc774\uc0c1\uc744 \ud68c\uc218\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.'
new_claim='\uc790\uc0b0 \ud68c\uc218\u00b7\ub9e4\uac01\uacfc \uc815\uc0b0 \ud1b5\uc81c\ub85c \uc6d0\uae08\uc758 \ub300\ubd80\ubd84\uc744 \ud68c\uc218\ud558\ub3c4\ub85d \uc124\uacc4\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4(\uc0c1\uc138 \ub300\uc190 \uac00\uc815\uc740 \u2167\uc7a5 \ucc38\uc870).'
assert old_claim in x, 'MISSING overclaim string'
x=x.replace(old_claim, new_claim)

# ---- Insert GTM before 경쟁 heading ----
marker='\uacbd\uc7c1 \ud658\uacbd \ubc0f \ud6c4\ubc1c \uc804\ub7b5'
i=x.find(marker); assert i>0, 'MISSING 경쟁 heading'
ps=x.rfind('<w:p>',0,i); assert ps>0
x=x[:ps]+gtm+x[ps:]

# ---- Insert 대손 before 규제 heading ----
marker2='\uaddc\uc81c\u00b7\ubc95\uc801 \ub9ac\uc2a4\ud06c\uc640 \ub300\uc751'
i=x.find(marker2); assert i>0, 'MISSING 규제 heading'
ps=x.rfind('<w:p>',0,i); assert ps>0
x=x[:ps]+loss+x[ps:]

open(path,'w',encoding='utf-8').write(x)
print('OK edits applied. new length', len(x))
