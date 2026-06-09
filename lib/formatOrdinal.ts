/**
 * Format a number with its English ordinal suffix (1st, 2nd, 3rd, 11th, 92nd, …).
 */
export function formatOrdinal(n: number): string {
  const rounded = Math.round(n);
  const mod100 = Math.abs(rounded) % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${rounded}th`;
  }
  switch (Math.abs(rounded) % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}
