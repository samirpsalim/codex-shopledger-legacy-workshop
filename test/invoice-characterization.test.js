'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice matches order pricing for HSN slab GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var ledgerFigures = pricing.computeTotals(items, '');
  var order = {
    id: 1001,
    items: items,
    subtotal: ledgerFigures.subtotal,
    discount: ledgerFigures.discount,
    tax: ledgerFigures.tax,
    total: ledgerFigures.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: ledgerFigures.subtotal, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { subtotal: 200, tax: 10, total: 210 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: ledgerFigures.subtotal, tax: ledgerFigures.tax, total: ledgerFigures.total }
  );
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice matches order pricing for decimal gstRate', function () {
  var item = { name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 0.05 };
  var ledgerFigures = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: [item] });

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice matches order pricing for percent coupon discount and GST', function () {
  var items = [{ id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 1002,
    coupon: 'WELCOME',
    items: items,
    subtotal: ledgerFigures.subtotal,
    discount: ledgerFigures.discount,
    tax: ledgerFigures.tax,
    total: ledgerFigures.total
  };
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total }
  );
});

test('GST reconciliation reports matching in-memory HSN invoice figures', function () {
  var items = [{ id: 3, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var ledgerFigures = pricing.computeTotals(items, '');
  var db = {
    orders: [{
      id: 1003,
      date: '2026-11-21',
      items: items,
      subtotal: ledgerFigures.subtotal,
      discount: ledgerFigures.discount,
      tax: ledgerFigures.tax,
      total: ledgerFigures.total
    }],
    products: [],
    customers: []
  };

  var reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual(
    {
      ledgerTax: reconciliation.rows[0].ledgerTax,
      invoiceTax: reconciliation.rows[0].invoiceTax,
      ledgerTotal: reconciliation.rows[0].ledgerTotal,
      invoiceTotal: reconciliation.rows[0].invoiceTotal,
      delta: reconciliation.rows[0].delta
    },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0 }
  );
});
