/**
 * Grid helpers for multi-column FlatList layouts.
 *
 * When a FlatList renders `numColumns > 1`, a trailing partial row stretches
 * its cells to fill the width. Pad the data with `null` so the last row stays
 * the same column count, and render a `flex: 1` spacer for each `null` cell.
 *
 * @example
 * const data = padToColumns(items, columns);
 * <FlatList
 *   data={data}
 *   numColumns={columns}
 *   key={columns}                                  // remount on column change
 *   columnWrapperStyle={columns > 1 ? styles.row : undefined}
 *   renderItem={({ item }) =>
 *     item === null ? <View style={{ flex: 1 }} /> : <Card item={item} />
 *   }
 * />
 */
export function padToColumns<T>(items: readonly T[], columns: number): (T | null)[] {
  if (columns <= 1) return items.slice();

  const remainder = items.length % columns;
  if (remainder === 0) return items.slice();

  const padded: (T | null)[] = items.slice();
  for (let i = remainder; i < columns; i++) padded.push(null);
  return padded;
}
