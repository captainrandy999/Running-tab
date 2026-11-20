const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercise the actual money rendering code without a browser or test data changes.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function renderMoneyRecord(r,options={}){');
const end = html.indexOf('function moneyFormOpen(', start);
assert.ok(start >= 0 && end > start, 'Money renderer must be present');
const moneyRenderer = html.slice(start, end);

function render(records) {
  const elements = Object.fromEntries(['owedToMe', 'iOwe', 'people', 'personList'].map(id => [id, {
    textContent: '', innerHTML: ''
  }]));
  const safe = s => String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const caseKey = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
  const run = new Function('records', 'safe', 'caseKey', 'money', '$', 'document', 'window',
    moneyRenderer + '\nrender();');
  run(records, safe, caseKey, money, id => elements[id], { querySelectorAll: () => [] },
    { RunningTabView: { adjust() {} } });
  return elements;
}

const record = (id, cents, direction, settled = false) => ({
  id, person: 'Martec', direction, cents, reason: 'Genie', date: '2026-11-20', settled
});

test('unpriced outstanding debt is Price TBD, never Settled', () => {
  const result = render([record('one', null, 'i_owe')]);
  assert.match(result.personList.innerHTML, /Price TBD/);
  assert.doesNotMatch(result.personList.innerHTML, />Settled<\/div>/);
  assert.match(result.personList.innerHTML, /data-money-settled="one"/);
  assert.equal(result.iOwe.textContent, '$0.00');
});

test('checking a debt keeps it in history but excludes it from totals', () => {
  const result = render([record('one', 25000, 'i_owe', true)]);
  assert.equal(result.owedToMe.textContent, '$0.00');
  assert.equal(result.iOwe.textContent, '$0.00');
  assert.match(result.personList.innerHTML, /Settled/);
  assert.match(result.personList.innerHTML, /data-money-settled="one" checked/);
  assert.match(result.personList.innerHTML, /\$250\.00/);
});

test('only unchecked transactions contribute to outstanding balances', () => {
  const result = render([
    record('old', 4000, 'i_owe', true),
    record('open', 6000, 'to_me')
  ]);
  assert.equal(result.owedToMe.textContent, '$60.00');
  assert.equal(result.iOwe.textContent, '$0.00');
  assert.match(result.personList.innerHTML, /Owes you \$60\.00/);
  assert.match(result.personList.innerHTML, /1 settled/);
});

test('equal active debts show No balance, not a false payment confirmation', () => {
  const result = render([
    record('one', 10000, 'i_owe'),
    record('two', 10000, 'to_me')
  ]);
  assert.match(result.personList.innerHTML, /No balance/);
  assert.doesNotMatch(result.personList.innerHTML, /<div class="amount ">Settled<\/div>/);
});
