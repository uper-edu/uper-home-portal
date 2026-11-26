import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCurrency,formatCurrencyNumber} from '../src/utils/currency';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {budgetPresentation} from '../src/utils/crmLeadPresentation';
import {CrmPaymentProjectDetail} from '../src/components/crm/CrmPaymentProjectDetail';

test('money uses one locale policy for grouping, decimal precision and currency spacing',()=>{
  for(const language of ['zh','en']){
    assert.equal(formatCurrency(2000000,language),'Rp 2,000,000');
    assert.equal(formatCurrency(1234.56789,language),'Rp 1,234.56789');
    assert.equal(formatCurrency(-1234.5,language),'Rp -1,234.5');
  }
  assert.equal(formatCurrency(2000000,'id'),'Rp 2.000.000');
  assert.equal(formatCurrency(1234.56789,'id'),'Rp 1.234,56789');
  assert.equal(formatCurrency(0,'id'),'Rp 0');
  assert.equal(formatCurrency(-0,'id'),'Rp 0');
  assert.equal(formatCurrencyNumber(2000000,'en'),'2,000,000');
  assert.equal(formatCurrency(12.34,'en','USD'),'USD 12.34');
  assert.equal(formatCurrency(12.34,'id','CNY'),'CNY 12,34');
});

test('unknown amounts and raw text never become zero or parsed currency',()=>{
  for(const input of [null,undefined,'2000000','Rp 2.000.000',NaN,Infinity,-Infinity]){
    assert.equal(formatCurrency(input as number,'zh'),'—');
  }
});

test('customer budget and enrollment receivable use the same language format without changing records',()=>{
  const project={id:'p',course:'Sample course',expected:2000000,createdAt:'2026-11-01T10:00:00Z',createdBy:'sales'};
  const ledger={projects:[project],entries:[],history:[]};
  const before=JSON.stringify(ledger);
  for(const [lang,expected] of [['zh','Rp 2,000,000'],['en','Rp 2,000,000'],['id','Rp 2.000.000']]){
    assert.equal(budgetPresentation({budgetAmount:2000000},lang)?.value,expected);
    const html=renderToStaticMarkup(React.createElement(CrmPaymentProjectDetail,{project,ledger,leadId:'sample',lang,onChoose(){}}));
    assert.ok(html.includes(expected));
  }
  assert.equal(JSON.stringify(ledger),before);
});
