/** All player-facing UI strings (English). */
export const STRINGS = {
  gameTitle: 'EAT HERE!',
  moneyLabel: 'Money',
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  hudDayLine: (day: number, weekday: string, time: string) =>
    `Day ${day} \u00b7 ${weekday} \u00b7 ${time}`,
  openButton: 'Open!',
  statusOpen: (closesAt: string) => `Open \u00b7 closes ${closesAt}`,
  statusClosing: 'Closing\u2026',
  report: {
    title: (day: number) => `Day ${day} closed`,
    income: 'Income',
    ingredients: 'Ingredients',
    profit: 'Profit',
    served: 'Guests served',
    leftNoSeat: 'Left (no seat)',
    bestSeller: 'Best seller',
    none: '\u2013',
    next: 'Next day',
  },
} as const;
