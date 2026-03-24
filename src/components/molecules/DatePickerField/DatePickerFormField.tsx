/**
 * DatePickerFormField
 *
 * A React Hook Form Controller wrapper around <DatePickerField>.
 * Drop this into any RHF form the same way you would use <FormField>.
 *
 * The field value is always a YYYY-MM-DD ISO string inside the RHF form state.
 * An empty string represents "no date selected".
 *
 * Usage:
 *   const schema = yup.object({
 *     expenseDate: yup
 *       .string()
 *       .matches(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
 *       .required('Date is required'),
 *   });
 *
 *   <DatePickerFormField
 *     name="expenseDate"
 *     control={control}
 *     label="Expense Date"
 *     maximumDate={new Date()}
 *   />
 *
 * TypeScript constraints honoured:
 *   exactOptionalPropertyTypes — conditional spread for all optional props
 *   noUncheckedIndexedAccess   — ?? fallbacks on all index access
 */

import React from 'react';
import { Controller, type Control, type UseControllerProps } from 'react-hook-form';
import { DatePickerField, type DatePickerFieldProps } from './DatePickerField';

// Omit the controlled props that the Controller will inject itself.
type PassthroughProps = Omit<DatePickerFieldProps, 'value' | 'onChange'>;

export interface DatePickerFormFieldProps extends PassthroughProps {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  rules?: UseControllerProps['rules'];
  defaultValue?: string;
}

export const DatePickerFormField: React.FC<DatePickerFormFieldProps> = ({
  name,
  control,
  rules,
  defaultValue,
  label,
  placeholder,
  error: errorProp,
  helperText,
  disabled,
  minimumDate,
  maximumDate,
  accessibilityLabel,
}) => {
  return (
    <Controller
      name={name}
      control={control}
      {...(rules        !== undefined ? { rules }        : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      render={({ field: { value, onChange }, fieldState: { error: fieldError } }) => {
        // Coerce null / undefined → '' so DatePickerField always gets a string
        const safeValue: string = typeof value === 'string' ? value : '';
        // Prefer the explicit errorProp over the RHF fieldError so callers can
        // override the message without losing the visual error state.
        const resolvedError: string | undefined =
          errorProp ?? fieldError?.message;

        return (
          <DatePickerField
            value={safeValue}
            onChange={onChange}
            {...(label             !== undefined ? { label }             : {})}
            {...(placeholder       !== undefined ? { placeholder }       : {})}
            {...(resolvedError     !== undefined ? { error: resolvedError } : {})}
            {...(helperText        !== undefined ? { helperText }        : {})}
            {...(disabled         !== undefined ? { disabled }          : {})}
            {...(minimumDate      !== undefined ? { minimumDate }       : {})}
            {...(maximumDate      !== undefined ? { maximumDate }       : {})}
            {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
          />
        );
      }}
    />
  );
};
