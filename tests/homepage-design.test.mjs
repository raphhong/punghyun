import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { loadSource } from './cashflow-loader.mjs';

const html = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('approved homepage explains the asset structure without removed explanations or decorative labels', () => {
  const { default: Home } = loadSource('src/app/page.tsx');
  const rendered = html(Home);
  for (const label of ['장비는 계속 쓰고,', '운영자금은 새롭게.', '세일앤렌탈백 구조', '자산 매각', '매입대금 지급', '잔금 완납 후 소유권 취득', '참고용 예상 금액']) assert.ok(rendered.includes(label), label);
  for (const removed of ['※ 안전계수', '계산 기준 자세히 보기', 'SALE &amp; RENTAL BACK', 'ph-timeline-number']) assert.ok(!rendered.includes(removed), removed);
  assert.match(rendered, /href="#calculator"/);
  assert.match(rendered, /id="calculator"/);
  assert.match(rendered, /href="\/contact"/);
});

test('hiding homepage calculation copy preserves the standalone calculator default and pressed states', () => {
  const { Calculator } = loadSource('src/components/Calculator.tsx');
  assert.ok(html(Calculator).includes('※ 안전계수'));
  assert.ok(!html(Calculator, { showDisclaimer: false }).includes('※ 안전계수'));
  assert.equal((html(Calculator).match(/aria-pressed="false"/g) || []).length, 9);
});
