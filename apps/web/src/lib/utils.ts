import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function daysUntil(date: string, addDays?: number) {
	const SINGLE_DAY = 1000 * 60 * 60 * 24;
	const today = new Date();
	const goal = new Date(date);

	const days = Math.ceil(
		(goal.getTime() + SINGLE_DAY * (addDays || 0) - today.getTime()) / SINGLE_DAY
	);
	return `${days} days`;
}
