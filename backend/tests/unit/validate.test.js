const { stripEmptyStrings, normaliseDates } = require('../../src/middleware/validate');

describe('stripEmptyStrings', () => {
  test('turns empty strings into undefined', () => {
    expect(stripEmptyStrings('')).toBeUndefined();
  });

  test('leaves other scalars untouched', () => {
    expect(stripEmptyStrings(0)).toBe(0);
    expect(stripEmptyStrings(false)).toBe(false);
    expect(stripEmptyStrings(null)).toBeNull();
    expect(stripEmptyStrings('Allemand')).toBe('Allemand');
  });

  test('cleans object values recursively', () => {
    expect(stripEmptyStrings({ teacherId: '', price: 100, nested: { levelCode: '' } }))
      .toEqual({ teacherId: undefined, price: 100, nested: { levelCode: undefined } });
  });

  test('cleans arrays element by element', () => {
    expect(stripEmptyStrings(['', 'A1'])).toEqual([undefined, 'A1']);
  });
});

describe('normaliseDates', () => {
  test('serialises a Date to YYYY-MM-DD so SQLite never stores [object Object]', () => {
    expect(normaliseDates(new Date('2020-01-01T00:00:00.000Z'))).toBe('2020-01-01');
  });

  test('converts dates nested in objects and arrays', () => {
    expect(normaliseDates({ dueDate: new Date('2026-03-04T00:00:00.000Z'), items: [{ date: new Date('2026-05-06T00:00:00.000Z') }] }))
      .toEqual({ dueDate: '2026-03-04', items: [{ date: '2026-05-06' }] });
  });

  test('leaves non-dates untouched', () => {
    expect(normaliseDates({ amount: 100, note: 'x', empty: null })).toEqual({ amount: 100, note: 'x', empty: null });
  });
});
