import { calculateLineItem, calculateQuotation, formatMMK, type LineItem } from './engine';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  ${e}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
  };
}

console.log('\n=== calculateLineItem ===\n');

test('basic line item', () => {
  const item: LineItem = { quantity: 2, unitPrice: 1000 };
  expect(calculateLineItem(item)).toBe(2000);
});

test('with discount', () => {
  const item: LineItem = { quantity: 2, unitPrice: 1000, discountPercentage: 10 };
  expect(calculateLineItem(item)).toBe(1800);
});

test('zero quantity', () => {
  const item: LineItem = { quantity: 0, unitPrice: 1000 };
  expect(calculateLineItem(item)).toBe(0);
});

test('zero price', () => {
  const item: LineItem = { quantity: 5, unitPrice: 0 };
  expect(calculateLineItem(item)).toBe(0);
});

console.log('\n=== calculateQuotation ===\n');

test('basic quotation', () => {
  const items: LineItem[] = [
    { quantity: 1, unitPrice: 1000 },
    { quantity: 2, unitPrice: 500 },
  ];
  const result = calculateQuotation(items, 0, 0);
  expect(result.subtotal).toBe(2000);
  expect(result.total).toBe(2000);
});

test('with discount', () => {
  const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
  const result = calculateQuotation(items, 10, 0);
  expect(result.discountAmount).toBe(100);
  expect(result.total).toBe(900);
});

test('with tax', () => {
  const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
  const result = calculateQuotation(items, 0, 10);
  expect(result.taxAmount).toBe(100);
  expect(result.total).toBe(1100);
});

test('with discount and tax', () => {
  const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
  const result = calculateQuotation(items, 20, 10);
  expect(result.subtotal).toBe(1000);
  expect(result.discountAmount).toBe(200);
  expect(result.taxAmount).toBe(80);
  expect(result.total).toBe(880);
});

test('zero items', () => {
  const items: LineItem[] = [];
  const result = calculateQuotation(items, 10, 10);
  expect(result.total).toBe(0);
});

test('large numbers (millions)', () => {
  const items: LineItem[] = [{ quantity: 100, unitPrice: 15000000 }];
  const result = calculateQuotation(items, 5, 5);
  expect(result.subtotal).toBe(1500000000);
  expect(result.discountAmount).toBe(75000000);
  expect(result.taxAmount).toBe(71250000);
});

console.log('\n=== formatMMK ===\n');

test('formats basic amount', () => {
  expect(formatMMK(1500000)).toBe('1,500,000 MMK');
});

test('formats zero', () => {
  expect(formatMMK(0)).toBe('0 MMK');
});

test('formats small amount', () => {
  expect(formatMMK(100)).toBe('100 MMK');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);