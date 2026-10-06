import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import fs from 'node:fs';
import { loadSource } from './cashflow-loader.mjs';

const html = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('approved homepage explains the asset structure without removed explanations or decorative labels', () => {
  const { default: Home } = loadSource('src/app/page.tsx');
  const rendered = html(Home);
  for (const label of ['장비는 계속 쓰고,', '운영자금은 새롭게.', '자산 매각과 렌탈의 흐름', '자산 매각', '매입대금 지급', '잔금 완납 후 소유권 취득', '참고용 예상 금액']) assert.ok(rendered.includes(label), label);
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


test('homepage visual overrides are layered after utilities so calculator amounts remain readable', () => {
  const css = fs.readFileSync('design-system/marketing.css', 'utf8');
  assert.match(css, /@layer theme, base, components, utilities, ph-marketing;/);
  assert.match(css, /@layer ph-marketing \{/);
  assert.match(css, /\.ph-home-calculator \.ph-calculator-result \{[^}]*background:#f0f4f8/);
});


test('calculator tells visitors which input is missing and does not imply values transfer to contact form', () => {
  for (const [states, expected] of [
    [[0, 0], '두 항목을 입력해주세요'],
    [[60000000, 0], '자산 금액을 선택해주세요'],
    [[0, 75000000], '카드매출을 입력해주세요'],
  ]) {
    let cursor = 0;
    const { Calculator } = loadSource('src/components/Calculator.tsx', { react: { ...React, useState: () => [states[cursor++], () => {}] } });
    assert.ok(html(Calculator, { showDisclaimer: false }).includes(expected));
  }
  let cursor = 0;
  const { Calculator } = loadSource('src/components/Calculator.tsx', { react: { ...React, useState: () => [[60000000, 75000000][cursor++], () => {}] } });
  const rendered = html(Calculator, { showDisclaimer: false });
  assert.ok(!rendered.includes('이 조건으로'));
  assert.ok(rendered.includes('상담 신청하기'));
  assert.ok(rendered.includes('3,240만원'));
  assert.ok(rendered.includes('3,960만원'));
});
