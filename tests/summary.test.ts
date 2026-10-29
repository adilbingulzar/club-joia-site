import { describe, expect, it } from 'vitest';
import { birthday, EMPTY_BUYER, validate, type Buyer } from '@/components/Summary';

const BUYER: Buyer = {
  ...EMPTY_BUYER,
  firstName: 'Zoë', lastName: "O'Brien-Smith", email: 'Test@Example.com', repeatEmail: 'test@example.com',
  address: 'Mall Road 1', zipcode: '1012 LG', city: 'Amsterdam', country: 'NL', gender: 'female',
  day: '29', month: '2', year: '2000', phoneCode: 'NL', phone: '6 12-34 56 78', gateway: 'paynl', method: '10', terms: true
};
const METHODS = [{ id: '10', name: 'iDEAL', icon: '' }, { id: '706', name: 'Credit card', icon: '' }];

describe('validate', function () {
  it('accepts a complete form', function () {
    expect(validate(BUYER, METHODS)).toEqual({});
  });

  it('asks for every field of an empty form', function () {
    expect(Object.keys(validate(EMPTY_BUYER, []))).toEqual([
      'firstName', 'lastName', 'email', 'repeatEmail', 'address', 'zipcode', 'city',
      'country', 'gender', 'birthday', 'phone', 'gateway', 'terms'
    ]);
  });

  it.each([
    [{ firstName: 'R2D2' }, 'firstName', 'Please use letters only.'],
    [{ email: 'name@example', repeatEmail: 'name@example' }, 'email', 'Please enter a valid email address, like name@example.com.'],
    [{ repeatEmail: 'other@example.com' }, 'repeatEmail', 'The email addresses don’t match.'],
    [{ zipcode: '#1' }, 'zipcode', 'Please enter a valid zip code.'],
    [{ day: '31', month: '4' }, 'birthday', 'This date doesn’t exist. Please check the day and month.'],
    [{ month: '' }, 'birthday', 'Please select your full birthday.'],
    [{ phoneCode: '' }, 'phone', 'Please select your country code.'],
    [{ phone: '06-abc' }, 'phone', 'Please enter a valid phone number, digits only, without the country code.']
  ])('%o: %s', function (change, field, message) {
    expect(validate({ ...BUYER, ...change }, METHODS)).toEqual({ [field]: message });
  });

  it('asks how to pay once the gateway\'s methods are in', function () {
    expect(validate({ ...BUYER, method: '' }, METHODS)).toEqual({ method: 'Please choose how you want to pay.' });
    expect(validate({ ...BUYER, method: '138' }, METHODS)).toEqual({ method: 'Please choose how you want to pay.' });
    // still loading (or failed): the order goes with the suggested method
    expect(validate({ ...BUYER, method: '' }, [])).toEqual({});
  });
});

describe('birthday', function () {
  it('writes the date as yyyy-mm-dd', function () {
    expect(birthday({ ...BUYER, day: '5', month: '3', year: '1990' })).toBe('1990-03-05');
  });

  it('knows leap years', function () {
    expect(birthday({ ...BUYER, day: '29', month: '2', year: '2000' })).toBe('2000-02-29');
    expect(birthday({ ...BUYER, day: '29', month: '2', year: '2001' })).toBe('');
  });

  it('refuses a date in the future', function () {
    expect(birthday({ ...BUYER, day: '1', month: '1', year: String(new Date().getFullYear() + 1) })).toBe('');
  });
});
