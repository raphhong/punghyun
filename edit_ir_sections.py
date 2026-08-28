# -*- coding: utf-8 -*-
# Ⅴ 시장기회 / Ⅵ 성장 / Ⅶ 경쟁 전반 재작성
import re
path = r'C:\Users\sol hong\Downloads\ir_unpacked\word\document.xml'
x = open(path, encoding='utf-8').read()

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def run(text, bold=False, color=None, sz=None):
    rpr=''
    if bold: rpr+='<w:b/><w:bCs/>'
    if color: rpr+='<w:color w:val="%s"/>'%color
    if sz: rpr+='<w:sz w:val="%d"/><w:szCs w:val="%d"/>'%(sz,sz)
    rpr='<w:rPr>%s</w:rPr>'%rpr if rpr else ''
    return '<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>'%(rpr, esc(text))

def subheading(text):
    return ('<w:p><w:pPr><w:keepNext/><w:spacing w:after="90" w:before="180"/></w:pPr>'
            '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="14243B"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t></w:r></w:p>'%esc(text))

def body(runs):
    if isinstance(runs,str): runs=[(runs,False)]
    r=''.join(run(t,b) for (t,b) in runs)
    return '<w:p><w:pPr><w:spacing w:after="130" w:line="300"/></w:pPr>%s</w:p>'%r

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

# ---------- boundary helpers ----------
def para_span(anchor):
    i=x.find(anchor); assert i>0, 'missing '+anchor
    s=x.rfind('<w:p>',0,i); assert s>=0
    e=x.find('</w:p>',i)+len('</w:p>')
    return s,e

def para_start(anchor):
    i=x.find(anchor); assert i>0, 'missing '+anchor
    s=x.rfind('<w:p>',0,i); assert s>=0
    return s

def para_end(anchor):
    i=x.find(anchor); assert i>0, 'missing '+anchor
    return x.find('</w:p>',i)+len('</w:p>')

# ============================================================
# NEW CONTENT
# ============================================================

# ---- Ⅴ 시장 기회: intro + 시장규모 table + footnote ----
V_intro = body('국내 자영업자·소상공인은 약 700만 사업자 규모이며, 이들의 금융권 대출 잔액은 2025년 사상 처음 1,000조원을 넘어섰습니다(연체액 약 20조원). 고금리·대출 규제로 제도권 자금줄이 좁아지는 가운데, 카드·거래처 정산 주기(통상 2일~수주)와 실제 지출 사이의 시차는 상시적인 단기 자금 공백을 만듭니다. 국내 카드 결제 승인액이 분기 300조원대(연 1,300조원 이상)에 이르는 만큼, 이 시차에서 발생하는 단기 운영자금 수요의 총량은 대단히 큽니다.')
V_sub = subheading('시장 규모 (추정)')
V_table = table(
    ['구분','규모(추정)','산출 근거'],
    [['TAM · 사업자 금융 시장','1,000조원+','국내 자영업자 대출 잔액(2025년 역대 최대, 연체 약 20조원) — 제도권 사업자 자금 수요의 총량'],
     ['SAM · 카드매출 기반 단기자금','100조원+','연 카드승인액 약 1,300조원의 정산 시차·단기 운영자금 수요(대출 잔액의 약 10% 보수적 추정)'],
     [('SOM · 풍현 3년 목표 취급',True),('342억원',True),('SAM의 약 0.03% — 시장의 극히 일부 확보로 목표 달성',True)]],
    [3000,2000,5000],
    aligns=['left','center','left'])
V_note = body([('※ 위 규모는 자영업자 대출 잔액·카드 승인액 등 공개 통계에 기반한 추정이며, 정밀 시장 조사로 구체화 예정입니다. 핵심은 절대 규모가 아니라 — 풍현의 3년 목표가 시장의 0.03% 수준이라는 점, 즉 시장은 이미 충분히 크다는 사실입니다.', False)])
V_new = V_intro + V_sub + V_table + V_note

v_start = para_end('Ⅴ. 시장 기회')          # after heading para
v_end   = para_start('왜 지금인가')           # before 왜 지금인가 subheading
repl_V = (v_start, v_end, V_new)

# ---- Ⅵ intro para ----
VI_intro_new = body('풍현의 성장은 없던 수요를 새로 만드는 일이 아니라, 이미 존재하는 거대한 수요의 극히 일부를 안전하게 확보하는 일입니다. 성장의 현실성은 세 가지에서 나옵니다 — ① 이미 가동 가능한 고객 채널, ② 대표의 검증된 처리 역량, ③ 시장 대비 극도로 낮은 목표 침투율. 아래는 그 도달 경로입니다.')
s,e = para_span('6% 월 성장은 막연한 목표가 아니라')
repl_VIintro = (s, e, VI_intro_new)

# ---- Ⅵ 성장 브리지 블록 → 규모 달성의 현실성 ----
VI_sub = subheading('규모 달성의 현실성')
VI_body = body('평균 계약 규모를 약 2,000만원으로 가정하면, 시작 월 취급 5억원은 월 신규 약 25건, 3차년 목표(월 취급 약 38억원)는 월 약 190건에 해당합니다. 700만 사업자 시장에서 극히 일부만 확보하면 되는 수준이며, 성장은 인력·채널의 점진적 확장만으로 달성 가능한 범위 안에 있습니다.')
VI_table = table(
    ['구분','1차년 말','2차년 말','3차년 말'],
    [['월 취급액(run-rate)','약 9.5억원','약 19억원','약 38억원'],
     ['월 신규 계약(평균 2천만원)','약 48건','약 95건','약 190건'],
     ['영업·심사·정산 인력','2~3명','4~5명','6~8명']],
    [2800,2400,2400,2400])
VI_callout = callout('왜 이 규모가 현실적인가',
    ['대표는 BLQ에서 월간 최대 40억원 규모의 채권·정산 흐름을 실제로 운영한 이력이 있습니다. 풍현의 3차년 목표 월 취급액(약 38억원)은 이 검증된 처리 역량의 범위 안에 있으며, 시작 규모 5억원은 그 8분의 1 수준에 불과합니다.',
     '규모 관점에서도 3년 누적 목표 취급 342억원은 100조원대 사업자 단기자금 시장의 약 0.03%에 지나지 않습니다. 즉 이 계획은 ‘없던 역량을 새로 만드는 것’도 ‘시장을 새로 여는 것’도 아니라, ‘이미 다뤄 본 규모로, 이미 존재하는 거대한 시장의 일부를 안전하게 확보하는 것’입니다.'])
VI_new = VI_sub + VI_body + VI_table + VI_callout

c_start = para_start('성장 브리지 — 월 6%의 분해')
c_end   = para_start('경쟁 환경 및 후발 전략')
repl_VIbridge = (c_start, c_end, VI_new)

# ---- Ⅶ intro para ----
VII_intro_new = body('동종 구조의 선행 사업자(종합 금융 렌탈 플랫폼)가 이미 시장에 존재합니다. 그러나 앞서 보았듯 사업자 단기자금 시장은 100조원대에 이르며, 선행 사업자 전체를 합해도 아직 그 극히 일부만을 커버하고 있습니다. 이 시장의 경쟁은 한정된 파이를 빼앗는 제로섬이 아니라, 대부분 미개척 상태로 남은 수요를 누가 더 안전하게 확보하느냐의 문제입니다. 풍현은 규모 경쟁이 아니라 운영 역량과 안전성으로 차별화합니다.')
s,e = para_span('동종 구조의 선행 사업자')
repl_VIIintro = (s, e, VII_intro_new)

# ---- Ⅶ 승부수 블록 → 재작성 + 파이 충분 callout ----
VII_sub = subheading('후발주자의 승부수')
VII_body = body('시장이 충분히 크기 때문에, 후발주자라도 나눠 가질 파이는 넉넉합니다. 선행 사업자가 규모를 빠르게 키우는 동안, 풍현은 건전한 채권만 선별하여 부실을 낮추고 검증된 회수 엔진으로 안정적 수익을 확보하는 전략을 취합니다. 자산 금융에서 규모보다 중요한 것은 ‘떼이지 않는 것’이며, 이는 대표의 검증된 역량이 가장 크게 작용하는 지점입니다.')
VII_callout = callout('경쟁이 치열해도 파이는 충분하다',
    ['사업자 단기자금 시장(100조원대)에서 풍현의 3년 목표는 0.03% 수준입니다. 선행·후발 사업자가 여럿 존재해도 각자가 확보해야 할 몫은 시장 전체의 소수점 이하 — 경쟁은 파이를 빼앗는 싸움이 아니라, 아직 제도권이 채우지 못한 거대한 공백을 함께 개척하는 국면입니다.',
     '따라서 풍현의 과제는 ‘점유율 다툼’이 아니라 ‘떼이지 않고 안전하게 확보하는 실행력’입니다. 경쟁 심화는 오히려 수요의 실재와 시장의 검증을 방증하며, 안전성으로 차별화한 후발주자에게는 위협이 아니라 기회입니다.'])
VII_new = VII_sub + VII_body + VII_callout

s_start = para_start('후발주자의 승부수')
s_end   = para_start('Ⅷ. 재무 전망')
repl_VIIsub = (s_start, s_end, VII_new)

# ---------- apply from last to first ----------
repls = [repl_V, repl_VIintro, repl_VIbridge, repl_VIIintro, repl_VIIsub]
repls.sort(key=lambda r: r[0], reverse=True)
for (s,e,new) in repls:
    x = x[:s] + new + x[e:]

open(path,'w',encoding='utf-8').write(x)
print('OK sections rewritten. new length', len(x))
print('저가매입 remaining:', x.count('저가매입'))
print('6% remaining:', x.count('6%'), '| 6% 월 성장:', x.count('6% 월 성장'), '| 월 6%의 분해:', x.count('월 6%의 분해'))
print('0.03% present:', x.count('0.03%'), '| 1,000조 present:', x.count('1,000조'))
