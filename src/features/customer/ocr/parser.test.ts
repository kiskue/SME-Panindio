/**
 * Unit tests for the pure PH ID parser.
 *
 * Run with: `npm test` (jest-expo). These tests have no React / native deps so
 * they execute in plain node. Fixtures approximate real ML Kit output (uppercase,
 * line-broken, with OCR noise).
 */

import { detectDocumentType, parseBirthDate, parseIdText } from './parser';

describe('parseBirthDate', () => {
  it('parses "01 JAN 1990" -> ISO', () => {
    expect(parseBirthDate('01 JAN 1990')).toBe('1990-01-01');
  });
  it('parses "JANUARY 05, 1988" -> ISO', () => {
    expect(parseBirthDate('JANUARY 05, 1988')).toBe('1988-01-05');
  });
  it('parses "1995/12/25" ISO-ish', () => {
    expect(parseBirthDate('1995/12/25')).toBe('1995-12-25');
  });
  it('parses "12/25/1995" MM/DD/YYYY', () => {
    expect(parseBirthDate('12/25/1995')).toBe('1995-12-25');
  });
  it('treats day>12 as DD/MM/YYYY', () => {
    expect(parseBirthDate('25/12/1995')).toBe('1995-12-25');
  });
  it('rejects implausible years', () => {
    expect(parseBirthDate('01 JAN 1850')).toBeNull();
  });
  it('returns null when no date present', () => {
    expect(parseBirthDate('no date here')).toBeNull();
  });
});

describe('detectDocumentType', () => {
  it('detects PhilSys by PCN', () => {
    expect(detectDocumentType('1234-5678-9012-3456').type).toBe('PHILSYS_ID');
  });
  it('detects Driver License by keyword', () => {
    expect(detectDocumentType('REPUBLIC OF THE PHILIPPINES DRIVERS LICENSE').type).toBe(
      'DRIVERS_LICENSE',
    );
  });
  it('detects SSS/UMID by CRN', () => {
    expect(detectDocumentType('CRN 1234-5678901-2').type).toBe('SSS_UMID');
  });
  it('detects passport by MRZ', () => {
    expect(detectDocumentType('P<PHLDELACRUZ<<JUAN').type).toBe('PASSPORT');
  });
  it('falls back to GENERIC_ID', () => {
    expect(detectDocumentType('some random text').type).toBe('GENERIC_ID');
  });
});

describe('parseIdText — PhilSys / PhilID', () => {
  const raw = [
    'REPUBLIKA NG PILIPINAS',
    'PHILIPPINE IDENTIFICATION CARD',
    'Last Name',
    'DELA CRUZ',
    'Given Names',
    'JUAN PABLO',
    'Middle Name',
    'SANTOS',
    'Date of Birth',
    '01 JANUARY 1990',
    'Sex',
    'MALE',
    'Address',
    '123 MABINI ST, BRGY 1, MANILA',
    '1234-5678-9012-3456',
  ].join('\n');

  const result = parseIdText(raw);

  it('detects PhilSys', () => {
    expect(result.documentType).toBe('PHILSYS_ID');
  });
  it('extracts PCN', () => {
    expect(result.idNumber?.value).toBe('1234-5678-9012-3456');
    expect(result.idNumber?.confidence).toBe('high');
  });
  it('extracts composed name', () => {
    expect(result.fullName?.value).toBe('DELA CRUZ, JUAN PABLO SANTOS');
  });
  it('extracts ISO birth date', () => {
    expect(result.birthDate?.value).toBe('1990-01-01');
  });
  it('extracts sex', () => {
    expect(result.sex?.value).toBe('MALE');
  });
  it('extracts address', () => {
    expect(result.address?.value).toContain('MABINI');
  });
});

describe('parseIdText — Driver License', () => {
  const raw = [
    'LAND TRANSPORTATION OFFICE',
    "DRIVER'S LICENSE",
    'Last Name, First Name, Middle Name',
    'REYES, MARIA LUISA GARCIA',
    'Nationality   Sex',
    'PHL   F',
    'Date of Birth',
    '05/15/1992',
    'License No.',
    'N01-23-456789',
    'Address',
    '45 RIZAL AVE, CEBU CITY',
  ].join('\n');

  const result = parseIdText(raw);

  it('detects Driver License', () => {
    expect(result.documentType).toBe('DRIVERS_LICENSE');
  });
  it('extracts license number', () => {
    expect(result.idNumber?.value).toBe('N01-23-456789');
  });
  it('extracts birth date', () => {
    expect(result.birthDate?.value).toBe('1992-05-15');
  });
  it('extracts sex as FEMALE', () => {
    expect(result.sex?.value).toBe('FEMALE');
  });
  it('extracts full name including surname (2-part value: LAST, GIVEN MIDDLE)', () => {
    expect(result.fullName?.value).toBe('REYES, MARIA LUISA GARCIA');
  });
});

describe('parseIdText — Driver License combined-label name (regression)', () => {
  // The modern LTO DL prints ONE combined label line followed by a single
  // comma-separated value (LAST, FIRST, MIDDLE). The surname must not be dropped.
  it('keeps the surname for a 3-part value (LAST, FIRST, MIDDLE)', () => {
    const raw = [
      'LAND TRANSPORTATION OFFICE',
      "DRIVER'S LICENSE",
      'Last Name, First Name, Middle Name',
      'DELA CRUZ, JUAN, SANTOS',
      'Nationality   Sex',
      'PHL   M',
      'Date of Birth',
      '01/15/1990',
      'License No.',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.documentType).toBe('DRIVERS_LICENSE');
    expect(result.fullName?.value).toBe('DELA CRUZ, JUAN SANTOS');
  });

  it('handles a 2-part value with no middle name (LAST, FIRST)', () => {
    const raw = [
      'LAND TRANSPORTATION OFFICE',
      "DRIVER'S LICENSE",
      'Last Name, First Name, Middle Name',
      'DELA CRUZ, JUAN',
      'License No.',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.fullName?.value).toBe('DELA CRUZ, JUAN');
  });

  it('tolerates OCR noise and extra spaces in the value line', () => {
    const raw = [
      "DRIVER'S LICENSE",
      'Last Name,  First Name,  Middle Name',
      'DELA CRUZ ,  JUAN  ,  SANTOS 1',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.fullName?.value).toBe('DELA CRUZ, JUAN SANTOS');
  });
});

describe('parseIdText — Driver License multi-column LTO layout', () => {
  // Modern LTO license: a row of column HEADER labels, then a row of VALUES,
  // with a (possibly multi-line) address sandwiched between sections.
  const raw = [
    'LAND TRANSPORTATION OFFICE',
    "DRIVER'S LICENSE",
    'Last Name, First Name, Middle Name',
    'DELA CRUZ, JUAN, SANTOS',
    'Nationality   Sex   Date of Birth   Weight (kg)   Height(m)',
    'PHL           M     1990/01/01      70            1.70',
    'Address',
    '123 MABINI STREET BARANGAY 654 MANILA CITY METRO MANILA 1000',
    'License No.   Expiration Date   Agency Code',
    'N01-23-456789  2025/01/01        A12',
  ].join('\n');

  const result = parseIdText(raw);

  it('detects Driver License', () => {
    expect(result.documentType).toBe('DRIVERS_LICENSE');
  });

  it('extracts the birth date from the mixed column-value row (high confidence)', () => {
    expect(result.birthDate?.value).toBe('1990-01-01');
    expect(result.birthDate?.confidence).toBe('high');
  });

  it('extracts the real street/city address', () => {
    expect(result.address?.value).toContain('MABINI');
    expect(result.address?.value).toContain('MANILA');
  });

  it('does NOT put the birth date into the address', () => {
    expect(result.address?.value).not.toBe('1990-01-01');
    expect(result.address?.value).not.toContain('1990');
  });

  it('keeps the surname in the full name (combined-header fix not regressed)', () => {
    expect(result.fullName?.value).toBe('DELA CRUZ, JUAN SANTOS');
  });

  it('extracts the license number (not consumed by the address)', () => {
    expect(result.idNumber?.value).toBe('N01-23-456789');
  });
});

describe('parseIdText — Driver License wrapped (multi-line) address', () => {
  const raw = [
    'LAND TRANSPORTATION OFFICE',
    "DRIVER'S LICENSE",
    'Last Name, First Name, Middle Name',
    'DELA CRUZ, JUAN, SANTOS',
    'Nationality   Sex   Date of Birth   Weight (kg)   Height(m)',
    'PHL           M     1990/01/01      70            1.70',
    'Address',
    '123 MABINI STREET BARANGAY 654',
    'MANILA CITY METRO MANILA 1000',
    'License No.   Expiration Date   Agency Code',
    'N01-23-456789  2025/01/01        A12',
  ].join('\n');

  const result = parseIdText(raw);

  it('joins both wrapped address lines', () => {
    expect(result.address?.value).toContain('MABINI');
    expect(result.address?.value).toContain('1000');
    expect(result.address?.value).toMatch(/MABINI.*MANILA/);
  });

  it('keeps the birth date correct and out of the address', () => {
    expect(result.birthDate?.value).toBe('1990-01-01');
    expect(result.address?.value).not.toContain('1990');
  });
});

describe('parseIdText — address never swallows the License No. header (OCR variants)', () => {
  // The license-number column header appears in many OCR variants. None of them
  // may be appended to the address. Each fixture has the address line followed
  // immediately by a license-header line + the value row.
  const variants: Array<[string, string]> = [
    ['License No.', 'License No.   Expiration Date   Agency Code'],
    ['License No (no period)', 'License No   Expiration Date   Agency Code'],
    ['UPPER LICENSE NO.', 'LICENSE NO.   EXPIRATION DATE   AGENCY CODE'],
    ['Lic. No.', 'Lic. No.   Expiration Date   Agency Code'],
    ['Lic No', 'Lic No   Expiration Date   Agency Code'],
    ['DL No.', 'DL No.   Expiration Date   Agency Code'],
    ['License Number', 'License Number   Expiration Date   Agency Code'],
    ['OCR N0. (zero)', 'License N0.   Expiration Date   Agency Code'],
  ];

  it.each(variants)('stops before the "%s" header line', (_label, headerLine) => {
    const raw = [
      'LAND TRANSPORTATION OFFICE',
      "DRIVER'S LICENSE",
      'Last Name, First Name, Middle Name',
      'DELA CRUZ, JUAN, SANTOS',
      'Address',
      '123 MABINI STREET BARANGAY 654 MANILA CITY 1000',
      headerLine,
      'N01-23-456789  2025/01/01  A12',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.address?.value).toContain('MABINI');
    expect(result.address?.value).toContain('MANILA');
    // The license header / number / other column labels must NOT leak in.
    expect(result.address?.value).not.toMatch(/LICEN[CS]E/i);
    expect(result.address?.value).not.toMatch(/\bNO\.?\b/i);
    expect(result.address?.value).not.toContain('N01-23-456789');
    expect(result.address?.value).not.toMatch(/EXPIRATION/i);
    expect(result.address?.value).not.toMatch(/AGENCY/i);
    // The real license number is still extracted into its own field.
    expect(result.idNumber?.value).toBe('N01-23-456789');
  });

  it('stops when the license label is a SEPARATE line directly under the address', () => {
    const raw = [
      "DRIVER'S LICENSE",
      'Address',
      '123 MABINI STREET BARANGAY 654 MANILA CITY 1000',
      'License No.',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.address?.value).toBe('123 MABINI STREET BARANGAY 654 MANILA CITY 1000');
    expect(result.address?.value).not.toMatch(/LICEN[CS]E/i);
    expect(result.address?.value).not.toContain('N01-23-456789');
  });

  it('salvages the address when OCR MERGES the license header onto the address line', () => {
    const raw = [
      "DRIVER'S LICENSE",
      'Address',
      '123 MABINI STREET MANILA CITY 1000 License No. N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.address?.value).toContain('MABINI');
    expect(result.address?.value).toContain('MANILA');
    expect(result.address?.value).not.toMatch(/LICEN[CS]E/i);
    expect(result.address?.value).not.toContain('N01-23-456789');
  });
});

describe('parseIdText — address cross-contamination guard', () => {
  it('does not capture a date row sitting where an address would be', () => {
    const raw = [
      'LAND TRANSPORTATION OFFICE',
      "DRIVER'S LICENSE",
      'Address',
      '1990/01/01',
      'License No.',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.address).toBeUndefined();
    // The date is still recovered as the (best-effort) birth date.
    expect(result.birthDate?.value).toBe('1990-01-01');
  });

  it('does not capture the Nationality/Sex/Weight/Height value row as the address', () => {
    const raw = [
      "DRIVER'S LICENSE",
      'Address',
      'PHL   M   70   1.70',
      'License No.',
      'N01-23-456789',
    ].join('\n');

    const result = parseIdText(raw);

    expect(result.address).toBeUndefined();
  });
});

describe('parseIdText — Passport MRZ', () => {
  const raw = [
    'REPUBLIC OF THE PHILIPPINES PASSPORT',
    'P<PHLDELACRUZ<<JUAN<PABLO<<<<<<<<<<<<<<<<<<<',
    'P123456789PHL9001011M3001017<<<<<<<<<<<<<<00',
  ].join('\n');

  const result = parseIdText(raw);

  it('detects Passport', () => {
    expect(result.documentType).toBe('PASSPORT');
  });
  it('extracts surname, given from MRZ', () => {
    expect(result.fullName?.value).toBe('DELACRUZ, JUAN PABLO');
  });
  it('extracts passport number', () => {
    expect(result.idNumber?.value).toBe('P12345678');
  });
  it('extracts DOB from MRZ', () => {
    expect(result.birthDate?.value).toBe('1990-01-01');
  });
  it('extracts sex from MRZ', () => {
    expect(result.sex?.value).toBe('MALE');
  });
});

describe('parseIdText — graceful partial', () => {
  it('returns GENERIC_ID with no fields for garbage', () => {
    const result = parseIdText('blurry photo unreadable');
    expect(result.documentType).toBe('GENERIC_ID');
    expect(result.idNumber).toBeUndefined();
    expect(result.fullName).toBeUndefined();
  });
});
