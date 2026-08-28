# -*- coding: utf-8 -*-
import re
p = r'C:\Users\sol hong\Downloads\ir_unpacked\word\document.xml'
x = open(p, encoding='utf-8').read()

# 1) Exec summary ③(저가매입→시가상응) + ⑤(매출 432→414)
old_exec = '③ 자산 저가매입·소유권 보유·정산 통제의 다층 안전구조를 갖춥니다.  ④ 소풍벤처스와의 합작으로 설립되어 초기부터 신뢰 기반을 확보합니다.  ⑤ 3년 내 연 취급 342억, 매출 432억 규모를 목표로 합니다.'
new_exec = '③ 시가 상응 매입·소유권 보유·잔존가치 회수의 다층 안전구조를 갖춥니다.  ④ 소풍벤처스와의 합작으로 설립되어 초기부터 신뢰 기반을 확보합니다.  ⑤ 3년 내 연 취급 342억, 매출 약 414억 규모를 목표로 합니다.'
assert old_exec in x, 'exec not found'
x = x.replace(old_exec, new_exec)

# 2) 대손표 '자산 저가매입 + 소유권 보유' → '시가 상응 매입 + 소유권 보유'
assert '자산 저가매입 + 소유권 보유' in x
x = x.replace('자산 저가매입 + 소유권 보유', '시가 상응 매입 + 소유권 보유')

# 3) 대손 흡수 문장 영업이익률 범위
assert '영업이익률(7.5~8.9%)' in x
x = x.replace('영업이익률(7.5~8.9%)', '영업이익률(5.5~7.0%)')

# 4) 재무 전망 표: 매출/영업이익/당기순이익/영업이익률 행을 모델 NEW로 교체 (표 구간 한정, 순서 기반)
j = x.find('연 취급총액')
end = x.find('※ 회계 기준 안내', j)
win = x[j:end]
# 표의 숫자/퍼센트 셀만 순서대로 수집
cells = list(re.finditer(r'(<w:t[^>]*>)(약 [0-9.]+|[0-9.]+%)(</w:t>)', win))
# 순서: 0-2 취급(84,170,342) | 3-5 매출 | 6-8 영업이익 | 9-11 순이익 | 12-14 영업이익률
newvals = {
 3:'약 102',4:'약 206',5:'약 414',      # 매출
 6:'약 6',7:'약 13',8:'약 29',          # 영업이익
 9:'약 5',10:'약 11',11:'약 23',        # 당기순이익
 12:'5.5%',13:'6.5%',14:'7.0%',         # 영업이익률
}
# 뒤에서부터 치환(인덱스 shift 방지)
for idx in sorted(newvals, reverse=True):
    m = cells[idx]
    win = win[:m.start()] + m.group(1) + newvals[idx] + m.group(3) + win[m.end():]
x = x[:j] + win + x[end:]

open(p, 'w', encoding='utf-8').write(x)
# 검증 출력
j = x.find('연 취급총액'); end = x.find('※ 회계 기준 안내', j)
print('table cells:', [m.group(2) for m in re.finditer(r'<w:t[^>]*>(약 [0-9.]+|[0-9.]+%)</w:t>', x[j:end])])
print('저가매입 remaining:', x.count('저가매입'))
print('매출 약 414 present:', '매출 약 414억' in x)
print('영업이익률(5.5~7.0%) present:', '영업이익률(5.5~7.0%)' in x)
