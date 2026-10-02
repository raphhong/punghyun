import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource, customer, movement } from './cashflow-loader.mjs';
const {todayISO,buildSchedule,nextDue}=loadSource('src/lib/admin/payments.ts');
const {koreaToday,projectCashflow}=loadSource('src/lib/admin/cashflow.ts');
test('Korea midnight is the same business day for server, browser, schedule and actual cash',()=>{
 const OriginalDate=globalThis.Date;
 const originalTZ=process.env.TZ;
 try {
  for(const timezone of ['UTC','America/Los_Angeles','Asia/Seoul']) {
   process.env.TZ=timezone;
   assert.equal(todayISO(new OriginalDate('2025-02-28T14:59:59Z')),'2025-02-28');
   assert.equal(todayISO(new OriginalDate('2025-02-28T15:00:00Z')),'2025-03-01');
   globalThis.Date=class extends OriginalDate { constructor(...args) { super(...(args.length?args:['2025-02-28T15:30:00Z'])); } };
   assert.equal(todayISO(),'2025-03-01'); assert.equal(koreaToday(),todayISO());
   const c=customer({first_payment_date:'2025-03-01',rental_months:1,rental_price:1000,paid_count:0});
   const receipt=movement({kind:'rental_receipt',basis:'actual',cash_date:'2025-03-01',installment_no:1,amount:1000});
   assert.equal(buildSchedule({...c,rental_receipts:[receipt]})[0].paid,true);
   assert.equal(nextDue({...c,rental_receipts:[receipt]}),null);
   assert.equal(projectCashflow([c],[],[receipt],'2025-03').totals.rentalActual.value,1000);
   globalThis.Date=OriginalDate;
  }
 } finally { globalThis.Date=OriginalDate;if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ; }
});
