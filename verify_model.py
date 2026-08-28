# -*- coding: utf-8 -*-
# 모델 수식을 파이썬으로 재현해 OLD(80% 할인) vs NEW(시가 매입) 연간 요약 비교
def run(E17):
    E11,E12,E13,E14,E15,E16,E18=500,0.06,3,0.05,1.225,0.8,1.0
    E19,E20,E25,E26=0.075,0.025,0.003,0.005
    E27,E28,E29,E30=13,0.10,5,0.20
    M = E16*E15 + (1-E16)*(E14*E13 + E18/E17)
    yr={1:{},2:{},3:{}}
    for k in yr: yr[k]={'매출':0,'매입':0,'유동화':0,'대손':0,'지급':0,'총이익':0,'인건':0,'고정':0,'영익':0,'법세':0,'순익':0}
    for m in range(36):
        D=E11*(1+E12)**m
        rev1=D*M; svc=D*E25; sales=rev1+svc
        buy=D; sec=rev1*E19; bad=D*E20; pay=D*E26
        cogs=buy+sec+bad+pay
        gp=sales-cogs
        labor=E27*(1+E28)**(m//12); fix=E29
        opex=labor+fix
        oi=gp-opex
        tax=max(0,oi)*E30
        ni=oi-tax
        y=1 if m<12 else (2 if m<24 else 3)
        yr[y]['매출']+=sales; yr[y]['매입']+=buy; yr[y]['유동화']+=sec
        yr[y]['대손']+=bad; yr[y]['지급']+=pay; yr[y]['총이익']+=gp
        yr[y]['인건']+=labor; yr[y]['고정']+=fix; yr[y]['영익']+=oi
        yr[y]['법세']+=tax; yr[y]['순익']+=ni
    return M,yr

for label,E17 in [('OLD 매입원가율 80% (할인)',0.8),('NEW 매입원가율 100% (시가)',1.0)]:
    M,yr=run(E17)
    print('\n===== %s | 매출배수 M=%.4f =====' % (label,M))
    print('%-8s %10s %10s %10s'%('항목','Y1','Y2','Y3'))
    for key in ['매출','총이익','영익','순익']:
        print('%-8s %10.0f %10.0f %10.0f'%(key,yr[1][key],yr[2][key],yr[3][key]))
    for y in (1,2,3):
        oim=yr[y]['영익']/yr[y]['매출'] if yr[y]['매출'] else 0
        print('  Y%d 영업이익률 %.1f%%'%(y,oim*100))
