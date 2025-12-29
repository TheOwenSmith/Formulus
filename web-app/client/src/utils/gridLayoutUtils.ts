/**
 * Utility functions for 2-column grid layout calculations
 */

const COLUMNS = 2;

/**
 * Get the row index for a given position in a 2-column grid
 */
export function getRowIndex(position: number): number {
  return Math.floor(position / COLUMNS);
}

/**
 * Get the column index for a given position in a 2-column grid
 */
export function getColumnIndex(position: number): number {
  return position % COLUMNS;
}

/**
 * Check if a position is in the first column
 */
export function isFirstColumn(position: number): boolean {
  return getColumnIndex(position) === 0;
}

/**
 * Check if a position is in the second column
 */
export function isSecondColumn(position: number): boolean {
  return getColumnIndex(position) === 1;
}

/**
 * Check if a position is the first item in its row
 */
export function isFirstInRow(position: number): boolean {
  return isFirstColumn(position);
}

/**
 * Check if a position is the last item in its row
 */
export function isLastInRow(position: number): boolean {
  return isSecondColumn(position);
}

/**
 * Get the total number of rows for a given number of items
 */
export function getTotalRows(itemCount: number): number {
  return Math.ceil(itemCount / COLUMNS);
}

/**
 * Check if a position is in the last row
 */
export function isLastRow(position: number, totalItems: number): boolean {
  const totalRows = getTotalRows(totalItems);
  const rowIndex = getRowIndex(position);
  return rowIndex === totalRows - 1;
}

/**
 * Calculate the target position when dropping an item
 * Takes into account the 2-column grid layout
 */
export function calculateTargetPosition(
  currentIndex: number,
  dropPosition: number,
  _totalItems: number,
): number {
  // If dropping before current position, no adjustment needed
  if (dropPosition <= currentIndex) {
    return dropPosition;
  }
  // If dropping after current position, adjust by 1
  return dropPosition - 1;
}
