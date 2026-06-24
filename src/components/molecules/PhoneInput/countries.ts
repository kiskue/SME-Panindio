/**
 * Curated country list for the PhoneInput picker.
 *
 * Data: ISO 3166-1 alpha-2 code, dial code, emoji flag, country name.
 * Emoji flags are constructed from regional indicator symbols — no image assets required.
 * Philippines (+63) is listed first and is the default selection.
 */

export interface Country {
  code: string;       // ISO 3166-1 alpha-2, e.g. "PH"
  dialCode: string;   // E.164 prefix without '+', e.g. "63"
  flag: string;       // emoji flag, e.g. "🇵🇭"
  name: string;
}

/** Converts an ISO alpha-2 code to an emoji flag string. */
function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .split('')
    .map((ch) => String.fromCodePoint(0x1F1E6 - 65 + ch.charCodeAt(0)))
    .join('');
}

function c(code: string, dialCode: string, name: string): Country {
  return { code, dialCode, flag: flagEmoji(code), name };
}

/**
 * Full country list ordered: Philippines first, then alphabetically.
 * Sourced from ITU-T E.164 assignment list.
 */
export const COUNTRIES: Country[] = [
  // ── Default first ────────────────────────────────────────────────────────────
  c('PH', '63',   'Philippines'),
  // ── A ───────────────────────────────────────────────────────────────────────
  c('AF', '93',   'Afghanistan'),
  c('AL', '355',  'Albania'),
  c('DZ', '213',  'Algeria'),
  c('AD', '376',  'Andorra'),
  c('AO', '244',  'Angola'),
  c('AG', '1268', 'Antigua & Barbuda'),
  c('AR', '54',   'Argentina'),
  c('AM', '374',  'Armenia'),
  c('AU', '61',   'Australia'),
  c('AT', '43',   'Austria'),
  c('AZ', '994',  'Azerbaijan'),
  // ── B ───────────────────────────────────────────────────────────────────────
  c('BS', '1242', 'Bahamas'),
  c('BH', '973',  'Bahrain'),
  c('BD', '880',  'Bangladesh'),
  c('BB', '1246', 'Barbados'),
  c('BY', '375',  'Belarus'),
  c('BE', '32',   'Belgium'),
  c('BZ', '501',  'Belize'),
  c('BJ', '229',  'Benin'),
  c('BT', '975',  'Bhutan'),
  c('BO', '591',  'Bolivia'),
  c('BA', '387',  'Bosnia & Herzegovina'),
  c('BW', '267',  'Botswana'),
  c('BR', '55',   'Brazil'),
  c('BN', '673',  'Brunei'),
  c('BG', '359',  'Bulgaria'),
  c('BF', '226',  'Burkina Faso'),
  c('BI', '257',  'Burundi'),
  // ── C ───────────────────────────────────────────────────────────────────────
  c('CV', '238',  'Cabo Verde'),
  c('KH', '855',  'Cambodia'),
  c('CM', '237',  'Cameroon'),
  c('CA', '1',    'Canada'),
  c('CF', '236',  'Central African Republic'),
  c('TD', '235',  'Chad'),
  c('CL', '56',   'Chile'),
  c('CN', '86',   'China'),
  c('CO', '57',   'Colombia'),
  c('KM', '269',  'Comoros'),
  c('CG', '242',  'Congo'),
  c('CD', '243',  'Congo (DRC)'),
  c('CR', '506',  'Costa Rica'),
  c('HR', '385',  'Croatia'),
  c('CU', '53',   'Cuba'),
  c('CY', '357',  'Cyprus'),
  c('CZ', '420',  'Czech Republic'),
  // ── D ───────────────────────────────────────────────────────────────────────
  c('DK', '45',   'Denmark'),
  c('DJ', '253',  'Djibouti'),
  c('DM', '1767', 'Dominica'),
  c('DO', '1809', 'Dominican Republic'),
  // ── E ───────────────────────────────────────────────────────────────────────
  c('EC', '593',  'Ecuador'),
  c('EG', '20',   'Egypt'),
  c('SV', '503',  'El Salvador'),
  c('GQ', '240',  'Equatorial Guinea'),
  c('ER', '291',  'Eritrea'),
  c('EE', '372',  'Estonia'),
  c('SZ', '268',  'Eswatini'),
  c('ET', '251',  'Ethiopia'),
  // ── F ───────────────────────────────────────────────────────────────────────
  c('FJ', '679',  'Fiji'),
  c('FI', '358',  'Finland'),
  c('FR', '33',   'France'),
  // ── G ───────────────────────────────────────────────────────────────────────
  c('GA', '241',  'Gabon'),
  c('GM', '220',  'Gambia'),
  c('GE', '995',  'Georgia'),
  c('DE', '49',   'Germany'),
  c('GH', '233',  'Ghana'),
  c('GR', '30',   'Greece'),
  c('GD', '1473', 'Grenada'),
  c('GT', '502',  'Guatemala'),
  c('GN', '224',  'Guinea'),
  c('GW', '245',  'Guinea-Bissau'),
  c('GY', '592',  'Guyana'),
  // ── H ───────────────────────────────────────────────────────────────────────
  c('HT', '509',  'Haiti'),
  c('HN', '504',  'Honduras'),
  c('HU', '36',   'Hungary'),
  // ── I ───────────────────────────────────────────────────────────────────────
  c('IS', '354',  'Iceland'),
  c('IN', '91',   'India'),
  c('ID', '62',   'Indonesia'),
  c('IR', '98',   'Iran'),
  c('IQ', '964',  'Iraq'),
  c('IE', '353',  'Ireland'),
  c('IL', '972',  'Israel'),
  c('IT', '39',   'Italy'),
  // ── J ───────────────────────────────────────────────────────────────────────
  c('JM', '1876', 'Jamaica'),
  c('JP', '81',   'Japan'),
  c('JO', '962',  'Jordan'),
  // ── K ───────────────────────────────────────────────────────────────────────
  c('KZ', '7',    'Kazakhstan'),
  c('KE', '254',  'Kenya'),
  c('KI', '686',  'Kiribati'),
  c('KW', '965',  'Kuwait'),
  c('KG', '996',  'Kyrgyzstan'),
  // ── L ───────────────────────────────────────────────────────────────────────
  c('LA', '856',  'Laos'),
  c('LV', '371',  'Latvia'),
  c('LB', '961',  'Lebanon'),
  c('LS', '266',  'Lesotho'),
  c('LR', '231',  'Liberia'),
  c('LY', '218',  'Libya'),
  c('LI', '423',  'Liechtenstein'),
  c('LT', '370',  'Lithuania'),
  c('LU', '352',  'Luxembourg'),
  // ── M ───────────────────────────────────────────────────────────────────────
  c('MG', '261',  'Madagascar'),
  c('MW', '265',  'Malawi'),
  c('MY', '60',   'Malaysia'),
  c('MV', '960',  'Maldives'),
  c('ML', '223',  'Mali'),
  c('MT', '356',  'Malta'),
  c('MH', '692',  'Marshall Islands'),
  c('MR', '222',  'Mauritania'),
  c('MU', '230',  'Mauritius'),
  c('MX', '52',   'Mexico'),
  c('FM', '691',  'Micronesia'),
  c('MD', '373',  'Moldova'),
  c('MC', '377',  'Monaco'),
  c('MN', '976',  'Mongolia'),
  c('ME', '382',  'Montenegro'),
  c('MA', '212',  'Morocco'),
  c('MZ', '258',  'Mozambique'),
  c('MM', '95',   'Myanmar'),
  // ── N ───────────────────────────────────────────────────────────────────────
  c('NA', '264',  'Namibia'),
  c('NR', '674',  'Nauru'),
  c('NP', '977',  'Nepal'),
  c('NL', '31',   'Netherlands'),
  c('NZ', '64',   'New Zealand'),
  c('NI', '505',  'Nicaragua'),
  c('NE', '227',  'Niger'),
  c('NG', '234',  'Nigeria'),
  c('NO', '47',   'Norway'),
  // ── O ───────────────────────────────────────────────────────────────────────
  c('OM', '968',  'Oman'),
  // ── P ───────────────────────────────────────────────────────────────────────
  c('PK', '92',   'Pakistan'),
  c('PW', '680',  'Palau'),
  c('PA', '507',  'Panama'),
  c('PG', '675',  'Papua New Guinea'),
  c('PY', '595',  'Paraguay'),
  c('PE', '51',   'Peru'),
  c('PL', '48',   'Poland'),
  c('PT', '351',  'Portugal'),
  // ── Q ───────────────────────────────────────────────────────────────────────
  c('QA', '974',  'Qatar'),
  // ── R ───────────────────────────────────────────────────────────────────────
  c('RO', '40',   'Romania'),
  c('RU', '7',    'Russia'),
  c('RW', '250',  'Rwanda'),
  // ── S ───────────────────────────────────────────────────────────────────────
  c('KN', '1869', 'Saint Kitts & Nevis'),
  c('LC', '1758', 'Saint Lucia'),
  c('VC', '1784', 'Saint Vincent & Grenadines'),
  c('WS', '685',  'Samoa'),
  c('SM', '378',  'San Marino'),
  c('ST', '239',  'São Tomé & Príncipe'),
  c('SA', '966',  'Saudi Arabia'),
  c('SN', '221',  'Senegal'),
  c('RS', '381',  'Serbia'),
  c('SC', '248',  'Seychelles'),
  c('SL', '232',  'Sierra Leone'),
  c('SG', '65',   'Singapore'),
  c('SK', '421',  'Slovakia'),
  c('SI', '386',  'Slovenia'),
  c('SB', '677',  'Solomon Islands'),
  c('SO', '252',  'Somalia'),
  c('ZA', '27',   'South Africa'),
  c('SS', '211',  'South Sudan'),
  c('ES', '34',   'Spain'),
  c('LK', '94',   'Sri Lanka'),
  c('SD', '249',  'Sudan'),
  c('SR', '597',  'Suriname'),
  c('SE', '46',   'Sweden'),
  c('CH', '41',   'Switzerland'),
  c('SY', '963',  'Syria'),
  // ── T ───────────────────────────────────────────────────────────────────────
  c('TW', '886',  'Taiwan'),
  c('TJ', '992',  'Tajikistan'),
  c('TZ', '255',  'Tanzania'),
  c('TH', '66',   'Thailand'),
  c('TL', '670',  'Timor-Leste'),
  c('TG', '228',  'Togo'),
  c('TO', '676',  'Tonga'),
  c('TT', '1868', 'Trinidad & Tobago'),
  c('TN', '216',  'Tunisia'),
  c('TR', '90',   'Turkey'),
  c('TM', '993',  'Turkmenistan'),
  c('TV', '688',  'Tuvalu'),
  // ── U ───────────────────────────────────────────────────────────────────────
  c('UG', '256',  'Uganda'),
  c('UA', '380',  'Ukraine'),
  c('AE', '971',  'United Arab Emirates'),
  c('GB', '44',   'United Kingdom'),
  c('US', '1',    'United States'),
  c('UY', '598',  'Uruguay'),
  c('UZ', '998',  'Uzbekistan'),
  // ── V ───────────────────────────────────────────────────────────────────────
  c('VU', '678',  'Vanuatu'),
  c('VE', '58',   'Venezuela'),
  c('VN', '84',   'Vietnam'),
  // ── Y ───────────────────────────────────────────────────────────────────────
  c('YE', '967',  'Yemen'),
  // ── Z ───────────────────────────────────────────────────────────────────────
  c('ZM', '260',  'Zambia'),
  c('ZW', '263',  'Zimbabwe'),
];

/** The Philippines entry — used as the default country. */
export const DEFAULT_COUNTRY: Country = COUNTRIES[0]!;
