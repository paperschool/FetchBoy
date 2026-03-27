/**
 * Append an item to a mutable Immer-draft array and trim to max size.
 * For push+trim-from-front (debugStore pattern): prepend = false (default)
 * For unshift+trim-from-back (historyStore/mappingLogStore pattern): prepend = true
 */
export function addWithMaxSize<T>(array: T[], item: T, maxSize: number, prepend = false): void {
  if (prepend) {
    array.unshift(item);
    if (array.length > maxSize) {
      array.length = maxSize;
    }
  } else {
    array.push(item);
    if (array.length > maxSize) {
      array.splice(0, array.length - maxSize);
    }
  }
}
