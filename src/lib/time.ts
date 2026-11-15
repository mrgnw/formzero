const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * DAY],
	['month', 30 * DAY],
	['day', DAY],
	['hour', HOUR],
	['minute', MINUTE]
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const exact = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' });

export function timeAgo(timestamp: number, now: number) {
	const elapsed = timestamp - now;
	const unit = UNITS.find(([, size]) => Math.abs(elapsed) >= size);
	if (!unit) return 'less than a minute ago';
	return relative.format(Math.trunc(elapsed / unit[1]), unit[0]);
}

export function exactTime(timestamp: number) {
	return `${exact.format(timestamp)} UTC`;
}
