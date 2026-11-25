import { findRegisteredBank, normalizeSenderHeader } from '../banks';

describe('bank sender registry', () => {
  test.each([
    ['AD-HDFCBK', 'HDFCBK'],
    ['VM-SBIINB', 'SBIINB'],
    ['JD-ICICIT-S', 'ICICIT'],
  ])('normalizes %s', (sender, expected) => {
    expect(normalizeSenderHeader(sender)).toBe(expected);
  });

  test('matches a registered bank without making unknown headers invalid', () => {
    expect(findRegisteredBank('AD-HDFCBK')?.bank).toBe('HDFC Bank');
    expect(findRegisteredBank('AD-NEWBANK')).toBeNull();
  });
});
