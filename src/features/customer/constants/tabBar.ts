/**
 * Nominal height of the customer tab bar's content (icons + labels), excluding
 * the bottom safe-area inset.
 *
 * Lives outside the `(tabs)` route folder because expo-router route files should
 * only export a default screen/layout component — sharing a constant from one
 * would couple route resolution to a value import. Tab screens add this +
 * `insets.bottom` as bottom padding so their scroll content clears the
 * absolutely-positioned glass tab bar, and the floating CartBar uses it to sit
 * just above the bar.
 */
export const CUSTOMER_TAB_BAR_HEIGHT = 56;
