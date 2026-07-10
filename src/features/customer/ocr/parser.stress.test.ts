import { parseIdText } from "./parser";
import { STRESS_SAMPLES, type StressSample } from "./parser.stress.cases";

type Field = "fullName" | "birthDate" | "idNumber" | "address" | "sex";
const FIELDS: Field[] = ["fullName", "birthDate", "idNumber", "address", "sex"];

describe("parser stress corpus (workflow-generated, all 6 PH ID types)", () => {
  STRESS_SAMPLES.forEach((s: StressSample) => {
    describe(`${s.docType} / ${s.id}`, () => {
      const parsed = parseIdText(s.rawText);
      if (s.expected.documentType !== undefined) {
        it("documentType", () => {
          expect(parsed.documentType).toBe(s.expected.documentType);
        });
      }
      FIELDS.forEach((f) => {
        const exp = s.expected[f];
        if (exp === undefined) return;
        it(f, () => {
          expect(parsed[f]?.value).toBe(exp);
        }); 
      });
    });
  });
});
