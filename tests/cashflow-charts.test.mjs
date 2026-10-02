import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource, customer, profile } from './cashflow-loader.mjs';
const {cashflowPeriod}=loadSource('src/lib/admin/cashflow-period.ts');
const {cashflowSourceFailure}=loadSource('src/lib/admin/cashflow-source.ts');
const {projectCashflow}=loadSource('src/lib/admin/cashflow.ts');
const {CashflowCharts}=loadSource('src/components/admin/CashflowCharts.tsx');
test('3 6 12 periods cross years without losing months',()=>{for(const n of [3,6,12]){const p=cashflowPeriod('2026-02',String(n));assert.equal(p.months.length,n);assert.equal(p.end,'2026-02')}});
test('custom range validation and bounded size',()=>{assert.equal(cashflowPeriod('2026-02','custom','2025-11','2026-02').months.length,4);assert.ok(cashflowPeriod('2026-02','custom','2026-03','2026-01').warning);assert.ok(cashflowPeriod('2026-02','custom','2000-01','2026-01').warning);assert.equal(cashflowPeriod('1900-01','12').months[0],'1900-01')});
test('diagnostics do not disclose unrecognized raw codes',()=>{assert.ok(!cashflowSourceFailure('cashflow_profiles',{code:'secret-123'}).includes('secret-123'))});
test('chart separates basis, keeps range on month links and gaps unknown net',()=>{
 const months=['2026-01','2026-02','2026-03'].map(month=>({month,...projectCashflow([customer()],[profile()],[],month,'2026-10-02')}));
 const html=renderToStaticMarkup(React.createElement(CashflowCharts,{months,selectedMonth:'2026-02',basis:'actual',basePath:'/cashflow'}));
 assert.match(html,/실제 현금 이동일 기준/);assert.match(html,/3개월 중 3개월/);assert.match(html,/month=2026-01&amp;basis=actual&amp;range=custom/);assert.ok(!html.includes('<circle'));assert.match(html,/전월 대비/);
});
test('complete actual net connects points; an unknown middle month breaks the line',()=>{
 const keys=['rentalPlan','rentalActual','creditorPlan','creditorActual','fundingPlan','fundingActual','inflowPlan','inflowActual'];
 const months=['2026-01','2026-02','2026-03'].map((month,i)=>({month,totals:Object.fromEntries(keys.map(k=>[k,{value:100,known:1,missing:0}])),plannedNet:{value:999999999,known:1,missing:0},actualNet:{value:i*1000,known:1,missing:0}}));
 const render=()=>renderToStaticMarkup(React.createElement(CashflowCharts,{months,selectedMonth:'2026-02',basis:'actual',basePath:'/cashflow'}));
 assert.equal((render().match(/<circle/g)??[]).length,3);
 assert.equal((render().match(/stroke-width="2.5"/g)??[]).length,2);
 months[1].actualNet.missing=1;
 assert.equal((render().match(/<circle/g)??[]).length,2);
 assert.equal((render().match(/stroke-width="2.5"/g)??[]).length,0);
});
