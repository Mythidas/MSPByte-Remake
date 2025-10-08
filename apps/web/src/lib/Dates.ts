type Time = {
	seconds: number;
	minutes: number;
	hours: number;
	days: number;
	weeks: number;
};

export class Dates {
	public date: Date;

	constructor(date?: string | Date) {
		this.date = date ? new Date(date) : new Date();
	}

	add(time: Partial<Time>) {
		const ms = Dates.timeToMilliseconds(time);
		return new Dates(new Date(this.date.getTime() + ms));
	}

	daysUntil() {
		return Math.ceil(
			(this.date.getTime() - new Date().getTime()) / Dates.timeToMilliseconds({ days: 1 })
		);
	}

	toDaysUntil() {
		const days = this.daysUntil();
		return `${days} days`;
	}

	getTime() {
		return this.date.getTime();
	}

	static timeToMilliseconds(time: Partial<Time>) {
		const unitToMs = {
			seconds: 1000,
			minutes: 1000 * 60,
			hours: 1000 * 60 * 60,
			days: 1000 * 60 * 60 * 24,
			weeks: 1000 * 60 * 60 * 24 * 7
		} as const;

		return Object.entries(unitToMs).reduce(
			(total, [unit, factor]) => total + (time[unit as keyof typeof unitToMs] || 0) * factor,
			0
		);
	}
}
