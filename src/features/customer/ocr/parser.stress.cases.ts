/**
 * Parser stress corpus — AUTO-GENERATED from the multi-agent stress-test workflow.
 * 82 realistic OCR samples across all 6 PH ID document types. Do not hand-edit;
 * regenerate from the workflow output. Six over-strict expectations were dropped
 * (per adversarial verification) so only high-confidence assertions remain.
 */
export interface StressSample {
  docType: string;
  id: string;
  focus: string;
  rawText: string;
  expected: {
    documentType?: string; fullName?: string; birthDate?: string;
    idNumber?: string; address?: string; sex?: string;
  };
}

export const STRESS_SAMPLES: StressSample[] = [
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-01-clean-combined-male",
    "focus": "Clean modern 2021+ LTO read: combined name header + value, multi-column Nationality/Sex/DOB/Weight/Height row, Address block, License No. header row. Regression lock.",
    "rawText": "Republic of the Philippines\nLAND TRANSPORTATION OFFICE\nDRIVER'S LICENSE\nLast Name, First Name, Middle Name\nDELA CRUZ, JUAN, SANTOS\nNationality Sex Date of Birth Weight(kg) Height(m)\nPHL M 1990/01/01 70 1.70\nAddress\n123 MABINI STREET BARANGAY 654 MANILA CITY 1000\nLicense No. Expiration Date Agency Code\nN01-23-456789 2031/01/01 A12",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-01-01",
      "idNumber": "N01-23-456789",
      "address": "123 MABINI STREET BARANGAY 654 MANILA CITY 1000",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-02-ocr-noise-O-in-date",
    "focus": "OCR character noise: 0/O, 1/l/I, doubled spaces, stray punctuation. Critically the DOB month is OCR'd 1990/O3/15 (letter O for zero). Tests digit-class brittleness of date regexes.",
    "rawText": "Repub1ic of the Phi1ippines\nLANO TRANSPORTATION OFFICE\nDRIVER'S L1CENSE\nLast  Name,  First Name,  Middle Name\nDE LA CRUZ,  JOSE  MARI,  SAN  JOSE\nNationality  Sex  Date of Birth  Weight(kg)  Height(m)\nPHL   M   1990/O3/15   68   1.72\nAddress\n45  E. RODRIGUEZ SR. AVE.,  BRGY.  20  MANILA  1008\nLicense No.  Expiration Date  Agency Code\nN02-45-678901   2031/03/15   C05",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "DE LA CRUZ, JOSE MARI SAN JOSE",
      "birthDate": "1990-03-15",
      "idNumber": "N02-45-678901",
      "address": "45 E. RODRIGUEZ SR. AVE., BRGY. 20 MANILA 1008",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-03-suffix-hyphen-twoword-name",
    "focus": "Hyphenated surname (REYES-GARCIA), two-word given (JUAN PABLO), two-word middle (DELA CRUZ) and a JR suffix in the combined value. Documents how parser folds suffix into given+middle (no separate suffix handling). Regression lock.",
    "rawText": "LAND TRANSPORTATION OFFICE\nPROFESSIONAL DRIVER'S LICENSE\nLast Name, First Name, Middle Name\nREYES-GARCIA, JUAN PABLO, DELA CRUZ, JR\nNationality Sex Date of Birth Weight(kg) Height(m)\nPHL M 1985/11/30 80 1.75\nAddress\n9 SAMPAGUITA ST SUBDIVISION GREENHILLS SAN JUAN CITY 1502\nLicense No. Expiration Date Agency Code\nN09-01-234567 2031/11/30 D01",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "REYES-GARCIA, JUAN PABLO DELA CRUZ JR",
      "birthDate": "1985-11-30",
      "idNumber": "N09-01-234567",
      "address": "9 SAMPAGUITA ST SUBDIVISION GREENHILLS SAN JUAN CITY 1502",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-04-tagalog-inline-labels",
    "focus": "Older/bilingual variant with Tagalog inline 'Label: value' fields (Apelyido/Pangalan/Gitnang Apelyido/Kasarian/Petsa ng Kapanganakan/Tirahan) and a Tagalog license label 'Lisensya Blg:'. Exercises extractLabelledName + Tagalog label coverage gaps.",
    "rawText": "LAND TRANSPORTATION OFFICE\nPROPESYONAL NA LISENSYA SA PAGMAMANEHO\nApelyido: DELA PENA\nPangalan: ANTONIO\nGitnang Apelyido: VILLANUEVA\nKasarian: M\nPetsa ng Kapanganakan: 03/14/1979\nTirahan: 12 MABUHAY ST BRGY 7 LIPA CITY BATANGAS 4217\nLisensya Blg: N04-56-789012",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "DELA PENA, ANTONIO VILLANUEVA",
      "birthDate": "1979-03-14",
      "idNumber": "N04-56-789012",
      "address": "12 MABUHAY ST BRGY 7 LIPA CITY BATANGAS 4217",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-05-older-stacked-below-labels",
    "focus": "Older variant: separate labels each on their own line with the value on the NEXT line (valueBelowLabel path), plus a month-first text DOB 'JANUARY 05, 1992'. Regression lock for the separate-label fallback.",
    "rawText": "LAND TRANSPORTATION OFFICE\nNON-PROFESSIONAL DRIVERS LICENSE\nSurname\nTORRES\nFirst Name\nRAFAEL MIGUEL\nMiddle Name\nAQUINO\nSex\nM\nDate of Birth\nJANUARY 05, 1992\nAddress\n3 LUNA ST POBLACION ILOILO CITY 5000\nLicense No.\nN06-78-901234",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "TORRES, RAFAEL MIGUEL AQUINO",
      "birthDate": "1992-01-05",
      "idNumber": "N06-78-901234",
      "address": "3 LUNA ST POBLACION ILOILO CITY 5000",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-06-degraded-partial-shortaddress",
    "focus": "Degraded capture: only name + a short single-token address line ('77 ACACIA ST') + license no survive; DOB/sex absent. Tests partial extraction and the strict >=2-word address gate.",
    "rawText": "DRIVER'S LICENSE\nLast Name, First Name, Middle Name\nCRUZ, PEDRO,\nAddress\n77 ACACIA ST\nLicense No.\nN08-90-123456",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "CRUZ, PEDRO",
      "idNumber": "N08-90-123456",
      "address": "77 ACACIA ST"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-07-female-normal-order",
    "focus": "Female card in standard top-to-bottom order: the 'Height(m)' column header appears BEFORE the 'PHL F' value row. Probes parseSex whole-text scan picking up the lone 'm' in 'Height(m)'.",
    "rawText": "Republic of the Philippines\nDepartment of Transportation\nLAND TRANSPORTATION OFFICE\nNON-PROFESSIONAL DRIVER'S LICENSE\nLast Name, First Name, Middle Name\nSANTOS, MARIA CLARA, REYES\nNationality Sex Date of Birth Weight(kg) Height(m)\nPHL F 1995/07/22 52 1.58\nAddress\n27 KATIPUNAN ROAD BARANGAY 9 QUEZON CITY 1100\nLicense No. Expiration Date Agency Code\nN07-89-012345 2031/07/22 B23",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "SANTOS, MARIA CLARA REYES",
      "birthDate": "1995-07-22",
      "idNumber": "N07-89-012345",
      "address": "27 KATIPUNAN ROAD BARANGAY 9 QUEZON CITY 1100",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-08-wrapped-merged-address-female",
    "focus": "Female card with a wrapped two-line address whose SECOND line has the next 'License No.' column header merged onto it (tail-noise salvage path) + the Height(m)-before-value sex ordering.",
    "rawText": "LAND TRANSPORTATION OFFICE\nDRIVER'S LICENSE\nLast Name, First Name, Middle Name\nGONZALES, ANNA MARIE, BAUTISTA\nNationality Sex Date of Birth Weight(kg) Height(m)\nPHL F 1993/04/18 50 1.55\nAddress\nUNIT 4B TOWER 1 EASTWOOD CITY\nLIBIS QUEZON CITY 1110 License No.\nN10-12-345678 2031/04/18 E07",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "GONZALES, ANNA MARIE BAUTISTA",
      "birthDate": "1993-04-18",
      "idNumber": "N10-12-345678",
      "address": "UNIT 4B TOWER 1 EASTWOOD CITY, LIBIS QUEZON CITY 1110",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-09-hard-merged-label-value",
    "focus": "ADVERSARIAL: OCR merges each label header onto its own value row (name label+value on one line; DOB column header+value row on one line; future expiry 2031 printed before DOB). Stresses combined-header next-line assumption and the date-fallback single-exec bounds.",
    "rawText": "DRIVER'S LICENSE\nRepublic of the Philippines\nLicense No. N03-12-345678 Expiration Date 2031/05/20 Agency Code A01\nLast Name, First Name, Middle Name DELA CRUZ, JUAN, SANTOS\nNationality Sex Date of Birth Weight Height PHL M 1990/08/15 65 1.68\nAddress 14 RIZAL ST BRGY 5 CEBU CITY 6000",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-08-15",
      "idNumber": "N03-12-345678",
      "address": "14 RIZAL ST BRGY 5 CEBU CITY 6000",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "dl-10-hard-reordered-blocks",
    "focus": "ADVERSARIAL: blocks reordered so VALUE rows print ABOVE their headers (name value above the combined header; 'PHL F' value row above the Nationality/Sex header). Stresses directionality of extractCombinedHeaderName. (Sex/DOB happen to survive via fallbacks.)",
    "rawText": "DELA CRUZ, MARIA, REYES\nLast Name, First Name, Middle Name\nPHL F 1988/12/03 55 1.60\nNationality Sex Date of Birth Weight(kg) Height(m)\nLAND TRANSPORTATION OFFICE\nN05-67-890123\nLicense No. Expiration Date Agency Code\nTirahan\n88 BONIFACIO AVE BRGY 12 DAVAO CITY 8000",
    "expected": {
      "documentType": "DRIVERS_LICENSE",
      "fullName": "DELA CRUZ, MARIA REYES",
      "birthDate": "1988-12-03",
      "idNumber": "N05-67-890123",
      "address": "88 BONIFACIO AVE BRGY 12 DAVAO CITY 8000",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "pp-01-passport-mrz-pair",
    "focus": "Cross-type: DFA passport with a realistic TD3 MRZ pair (P< prefix, << name separators, < padding, check-digit-ish fillers). Validates the dedicated MRZ extractor. Regression lock.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT\nP<PHLDELA<CRUZ<<JUAN<SANTOS<<<<<<<<<<<<<<<<<<<\nP123456789PHL9001011M3001012<<<<<<<<<<<06",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-01-01",
      "idNumber": "P12345678",
      "sex": "MALE"
    }
  },
  {
    "docType": "DRIVERS_LICENSE",
    "id": "gen-01-no-anchor-barangay-clearance",
    "focus": "Cross-type GENERIC_ID with no strong document anchor (barangay clearance). Has a labelled NAME and ADDRESS but only a non-birth 'DATE ISSUED'. Probes the ungated DOB fallback.",
    "rawText": "PROVINCE OF CEBU\nBARANGAY CLEARANCE\nNAME: ROBERTO SANTOS CRUZ\nADDRESS: 5 MANGO AVE CEBU CITY\nDATE ISSUED: 06/01/2026",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "ROBERTO SANTOS CRUZ",
      "address": "5 MANGO AVE CEBU CITY"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-01-clean-english",
    "focus": "Clean read, English single-language stacked labels (value on line BELOW), month-name DOB. Happy-path regression lock.",
    "rawText": "Republic of the Philippines\nPhilippine Identification Card\nPCN\n1234-5678-9012-3456\nLast Name\nDELA CRUZ\nGiven Names\nJUAN\nMiddle Name\nSANTOS\nDate of Birth\nJANUARY 01, 1990\nSex\nMALE\nAddress\n123 MABINI STREET BARANGAY 654 MANILA CITY 1000",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-01-01",
      "idNumber": "1234-5678-9012-3456",
      "address": "123 MABINI STREET BARANGAY 654 MANILA CITY 1000",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-02-bilingual-slash-labels",
    "focus": "REALISTIC PhilID: bilingual 'Apelyido/Last Name', 'Mga Pangalan/Given Names', 'Gitnang Apelyido/Middle Name', 'Tirahan/Address' single-line labels with value BELOW. Surfaces the core slash-label bug in name + address.",
    "rawText": "Republika ng Pilipinas\nPambansang Pagkakakilanlan\nPhilSys Card Number/Numero ng PhilSys\n1234-5678-9012-3456\nApelyido/Last Name\nDELA CRUZ\nMga Pangalan/Given Names\nJUAN MIGUEL\nGitnang Apelyido/Middle Name\nSANTOS\nPetsa ng Kapanganakan/Date of Birth\nAUGUST 15, 1991\nKasarian/Sex\nMALE\nTirahan/Address\n456 RIZAL AVENUE BARANGAY 12 CEBU CITY 6000",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUAN MIGUEL SANTOS",
      "birthDate": "1991-08-15",
      "idNumber": "1234-5678-9012-3456",
      "address": "456 RIZAL AVENUE BARANGAY 12 CEBU CITY 6000",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-03-tagalog-only",
    "focus": "Tagalog-only single-language stacked labels (Apelyido / Mga Pangalan / Gitnang Apelyido / Petsa ng Kapanganakan / Kasarian / Tirahan), MM/DD/YYYY numeric DOB, FEMALE. Tagalog-label regression lock.",
    "rawText": "Republika ng Pilipinas\nPambansang Pagkakakilanlan\n1234-5678-9012-3456\nApelyido\nDELA CRUZ\nMga Pangalan\nJUANA\nGitnang Apelyido\nSANTOS\nPetsa ng Kapanganakan\n01/30/1995\nKasarian\nFEMALE\nTirahan\n99 BONIFACIO ST, BRGY 3, DAVAO CITY 8000",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUANA SANTOS",
      "birthDate": "1995-01-30",
      "idNumber": "1234-5678-9012-3456",
      "address": "99 BONIFACIO ST, BRGY 3, DAVAO CITY 8000",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-04-inline-labels",
    "focus": "Adversarial 'label-on-same-line-as-value' with explicit ': ' delimiters (PCN also inline). Parser HANDLES this via valueAfterLabel; regression lock.",
    "rawText": "PhilSys Card Number 1234-5678-9012-3456\nLast Name: DELA CRUZ\nGiven Names: JUAN MIGUEL\nMiddle Name: SANTOS\nDate of Birth: 01/15/1992\nSex: MALE\nAddress: 123 MABINI ST BARANGAY 5 MANILA 1000",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUAN MIGUEL SANTOS",
      "birthDate": "1992-01-15",
      "idNumber": "1234-5678-9012-3456",
      "address": "123 MABINI ST BARANGAY 5 MANILA 1000",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-05-ocr-char-noise",
    "focus": "OCR character noise: 0->O & 1->l confusions inside name/date/address, doubled spaces, stray punctuation. address expected is parser-FAITHFUL (free-text not OCR-corrected); name & date OCR confusions are the bugs. No PCN so idNumber omitted; detection via 'PhilSys' keyword (medium).",
    "rawText": "Republic of the Philippines\nPhilSys\nLast Name\nDELA CRUZ\nGiven Names\nJUAN\nMiddle Name\nSANT0S\nDate of Birth\nJAN O1, 199O\nSex\nM\nAddress\nl23  RIZAL  ST,  BRGY.  5  MANILA  11OO",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-01-01",
      "address": "l23 RIZAL ST, BRGY. 5 MANILA 11OO",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-06-pcn-ocr-noise",
    "focus": "OCR noise localized to the PCN itself (O instead of 0 in 3rd group). Every other field is clean. Isolates the PCN-regex digit-only failure.",
    "rawText": "Republic of the Philippines\nPhilippine Identification Card\nPCN 1234-5678-9O12-3456\nLast Name\nRAMOS\nGiven Names\nPEDRO\nMiddle Name\nGARCIA\nDate of Birth\nFEBRUARY 28, 1975\nSex\nMALE\nAddress\n77 LUNA ST SAMPALOC MANILA 1008",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "RAMOS, PEDRO GARCIA",
      "birthDate": "1975-02-28",
      "idNumber": "1234-5678-9012-3456",
      "address": "77 LUNA ST SAMPALOC MANILA 1008",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-07-partial-degraded",
    "focus": "Degraded capture: only Last/Given recovered (no PCN, no DOB/sex/address). Detection via 'PHILIPPINE IDENTIFICATION' keyword (medium). Partial-field regression lock.",
    "rawText": "PHILIPPINE IDENTIFICATION CARD\nLast Name\nREYES\nGiven Names\nMARIA",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "REYES, MARIA"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-08-multiline-wrapped-address",
    "focus": "Multi-line / wrapped address (3 physical lines) joined with ', ', plus month-name DOB and FEMALE. Tagalog header, English field labels. Multi-line address regression lock.",
    "rawText": "Pambansang Pagkakakilanlan\n1234-5678-9012-3456\nLast Name\nGONZALES\nGiven Names\nANA MARIE\nMiddle Name\nREYES\nDate of Birth\nMARCH 03, 1988\nSex\nFEMALE\nAddress\nBLK 7 LOT 12 PHASE 2\nGREENWOODS SUBDIVISION\nSAN MATEO RIZAL 1850",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "GONZALES, ANA MARIE REYES",
      "birthDate": "1988-03-03",
      "idNumber": "1234-5678-9012-3456",
      "address": "BLK 7 LOT 12 PHASE 2, GREENWOODS SUBDIVISION, SAN MATEO RIZAL 1850",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-09-suffix-hyphenated-twoword",
    "focus": "Hyphenated/two-word surname (SANTOS-CRUZ), two-word given (MARIA ISABEL), and a 'Suffix' label (III). Parser has NO suffix support, so III is dropped by design — expected fullName intentionally omits the suffix. Locks hyphen/two-word handling.",
    "rawText": "Republic of the Philippines\nPhilSys\n1234-5678-9012-3456\nLast Name\nSANTOS-CRUZ\nGiven Names\nMARIA ISABEL\nMiddle Name\nREYES\nSuffix\nIII\nDate of Birth\n1990/12/25\nSex\nFEMALE\nAddress\n10 ACACIA ST PROJECT 6 QUEZON CITY 1100",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "SANTOS-CRUZ, MARIA ISABEL REYES",
      "birthDate": "1990-12-25",
      "idNumber": "1234-5678-9012-3456",
      "address": "10 ACACIA ST PROJECT 6 QUEZON CITY 1100",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-10-reordered-blocks",
    "focus": "HARD adversarial: blocks reordered so each VALUE prints on the line ABOVE its label. valueBelowLabel reads downward only, so labels capture the NEXT value, shifting the whole name by one slot (and the true surname above the first label is never read).",
    "rawText": "PhilSys Card Number\n1234-5678-9012-3456\nDELA CRUZ\nLast Name\nJUAN MIGUEL\nGiven Names\nSANTOS\nMiddle Name",
    "expected": {
      "documentType": "PHILSYS_ID",
      "fullName": "DELA CRUZ, JUAN MIGUEL SANTOS",
      "idNumber": "1234-5678-9012-3456"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "philsys-11-merged-lines",
    "focus": "HARD adversarial: ML Kit merges multiple fields onto single lines with NO delimiters (spaced PCN). Name is intentionally NOT extracted (parser requires a delimiter or a standalone label line) and is omitted from expected; idNumber/DOB(low via fallback)/sex/address still recover. Robustness lock.",
    "rawText": "Republic of the Philippines PhilSys\nPCN 1234 5678 9012 3456 Last Name DELA CRUZ\nGiven Names JUAN Middle Name SANTOS\nDate of Birth 01/15/1992 Sex MALE\nAddress 88 MABINI ST MANILA 1000",
    "expected": {
      "documentType": "PHILSYS_ID",
      "birthDate": "1992-01-15",
      "idNumber": "1234-5678-9012-3456",
      "address": "88 MABINI ST MANILA 1000",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "passport-12-mrz-clean",
    "focus": "PASSPORT TD3 MRZ pair: P< country code, surname<<given with < padding, line2 with passport no + check-digit filler, DOB at offset 13-18, sex at offset 20. Fully MRZ-driven. Regression lock.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT\nP<PHLDELA<CRUZ<<JUAN<MIGUEL<<<<<<<<<<<<<<<<<<\nP1234567<4PHL9001018M3012315<<<<<<<<<<<<06",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "DELA CRUZ, JUAN MIGUEL",
      "birthDate": "1990-01-01",
      "idNumber": "P1234567",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "passport-13-mrz-pk-variant",
    "focus": "PASSPORT MRZ with OCR turning '<' into 'K' on line1 (P[<K] tolerance), single given name, 9-char alnum passport no (EB1234567), FEMALE, check-digit filler. Regression lock.",
    "rawText": "REPUBLIKA NG PILIPINAS\nREPUBLIC OF THE PHILIPPINES\nPASSPORT\nPKPHLREYES<<MARIA<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nEB12345678PHL8505152F3101015<<<<<<<<<<<<<04",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "REYES, MARIA",
      "birthDate": "1985-05-15",
      "idNumber": "EB1234567",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILSYS_ID",
    "id": "generic-14-no-anchor",
    "focus": "GENERIC_ID with NO strong anchor (postal ID, no recognized number format, no doc keyword). Single 'Name:' label (returned cleaned, NOT reformatted to LAST, GIVEN) and an inline 'Address:'. Generic fallback lock.",
    "rawText": "PHILIPPINE POSTAL CORPORATION\nPOSTAL ID\nName: MARIA CLARA REYES\nAddress: 45 BONIFACIO AVE QUEZON CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "MARIA CLARA REYES",
      "address": "45 BONIFACIO AVE QUEZON CITY"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-01-clean-inline",
    "focus": "Clean read, English inline labels with colon delimiters, CRN present; baseline regression lock.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nSOCIAL SECURITY SYSTEM\nUMID\nCRN 0212-3456789-0\nSURNAME: DELA CRUZ\nGIVEN NAME: JUAN\nMIDDLE NAME: SANTOS\nSEX: M\nDATE OF BIRTH: 1985-03-12",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1985-03-12",
      "idNumber": "0212-3456789-0",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-02-stacked-tagalog-labels",
    "focus": "Tagalog label-only stacked layout (APELYIDO / MGA PANGALAN / GITNANG APELYIDO / KASARIAN / PETSA NG KAPANGANAKAN); exercises valueBelowLabel + GITNANG-APELYIDO-vs-APELYIDO non-collision.",
    "rawText": "REPUBLIKA NG PILIPINAS\nSOCIAL SECURITY SYSTEM\nAPELYIDO\nBAUTISTA\nMGA PANGALAN\nMARIA CLARA\nGITNANG APELYIDO\nREYES\nKASARIAN\nF\nPETSA NG KAPANGANAKAN\n07 JUN 1992\nCRN 3401-2345678-9",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "BAUTISTA, MARIA CLARA REYES",
      "birthDate": "1992-06-07",
      "idNumber": "3401-2345678-9",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-03-ocr-O-for-zero-in-crn",
    "focus": "OCR noise: leading 0 read as letter O in the CRN. Detection still SSS via keyword, but the strict numeric CRN regex fails to capture the ID number.",
    "rawText": "SOCIAL SECURITY SYSTEM\nUMID\nCOMMON REFERENCE NO.\nO212-3456789-0\nSURNAME: GARCIA\nGIVEN NAME: PEDRO\nMIDDLE NAME: LOPEZ\nSEX: M\nDATE OF BIRTH: 03/12/1980",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "GARCIA, PEDRO LOPEZ",
      "birthDate": "1980-03-12",
      "idNumber": "0212-3456789-0",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-04-middle-initial-sex-misfire",
    "focus": "Female cardholder, middle name printed as a single initial 'M', SEX label-only stacked above value 'F'. The rawText sex fallback grabs the stray 'M' initial.",
    "rawText": "SSS\nSURNAME: REYES\nGIVEN NAME: FELISA\nMIDDLE NAME: M\nSEX\nF\nCRN 0212-1234567-8\nDATE OF BIRTH: FEBRUARY 28, 1975",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "REYES, FELISA M",
      "birthDate": "1975-02-28",
      "idNumber": "0212-1234567-8",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-05-merged-label-header",
    "focus": "HARD adversarial: a single merged label row 'SURNAME GIVEN NAME MIDDLE NAME' with the value row beneath, plus 'SEX M DATE OF BIRTH ...' merged on one line.",
    "rawText": "SOCIAL SECURITY SYSTEM\nSURNAME GIVEN NAME MIDDLE NAME\nDELA CRUZ JUAN SANTOS\nSEX M DATE OF BIRTH 1990-05-20\n0212-7654321-0",
    "expected": {
      "documentType": "SSS_UMID",
      "birthDate": "1990-05-20",
      "idNumber": "0212-7654321-0",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-06-reordered-values-above-labels",
    "focus": "HARD adversarial: reordered blocks where each value is printed ABOVE its label. valueBelowLabel pairs each label with the wrong (next) line and the CRN line lands under MIDDLE NAME.",
    "rawText": "SOCIAL SECURITY SYSTEM\nTORRES\nSURNAME\nANGELO\nGIVEN NAME\nDOMINGO\nMIDDLE NAME\n0445-9988776-5\nSEX: M\nDATE OF BIRTH: 11/30/1995",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "TORRES, ANGELO DOMINGO",
      "birthDate": "1995-11-30",
      "idNumber": "0445-9988776-5",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-07-wrapped-address",
    "focus": "Multi-line wrapped address under an ADDRESS label-only line, terminated by the CRN row; full clean read. Address regression lock.",
    "rawText": "SOCIAL SECURITY SYSTEM\nSURNAME: VILLANUEVA\nGIVEN NAME: ROSARIO\nMIDDLE NAME: AQUINO\nSEX: F\nDATE OF BIRTH: 09 SEP 1988\nADDRESS\n123 MABINI STREET BARANGAY SAN ROQUE\nQUEZON CITY METRO MANILA 1109\nCRN 3409-1122334-5",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "VILLANUEVA, ROSARIO AQUINO",
      "birthDate": "1988-09-09",
      "idNumber": "3409-1122334-5",
      "address": "123 MABINI STREET BARANGAY SAN ROQUE, QUEZON CITY METRO MANILA 1109",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-08-suffix-hyphenated-surname-twoword-given",
    "focus": "Suffix (JR) appended to a two-word given name, hyphenated two-word surname. Verifies cleanName preserves the hyphen and the parser leaves the suffix in place (no suffix relocation logic exists).",
    "rawText": "SOCIAL SECURITY SYSTEM\nUMID\nSURNAME: DELA-CRUZ\nGIVEN NAME: JUAN PABLO JR\nMIDDLE NAME: REYES\nSEX: M\nDATE OF BIRTH: 1979-12-01\nCRN 0102-3040506-7",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "DELA-CRUZ, JUAN PABLO JR REYES",
      "birthDate": "1979-12-01",
      "idNumber": "0102-3040506-7",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-09-charnoise-doubled-spaces",
    "focus": "OCR character noise inside name tokens (O->0 in SANT0S, I->1 in MAR1A), trailing period on CRUZ., doubled spaces around delimiters. cleanName deletes the digit substitutions instead of correcting them.",
    "rawText": "SOCIAL  SECURITY  SYSTEM\nSURNAME :  SANT0S\nGIVEN  NAME :  MAR1A\nMIDDLE NAME :  CRUZ.\nSEX :  F\nDATE OF BIRTH :  06/15/1991\nCRN  4501-2345678-9",
    "expected": {
      "documentType": "SSS_UMID",
      "birthDate": "1991-06-15",
      "idNumber": "4501-2345678-9",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-10-degraded-missing-fields",
    "focus": "Degraded capture: only surname, given name and CRN readable. No sex, no DOB, no middle, no address. Parser must omit the unreadable fields cleanly.",
    "rawText": "SOCIAL SECURITY SYSTEM\nSURNAME: NAVARRO\nGIVEN NAME: ISABEL\nCRN 0212-9876543-2",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "NAVARRO, ISABEL",
      "idNumber": "0212-9876543-2"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-11-crn-only-no-keyword",
    "focus": "No SSS/UMID/CRN anchor word; document type must be detected purely from the 4-7-1 CRN format. Detection regression lock.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nSURNAME: MENDOZA\nGIVEN NAME: CARLO\nMIDDLE NAME: DIZON\nSEX: M\nDATE OF BIRTH: 04/22/1983\n0212-4567890-1",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "MENDOZA, CARLO DIZON",
      "birthDate": "1983-04-22",
      "idNumber": "0212-4567890-1",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-12-sex-and-dob-same-line",
    "focus": "Adversarial label-on-same-line-as-value: SEX and DATE OF BIRTH share one line. parseSex must pick the first F; DOB resolves via the multi-column/fallback path.",
    "rawText": "SOCIAL SECURITY SYSTEM\nSURNAME: AQUINO\nGIVEN NAME: BENIGNO\nMIDDLE NAME: COJUANGCO\nSEX: F  DATE OF BIRTH: 01/05/1990\nCRN 0212-1112131-4",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "AQUINO, BENIGNO COJUANGCO",
      "birthDate": "1990-01-05",
      "idNumber": "0212-1112131-4",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-13-tagalog-inline-with-address",
    "focus": "Tagalog inline labels with delimiters plus an inline TIRAHAN address on the label line, terminated by the CRN row. Tagalog + inline-address regression lock.",
    "rawText": "SOCIAL SECURITY SYSTEM\nAPELYIDO: PASCUAL\nMGA PANGALAN: ANTONIO\nGITNANG APELYIDO: RAMOS\nKASARIAN: M\nPETSA NG KAPANGANAKAN: 15 AUG 1977\nTIRAHAN: 45 RIZAL AVE STA MESA MANILA 1008\nCRN 0212-5566778-9",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "PASCUAL, ANTONIO RAMOS",
      "birthDate": "1977-08-15",
      "idNumber": "0212-5566778-9",
      "address": "45 RIZAL AVE STA MESA MANILA 1008",
      "sex": "MALE"
    }
  },
  {
    "docType": "SSS_UMID",
    "id": "umid-14-crn-no-separators",
    "focus": "Adversarial: CRN OCR'd as 12 contiguous digits with no hyphen/space separators. The CRN regex requires separators, so the ID number is lost.",
    "rawText": "SOCIAL SECURITY SYSTEM\nCOMMON REFERENCE NUMBER\n021234567890\nSURNAME: FERNANDEZ\nGIVEN NAME: LORNA\nMIDDLE NAME: GATCHALIAN\nSEX: F\nDATE OF BIRTH: 1969-10-08",
    "expected": {
      "documentType": "SSS_UMID",
      "fullName": "FERNANDEZ, LORNA GATCHALIAN",
      "birthDate": "1969-10-08",
      "idNumber": "0212-3456789-0",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-01-clean-male",
    "focus": "Clean DFA TD3 read: two well-formed MRZ lines plus bilingual bio. Baseline regression lock for the MRZ-driven path (offsets 0-8/13-18/20).",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nREPUBLIKA NG PILIPINAS\nPASSPORT  PASAPORTE\nType  Code  Passport No.\nP  PHL  P1234567A\nSurname / Apelyido\nDELA CRUZ\nGiven Names / Mga Pangalan\nJUAN SANTOS\nNationality  FILIPINO\nDate of Birth  01 JAN 1990\nSex  M   Place of Birth  MANILA PH\nDate of Issue  01 JAN 2020\nDate of Expiry  01 JAN 2030\nAuthority  DFA MANILA\nP<PHLDELA<CRUZ<<JUAN<SANTOS<<<<<<<<<<<<<<<<<<\nP1234567A6PHL9001011M3001015<<<<<<<<<<<<<<02",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1990-01-01",
      "idNumber": "P1234567A",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-02-clean-female",
    "focus": "Clean female read, single-chevron two-word given name (MARIA<CLARA), separate-letter surname. Confirms sex='F' at offset 20 and YY>26 century mapping (95->1995).",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nPassport No. EB7654321\nSurname\nREYES\nGiven Names\nMARIA CLARA\nDate of Birth 25 DEC 1995\nSex F\nDate of Expiry 05 JUN 2033\nAuthority DFA NCR EAST\nP<PHLREYES<<MARIA<CLARA<<<<<<<<<<<<<<<<<<<<<<\nEB76543210PHL9512254F3306058<<<<<<<<<<<<<<06",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "REYES, MARIA CLARA",
      "birthDate": "1995-12-25",
      "idNumber": "EB7654321",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-03-tagalog-labels-2000s-dob",
    "focus": "Bilingual Tagalog/English labels (Apelyido/Kasarian/Petsa ng Kapanganakan) + multi-line Place of Birth. Passport path is MRZ-only: ALL labels/bio ignored, no address ever emitted. Also locks YY=00 -> 2000 century branch.",
    "rawText": "REPUBLIKA NG PILIPINAS\nREPUBLIC OF THE PHILIPPINES\nPASAPORTE / PASSPORT\nApelyido / Surname\nLIM\nMga Pangalan / Given Names\nJOSE MARI\nKasarian / Sex  M\nPetsa ng Kapanganakan / Date of Birth  10 MAY 2000\nLugar ng Kapanganakan / Place of Birth\nQUEZON CITY METRO MANILA\nPHILIPPINES\nAwtoridad / Authority  DFA MANILA\nP<PHLLIM<<JOSE<MARI<<<<<<<<<<<<<<<<<<<<<<<<<\nP2233445F2PHL0005108M3005103<<<<<<<<<<<<<<05",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "LIM, JOSE MARI",
      "birthDate": "2000-05-10",
      "idNumber": "P2233445F",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-04-ocr-digit-in-name",
    "focus": "OCR character noise INSIDE the MRZ alpha name zone: O->0 and I->1 (SANT0S / J0SE / MAR1A). Number/DOB kept clean to isolate. Passport path never runs cleanName(), so digits survive into fullName.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT\nSurname  SANTOS\nGiven Names  JOSE MARIA\nDate of Birth  03 MAR 1992\nSex  M\nP<PHLSANT0S<<J0SE<MAR1A<<<<<<<<<<<<<<<<<<<<<\nP8812345A1PHL9203034M3203030<<<<<<<<<<<<<<07",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "SANTOS, JOSE MARIA",
      "birthDate": "1992-03-03",
      "idNumber": "P8812345A",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-05-suffix-roman",
    "focus": "Name with a suffix (III) carried inside the given-names field (JOSE<III). Verifies parser has NO special suffix handling: the suffix simply rides along, mechanically space-joined into 'GIVEN SUFFIX'.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nPassport No.  P5566778C\nSurname  RIZAL\nGiven Names  JOSE\nSuffix  III\nDate of Birth  19 JUN 1985\nSex  M\nP<PHLRIZAL<<JOSE<III<<<<<<<<<<<<<<<<<<<<<<<<\nP5566778C4PHL8506192M3106197<<<<<<<<<<<<<<08",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "RIZAL, JOSE III",
      "birthDate": "1985-06-19",
      "idNumber": "P5566778C",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-06-twoword-surname-and-given",
    "focus": "Two-word surname (DELA<CRUZ via single chevron) AND two-word given (JUAN<SANTOS), plus a multi-line Place of Birth that must be ignored (no address for passports). Locks correct single-chevron->space within each <<-part.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT\nSurname / Apelyido\nDELA CRUZ\nGiven Names / Mga Pangalan\nJUAN SANTOS\nPlace of Birth\nSAN PEDRO LAGUNA\nCALABARZON PHILIPPINES\nDate of Birth  15 AUG 1988\nSex  M\nP<PHLDELA<CRUZ<<JUAN<SANTOS<<<<<<<<<<<<<<<<<<\nXX12345678PHL8808153M2808151<<<<<<<<<<<<<<04",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1988-08-15",
      "idNumber": "XX1234567",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-07-partial-line2-illegible",
    "focus": "Degraded capture: MRZ line 1 readable, line 2 smudged to a short non-MRZ fragment (fails the 20+ run filter). Parser is MRZ-only and does NOT fall back to the readable bio DOB/sex, so only fullName is emitted. Regression lock for graceful partial output.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nSurname  AQUINO\nGiven Names  CORAZON\nDate of Birth  25 JAN 1933\nSex  F\nP<PHLAQUINO<<CORAZON<<<<<<<<<<<<<<<<<<<<<<<<\nP1 *** ILLEGIBLE ***",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "AQUINO, CORAZON"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-08-merged-mrz-one-line",
    "focus": "ADVERSARIAL merged layout: ML Kit emits both MRZ rows on ONE physical line separated by a space. After space-strip it is a single 88-char line, so line2 lookup (l !== line1) finds nothing. Name still parses from line1; number/DOB/sex are lost.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nSurname  BONIFACIO\nGiven Names  ANDRES\nDate of Birth  30 NOV 1992\nSex  M\nP<PHLBONIFACIO<<ANDRES<<<<<<<<<<<<<<<<<<<<<<< AB12345670PHL9211301M3011308<<<<<<<<<<<<<<00",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "BONIFACIO, ANDRES",
      "birthDate": "1992-11-30",
      "idNumber": "AB1234567",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-09-doubled-chevron-in-given",
    "focus": "OCR widens the gap between two given-name tokens into a DOUBLE chevron (MARIA<<CLARA). split('<<') then treats CLARA as a separate part; only names[1] is taken as 'given', so the second given/middle token is dropped.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT\nSurname  REYES\nGiven Names  MARIA CLARA\nDate of Birth  14 JUL 1993\nSex  F\nP<PHLREYES<<MARIA<<CLARA<<<<<<<<<<<<<<<<<<<<\nP9988776D1PHL9307145F3107149<<<<<<<<<<<<<<03",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "REYES, MARIA CLARA",
      "birthDate": "1993-07-14",
      "idNumber": "P9988776D",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-10-stray-punctuation-offset-shift",
    "focus": "OCR injects a stray '.' after the nationality field in line 2. The MRZ pre-clean only strips ASCII spaces, not other punctuation, so every fixed offset from the dot rightward shifts by one: DOB slice becomes '.91030' and sex char becomes a digit. Number (left of dot) survives.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nSurname  GARCIA\nGiven Names  ANA\nDate of Birth  08 MAR 1991\nSex  F\nP<PHLGARCIA<<ANA<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nGC11223347PHL.9103085F3103082<<<<<<<<<<<<<<09",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "GARCIA, ANA",
      "birthDate": "1991-03-08",
      "idNumber": "GC1122334",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-11-broken-country-code",
    "focus": "OCR reads nationality 'PHL' as 'PH1' in line 1 (L->1). The surname-strip anchor /^P[<K][A-Z]{3}/ requires 3 LETTERS, so it fails to fire and the 'P<PH1' prefix leaks into the surname. Detection still PASSPORT via the visible 'PASSPORT' word.",
    "rawText": "PHILIPPINE PASSPORT\nREPUBLIC OF THE PHILIPPINES\nSurname  CRUZ\nGiven Names  JUAN\nDate of Birth  22 SEP 1987\nSex  M\nP<PH1CRUZ<<JUAN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nP7654321A3PHL8709221M2709224<<<<<<<<<<<<<<06",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "CRUZ, JUAN",
      "birthDate": "1987-09-22",
      "idNumber": "P7654321A",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-12-all-chevrons-as-K",
    "focus": "ADVERSARIAL: ML Kit maps EVERY '<' chevron to 'K' across both MRZ rows (a documented confusion). detectDocumentType still says PASSPORT (PKPHL matches P[<K][A-Z]{3}), but extractPassport's mrzLines filter requires l.includes('<') -> both rows are discarded and NOTHING is extracted.",
    "rawText": "PHILIPPINE PASSPORT\nREPUBLIC OF THE PHILIPPINES\nSurname  CRUZ\nGiven Names  JUAN\nDate of Birth  22 SEP 1987\nSex  M\nPKPHLCRUZKKJUANKKKKKKKKKKKKKKKKKKKKKKKKKKKKK\nP7654321A3PHL8709221M2709224KKKKKKKKKKKKKK06",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "CRUZ, JUAN",
      "birthDate": "1987-09-22",
      "idNumber": "P7654321A",
      "sex": "MALE"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-13-detection-lost-anchor",
    "focus": "ADVERSARIAL detection failure: OCR reads the line-1 lead 'P' as 'F' (F<PHL) AND the visible word 'PASSPORT' as 'PASSP0RT' (O->0), with a Tagalog-only header. Both passport anchors miss, so the doc falls through to GENERIC_ID and the whole MRZ extractor is skipped.",
    "rawText": "REPUBLIKA NG PILIPINAS\nPASSP0RT PASAP0RTE\nF<PHLCRUZ<<JUAN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nP7654321A3PHL8709221M2709224<<<<<<<<<<<<<<06",
    "expected": {
      "documentType": "PASSPORT"
    }
  },
  {
    "docType": "PASSPORT",
    "id": "pp-14-reordered-mrz-blocks",
    "focus": "ADVERSARIAL reordered blocks: ML Kit returns MRZ line 2 ABOVE line 1, and both above the bio. find()-based selection is order-independent, so this should still parse cleanly. Regression lock that reordering does NOT break the passport path.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPASSPORT PASAPORTE\nP3344556E9PHL8308314M2908316<<<<<<<<<<<<<<01\nP<PHLMAGSAYSAY<<RAMON<<<<<<<<<<<<<<<<<<<<<<<\nSurname  MAGSAYSAY\nGiven Names  RAMON\nDate of Birth  31 AUG 1983\nSex  M",
    "expected": {
      "documentType": "PASSPORT",
      "fullName": "MAGSAYSAY, RAMON",
      "birthDate": "1983-08-31",
      "idNumber": "P3344556E",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-01-clean-stacked",
    "focus": "Clean read, stacked separate English labels (label-only line + value below). Baseline regression lock.",
    "rawText": "PHILHEALTH\nPhilippine Health Insurance Corporation\nPhilHealth Identification Number\n12-345678901-2\nLast Name\nDELA CRUZ\nFirst Name\nJUAN\nMiddle Name\nSANTOS\nDate of Birth\nJanuary 15, 1985",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "DELA CRUZ, JUAN SANTOS",
      "birthDate": "1985-01-15",
      "idNumber": "12-345678901-2"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-02-tagalog-multiline-addr",
    "focus": "Tagalog labels (Apelyido/Mga Pangalan/Gitnang Apelyido/Kasarian/Petsa ng Kapanganakan/Tirahan), hyphenated surname, two-word given, multi-line wrapped address, sex from bare F.",
    "rawText": "PhilHealth\nPambansang Programa sa Segurong Pangkalusugan\nPhilHealth Identification Number\n34-567890123-4\nApelyido\nREYES-GARCIA\nMga Pangalan\nMARIA ISABEL\nGitnang Apelyido\nTANTOCO\nKasarian\nF\nPetsa ng Kapanganakan\n07/04/1992\nTirahan\n123 RIZAL STREET\nBARANGAY MALAYA\nQUEZON CITY 1100",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "REYES-GARCIA, MARIA ISABEL TANTOCO",
      "birthDate": "1992-07-04",
      "idNumber": "34-567890123-4",
      "address": "123 RIZAL STREET, BARANGAY MALAYA, QUEZON CITY 1100",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-03-suffix-separate-label",
    "focus": "Inline English labels with delimiter, two-word given name, and a separate 'Suffix: JR' label the parser is not designed to capture (suffix dropped by design).",
    "rawText": "Philippine Health Insurance Corporation\nPhilHealth Identification Number : 05-112233445-6\nLast Name: DELA CRUZ\nFirst Name: JOHN PAUL\nMiddle Name: REYES\nSuffix: JR\nDate of Birth: 06/30/1988\nSex: M",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "DELA CRUZ, JOHN PAUL REYES",
      "birthDate": "1988-06-30",
      "idNumber": "05-112233445-6",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-04-name-label-only-below",
    "focus": "ADVERSARIAL: label-only 'NAME' header with the comma-formatted value on the next line; suffix JR carried inside the value; two-word given. Probes the single-Name path gap.",
    "rawText": "PhilHealth Identification Number\n67-890123456-7\nNAME\nDELA CRUZ JR, JUAN MIGUEL SANTOS\nDATE OF BIRTH\nMarch 03, 1979",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "DELA CRUZ JR, JUAN MIGUEL SANTOS",
      "birthDate": "1979-03-03",
      "idNumber": "67-890123456-7"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-05-wrapped-addr-noise",
    "focus": "Multi-line wrapped address with doubled spaces (collapsed) and 0/O OCR noise inside the address value (passed through, not corrected). Two-word given + short surname.",
    "rawText": "PHILHEALTH\nPhilHealth Identification Number\n89-012345678-9\nLast Name\nGO\nFirst Name\nLI WEI\nMiddle Name\nONG\nAddress\nBLK 7 LOT 12  PUROK 3\nSITIO MASAGANA, BRGY. SAN ISIDRO\nCITY OF SAN J0SE DEL MONTE\nBULACAN 3023\nDate of Birth\n11/05/1995",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "GO, LI WEI ONG",
      "birthDate": "1995-11-05",
      "idNumber": "89-012345678-9",
      "address": "BLK 7 LOT 12 PUROK 3, SITIO MASAGANA, BRGY. SAN ISIDRO, CITY OF SAN J0SE DEL MONTE, BULACAN 3023"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-06-pin-doubled-space",
    "focus": "ADVERSARIAL OCR noise: PIN printed with doubled spaces between groups; keyword still present so type is detected but the PIN regex fails.",
    "rawText": "PHILHEALTH\nPhilippine Health Insurance Corporation\nPhilHealth Identification Number\n23  456789012  3\nName: TAN, ROBERTO LIM\nDate of Birth: 09/18/1975",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "TAN, ROBERTO LIM",
      "birthDate": "1975-09-18",
      "idNumber": "23-456789012-3"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-07-pin-digit-ocr-S",
    "focus": "OCR character noise inside PIN digits (5 read as S). Keyword present (type detected) but PIN regex fails; rest of card clean. Sex from labelled F.",
    "rawText": "PHILHEALTH\nPhilHealth Identification Number\n12-34S678901-2\nSurname: SANTOS\nGiven Name: ANA\nMiddle Name: CRUZ\nDate of Birth: 12/25/2000\nSex: F",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "SANTOS, ANA CRUZ",
      "birthDate": "2000-12-25",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-08-false-sex-initial",
    "focus": "Card has NO sex field; person is female (Maria) with middle initial 'M.'. Probes the bare-M/F whole-text sex fallback false positive.",
    "rawText": "PHILHEALTH\nPhilHealth Identification Number\n20-123456789-0\nName: SANTOS, MARIA M. REYES\nDate of Birth: 03/22/1990",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "SANTOS, MARIA M. REYES",
      "birthDate": "1990-03-22",
      "idNumber": "20-123456789-0"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-09-degraded-partial",
    "focus": "Degraded capture: letter-spaced header, PIN present, an unlabelled surname fragment, no DOB/sex/address. Only docType + idNumber recoverable (no labels for name).",
    "rawText": "P H I L H E A L T H\nPhilHealth Identification Number\n45-678901234-5\nDELA ROSA",
    "expected": {
      "documentType": "PHILHEALTH",
      "idNumber": "45-678901234-5"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-10-stacked-cols-reordered",
    "focus": "HARD ADVERSARIAL: columnar OCR mis-grouping — both name labels stacked first, then both values stacked. Probes valueBelowLabel grabbing a following LABEL as the value.",
    "rawText": "PhilHealth Identification Number\n78-901234567-8\nLast Name\nGiven Name\nDELA CRUZ\nJUAN\nDate of Birth: 08/14/1991",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "DELA CRUZ, JUAN",
      "birthDate": "1991-08-14",
      "idNumber": "78-901234567-8"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-11-no-keyword-pin-detect",
    "focus": "No PHILHEALTH keyword anywhere; detection must rely purely on the 2-9-1 PIN format (and must NOT mis-route to SSS/CRN or PhilSys/PCN).",
    "rawText": "Identification Number\n98-765432109-8\nName: AQUINO, BENIGNO COJUANGCO\nDate of Birth: 02/08/1960\nSex: M",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "AQUINO, BENIGNO COJUANGCO",
      "birthDate": "1960-02-08",
      "idNumber": "98-765432109-8",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-12-space-pin-ddmm",
    "focus": "PIN with single-space separators (normalizeIdNumber should hyphenate) + Tagalog inline labels + DD/MM date that must swap because day>12.",
    "rawText": "PHILHEALTH\nPhilHealth Identification Number\n11 222333444 5\nApelyido: BAUTISTA\nMga Pangalan: JOSE RIZAL\nPetsa ng Kapanganakan: 25/12/1998",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "BAUTISTA, JOSE RIZAL",
      "birthDate": "1998-12-25",
      "idNumber": "11-222333444-5"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-13-decorated-clean",
    "focus": "Stray decoration punctuation around the keyword (=== PHILHEALTH ===), clean inline English labels, full sex word. Regression lock for detection robustness + I/l handled cleanly.",
    "rawText": "=== PHILHEALTH ===\nPhilHealth Identification Number\n30-445566778-9\nLast Name: VILLANUEVA\nFirst Name: WILLIAM\nMiddle Name: LIM\nDate of Birth: 04/01/1987\nSex: Male",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "VILLANUEVA, WILLIAM LIM",
      "birthDate": "1987-04-01",
      "idNumber": "30-445566778-9",
      "sex": "MALE"
    }
  },
  {
    "docType": "PHILHEALTH",
    "id": "phl-14-trailing-punct-name",
    "focus": "Stray trailing punctuation inside labelled name values ('CRUZ.' and 'PEDRO,'). Probes cleanName keeping . and , and corrupting LAST, GIVEN MIDDLE composition.",
    "rawText": "PHILHEALTH\nPhilHealth Identification Number\n40-556677889-1\nLast Name: CRUZ.\nFirst Name: PEDRO,\nMiddle Name: REYES\nDate of Birth: 10/10/1970",
    "expected": {
      "documentType": "PHILHEALTH",
      "fullName": "CRUZ, PEDRO REYES",
      "birthDate": "1970-10-10",
      "idNumber": "40-556677889-1"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-01-clean-postal",
    "focus": "Clean read, English separate labels, address as last block (no leak). Regression lock.",
    "rawText": "REPUBLIC OF THE PHILIPPINES\nPHILIPPINE POSTAL CORPORATION\nPOSTAL IDENTITY CARD\nPRN-0123456789\nSurname: BAUTISTA\nGiven Name: MARIA CLARA\nMiddle Name: REYES\nDate of Birth: MARCH 15, 1992\nSex: F\nAddress: 24 RIZAL STREET BARANGAY SAN ROQUE QUEZON CITY 1100",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "BAUTISTA, MARIA CLARA REYES",
      "birthDate": "1992-03-15",
      "address": "24 RIZAL STREET BARANGAY SAN ROQUE QUEZON CITY 1100",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-02-ocr-noise-voter",
    "focus": "OCR confusables 0/O, doubled spaces, stray punctuation; single Name label; voter ID with no strong anchor.",
    "rawText": "REPUBLIC 0F THE PHILIPPINES\nC0MMISSI0N 0N ELECTI0NS\nV0TER'S IDENTIFICATION CARD\nVIN  6O37-O1A2-B3456-D789O\nName:  J0SE  L. SANTOS\nBirthdate:  O1/15/1988\nSex:  MALE\nAddress:  123  MABINI  ST.,  BRGY  5,  MAKATI  CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "JOSE L. SANTOS",
      "birthDate": "1988-01-15",
      "address": "123 MABINI ST., BRGY 5, MAKATI CITY",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-03-tagalog-labels",
    "focus": "Tagalog label variants (Apelyido/Mga Pangalan/Gitnang Apelyido/Petsa ng Kapanganakan/Kasarian/Tirahan). Regression lock.",
    "rawText": "REPUBLIKA NG PILIPINAS\nPAMBANSANG KOMISYON\nPROFESSIONAL IDENTIFICATION CARD\nApelyido: DELA CRUZ\nMga Pangalan: ANGELO MIGUEL\nGitnang Apelyido: REYES\nPetsa ng Kapanganakan: 07/22/1985\nKasarian: M\nTirahan: 88 BONIFACIO AVE, BRGY SAN ANTONIO, PASIG CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "DELA CRUZ, ANGELO MIGUEL REYES",
      "birthDate": "1985-07-22",
      "address": "88 BONIFACIO AVE, BRGY SAN ANTONIO, PASIG CITY",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-04-wrapped-address",
    "focus": "Label-only Address line then 3-line wrapped street/barangay/city continuation. Regression lock.",
    "rawText": "SENIOR CITIZEN IDENTIFICATION CARD\nOFFICE OF THE SENIOR CITIZENS AFFAIRS\nLast Name: VILLANUEVA\nGiven Name: ROSARIO\nMiddle Name: GARCIA\nDate of Birth: 03/08/1955\nSex: FEMALE\nAddress:\n145 KATIPUNAN ROAD\nBARANGAY LOYOLA HEIGHTS\nQUEZON CITY METRO MANILA 1108",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "VILLANUEVA, ROSARIO GARCIA",
      "birthDate": "1955-03-08",
      "address": "145 KATIPUNAN ROAD, BARANGAY LOYOLA HEIGHTS, QUEZON CITY METRO MANILA 1108",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-05-suffix-jr-hyphen",
    "focus": "Suffix JR, hyphenated surname SANTOS-REYES, two-word given JUAN PABLO, two-word middle DELA CRUZ.",
    "rawText": "PHILIPPINE POSTAL CORPORATION\nPOSTAL ID\nSurname: SANTOS-REYES\nGiven Name: JUAN PABLO\nMiddle Name: DELA CRUZ\nSuffix: JR\nDate of Birth: NOVEMBER 5, 1979\nSex: M\nAddress: 7 MARALITA STREET, TONDO, MANILA 1012",
    "expected": {
      "documentType": "GENERIC_ID",
      "birthDate": "1979-11-05",
      "address": "7 MARALITA STREET, TONDO, MANILA 1012",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-06-partial-degraded",
    "focus": "Degraded capture: only surname, sex, address readable (no given/middle/DOB). Surname-only name composition. Regression lock.",
    "rawText": "PHILIPPINE POSTAL CORPORATION\nID CARD\nSurname: TAN\nSex: F\nAddress: 22 OSMENA BLVD CEBU CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "TAN",
      "address": "22 OSMENA BLVD CEBU CITY",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-07-merged-line",
    "focus": "ADVERSARIAL: name, sex and DOB merged onto one line after Name label (label-on-same-line-as-value).",
    "rawText": "BARANGAY CERTIFICATION ID\nName: GLORIA M. AQUINO   Sex: F   DOB: 06/30/1968\nAddress: 9 SAMPAGUITA ST BRGY HOLY SPIRIT QUEZON CITY 1127",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "GLORIA M. AQUINO",
      "birthDate": "1968-06-30",
      "address": "9 SAMPAGUITA ST BRGY HOLY SPIRIT QUEZON CITY 1127",
      "sex": "FEMALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-08-reordered-blocks",
    "focus": "ADVERSARIAL: reordered blocks - values printed ABOVE their labels; space-separated date; label-only Surname/Given stack.",
    "rawText": "DELA TORRE\nMARK ANTHONY\n1990 12 25\nGENERIC GOVERNMENT ID\nSurname\nGiven Name\nDate of Birth\nM\nAddress\nBLK 5 LOT 12 GREENFIELDS SUBD, DASMARINAS CAVITE 4114",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "DELA TORRE, MARK ANTHONY",
      "birthDate": "1990-12-25",
      "address": "BLK 5 LOT 12 GREENFIELDS SUBD, DASMARINAS CAVITE 4114",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-09-confusables-5s-1l",
    "focus": "OCR confusables 5/S in name (BALDERA5/LUI5/GONZALE5) and 1/l in date (l2/0l/1995).",
    "rawText": "PHILIPPINE POSTAL CORPORATION\nP0STAL ID CARD\nSurname: BALDERA5\nGiven Name: LUI5\nMiddle Name: GONZALE5\nDate of Birth: l2/0l/1995\nSex: MALE\nAddress: l0 J.P. RIZAL ST., BRGY l76, CAL00CAN CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "birthDate": "1995-12-01",
      "address": "l0 J.P. RIZAL ST., BRGY l76, CAL00CAN CITY",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-10-suffix-iii-twoword-surname",
    "focus": "Suffix III plus two-word (non-hyphen) surname DE GUZMAN; English First/Last labels.",
    "rawText": "NATIONAL BUREAU OF INVESTIGATION\nCLEARANCE ID\nLast Name: DE GUZMAN\nFirst Name: CARLO\nMiddle Name: REYES\nSuffix: III\nDate of Birth: AUGUST 09, 2000\nSex: MALE\nAddress: 33 ACACIA LANE, BRGY MALANDAY, MARIKINA CITY 1805",
    "expected": {
      "documentType": "GENERIC_ID",
      "birthDate": "2000-08-09",
      "address": "33 ACACIA LANE, BRGY MALANDAY, MARIKINA CITY 1805",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-11-short-inline-address",
    "focus": "Short inline address fragment on the Address label line (only 1 word >=3 letters) followed by a valid wrapped continuation; must stop before the DOB line.",
    "rawText": "COMELEC VOTER CERTIFICATION\nName: PEDRO PENDUKO\nAddress: 14 ACACIA ST\nBARANGAY UP CAMPUS DILIMAN\nDate of Birth: 04/17/1973\nSex: M",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "PEDRO PENDUKO",
      "birthDate": "1973-04-17",
      "address": "14 ACACIA ST, BARANGAY UP CAMPUS DILIMAN",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-12-combined-header",
    "focus": "Combined comma-header layout on a generic ID; stacked label-only DOB/Sex/Address. Regression lock for extractCombinedHeaderName.",
    "rawText": "PROFESSIONAL REGULATION ID\nLast Name, First Name, Middle Name\nAQUINO, BENIGNO SIMEON, COJUANGCO\nDate of Birth\n02/25/1960\nSex\nMALE\nAddress\n21 TIMES ST, BRGY WEST TRIANGLE, QUEZON CITY",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "AQUINO, BENIGNO SIMEON COJUANGCO",
      "birthDate": "1960-02-25",
      "address": "21 TIMES ST, BRGY WEST TRIANGLE, QUEZON CITY",
      "sex": "MALE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-13-name-only-tagalog",
    "focus": "Minimal capture: only a Tagalog single-name label (Pangalan). Regression lock for single-name path.",
    "rawText": "TUPAD ID\nPangalan: FERNANDO POE",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "FERNANDO POE"
    }
  },
  {
    "docType": "GENERIC_ID",
    "id": "gid-14-gender-label-ddmm",
    "focus": "Gender label variant (full word FEMALE) and DD/MM/YYYY date (first group >12 triggers swap); 2-word inline address survives strict test then wraps. Regression lock (boundary for gid-11 bug).",
    "rawText": "OWWA MEMBERSHIP ID\nSurname: NAVARRO\nGiven Name: TERESITA\nGender: FEMALE\nDate of Birth: 25/12/1980\nAddress: 6 MAGSAYSAY AVE\nBAGUIO CITY 2600",
    "expected": {
      "documentType": "GENERIC_ID",
      "fullName": "NAVARRO, TERESITA",
      "birthDate": "1980-12-25",
      "address": "6 MAGSAYSAY AVE, BAGUIO CITY 2600",
      "sex": "FEMALE"
    }
  }
];
