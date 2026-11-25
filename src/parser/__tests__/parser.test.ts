import { categorizeMerchant, normalizeSender, parseAmount, parseSms } from '..';

describe('SMS parser utilities', () => {
  test.each([
    ['AD-HDFCBK', 'ADHDFCBK'],
    ['VM-SBIINB', 'VMSBIINB'],
    [' ICICIB ', 'ICICIB'],
  ])('normalizes sender %s', (input, expected) => {
    expect(normalizeSender(input)).toBe(expected);
  });

  test.each([
    ['₹1,234.50', 1234.5],
    ['INR 900', 900],
    ['Rs. 12,000.00', 12000],
    ['Rs 49.5', 49.5],
  ])('parses amount %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  test.each([
    ['Zomato order', 'Food'],
    ['UBER TRIP', 'Travel'],
    ['AMAZON PAY', 'Shopping'],
    ['random merchant', 'Other'],
  ])('categorizes %s', (merchant, expected) => {
    expect(categorizeMerchant(merchant)).toBe(expected);
  });
});

describe('Indian bank and UPI SMS parser', () => {
  test.each([
    ['Your A/c XX1234 is debited by Rs.250.00 at Zomato. UPI Ref No 123456789012. Avl Bal Rs.4,500.00', 'debit', 250, 'Zomato'],
    ['INR 1,299.00 debited from A/C XX9876 to AMAZON on 08/11/2026. UPI Ref 9876543210', 'debit', 1299, 'AMAZON'],
    ['Rs 499 debited via UPI to SWIGGY, Ref No: 111122223333', 'debit', 499, 'SWIGGY'],
    ['₹75.50 paid to UBER. Transaction ID ABC123456789', 'debit', 75.5, 'UBER'],
    ['HDFCBK: Your account is debited for Rs.2,000.00 towards NEFT to RENT. A/c XX1111', 'debit', 2000, 'RENT'],
    ['SBIINB: Rs 850.00 debited from your account for UPI payment to IRCTC', 'debit', 850, 'IRCTC'],
    ['ICICIB UPI transaction of INR 3,450 debited to CROMA. Ref 123456789', 'debit', 3450, 'CROMA'],
    ['AXISBK: A/c XX2222 debited INR 99.00 for payment at NETFLIX', 'debit', 99, 'NETFLIX'],
    ['KOTAK: Rs. 1,500 debited via UPI to BIGBASKET', 'debit', 1500, 'BIGBASKET'],
    ['YESBK account debited by ₹60 at CAFE COFFEE DAY', 'debit', 60, 'CAFE COFFEE DAY'],
    ['PNB: Your account is debited for Rs 7,000 towards rent payment to LANDLORD', 'debit', 7000, 'LANDLORD'],
    ['UPI payment of Rs. 1,234.56 sent to PHONEPE merchant', 'debit', 1234.56, 'PHONEPE merchant'],
    ['You have paid INR 45 to METRO using UPI', 'debit', 45, 'METRO'],
    ['Payment successful: ₹999 paid via Google Pay to SPOTIFY', 'debit', 999, 'SPOTIFY'],
    ['Rs. 200 credited to your account from REFUND AMAZON. UPI Ref 444455556666', 'credit', 200, 'REFUND AMAZON'],
    ['INR 500 credited as cashback from PAYTM', 'credit', 500, 'PAYTM'],
    ['Your account is credited with ₹1,000.00 by UPI collect from FRIEND', 'credit', 1000, 'FRIEND'],
    ['Refunded Rs 349.00 by SWIGGY, transaction ref 777788889999', 'credit', 349, 'SWIGGY'],
    ['UPI reversal: Rs. 75 credited for failed payment', 'credit', 75, 'Unknown merchant'],
    ['₹2,500 received from SALARY via UPI. Ref 123123123123', 'credit', 2500, 'SALARY'],
    ['HDFC Bank: INR 89.99 reversed and credited to your account', 'credit', 89.99, 'Unknown merchant'],
    ['Your UPI collect request for Rs 1,200 from FRIEND was credited', 'credit', 1200, 'FRIEND'],
  ])('parses %s', (body, type, amount, merchant) => {
    const result = parseSms(body, { sender: 'AD-HDFCBK', receivedAt: 1794144000000 });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ type, amount });
    expect(result?.merchant).toContain(merchant);
  });

  test.each([
    'Your OTP is 123456. Do not share it.',
    'Congratulations! You won a cashback offer. Claim now.',
    'Personal loan pre-approved. Apply today.',
    'Your available balance is INR 5,000.00',
    'Payment request has been cancelled for Rs 200',
  ])('ignores non-transaction message: %s', (body) => {
    expect(parseSms(body)).toBeNull();
  });

  test('returns a timestamp from the SMS date', () => {
    const result = parseSms('Rs 100 debited to CAFE on 08/11/2026 14:32');
    expect(result?.timestamp).toBe(new Date(2026, 10, 8, 14, 32).getTime());
  });
});
