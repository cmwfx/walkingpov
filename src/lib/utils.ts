import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const CRYPTO_ADDRESSES = {
	BTC: {
		address: "3KrZDPJZBVZgKVdVyVnUY7HgZ9e3HJH1ua",
		network: "Bitcoin Network",
	},
	LTC: {
		address: "LXmB2zSCZV11Har7AqrbXNWbRc2iPgwK2V",
		network: "Litecoin Network",
	},
	USDT: {
		address: "0x5B14338AE4Cf21016b9f72828C932E33a2eD8058",
		network: "Ethereum Network",
	},
};

export const GIFT_CARD_LINK = "https://www.g2a.com/rewarble-visa-gift-card-30-usd-by-rewarble-key-global-i10000502992007?uuid=c658cf69-c2e7-4e95-b1f0-341128a2d59c";

export const CONTACT_INFO = {
	telegram: "@walkingpov",
	email: "walkingpov@proton.me",
	reviewTime: "8-12 hours",
};

export function formatDate(dateString: string) {
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
