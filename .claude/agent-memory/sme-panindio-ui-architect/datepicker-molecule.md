---
name: DatePickerField Molecule
description: Architecture and usage patterns for the DatePickerField and DatePickerFormField molecules
type: project
---

## DatePickerField Molecule Patterns
- Files: `src/components/molecules/DatePickerField/` — `DatePickerField.tsx`, `DatePickerFormField.tsx`, `index.ts`
- Dep: `@react-native-community/datetimepicker@8.4.4` — already installed
- Standalone props: `value` (ISO YYYY-MM-DD or ''), `onChange(isoDate)`, `label`, `placeholder`, `error`, `helperText`, `disabled`, `minimumDate`, `maximumDate`, `accessibilityLabel`
- RHF wrapper: `DatePickerFormField` — adds `name`, `control`, `rules`, `defaultValue`; wraps in `<Controller>`
- Text input display format: MM/DD/YYYY (auto-masked); stored/emitted as YYYY-MM-DD ISO
- Android: uses `DateTimePickerAndroid.open()` (imperative API — no extra state needed)
- iOS: inline `DateTimePicker` inside a slide-up `Modal`; "Done" button dismisses; backdrop Pressable also dismisses
- Design tokens: own `DARK` / `LIGHT` token block (same pattern as `Input.tsx`) — no `useAppTheme()`
- `displayToIso()` validates calendar correctness (rejects e.g. Feb 30) — returns '' on invalid
- Clear button (X icon) appears only when `value !== ''` and `disabled` is false
- The overhead.tsx `LogExpenseSheet` now uses `<DatePickerField>` for `expenseDate` with `maximumDate={new Date()}`
- Yup schema pattern: `yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date').required('Date required')`
