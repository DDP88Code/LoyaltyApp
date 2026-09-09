export const BRAND = {
	fullName: "Fives Sports Bar & Grill",
	shortName: "Fives Sports Bar",
	rewardsName: "Fives Sports Bar Rewards",
	memberCodeName: "Fives Code",
	tagline: "Good food. Cold drinks. Good times.",
	currency: "ZAR",
	timezone: "Africa/Johannesburg",
	website: "https://fivessportsbar.app",
	support: {
		email: "support@fivessportsbar.app",
		contactUrl: "https://fivessportsbar.app/contact",
	},
	assets: {
		logo: "/icons/logo-source.png",
		icons: {
			appleTouch: "/icons/apple-touch-icon.png",
			app192: "/icons/icon-192.png",
			app512: "/icons/icon-512.png",
			app512Maskable: "/icons/icon-512-maskable.png",
		},
	},
	colors: {
		background: "#14110f",
		primary: "#c97b3c",
		secondary: "#e0a83c",
	},
	displayNames: {
		coffeeProgram: "Fives Sports Bar Coffee Rewards",
		welcomeReward: "Welcome to Fives Sports Bar",
	},
	notifications: {
		defaultTitle: "Fives Sports Bar Rewards",
		promotionFallbackMessage: "New promotion now available at Fives Sports Bar.",
		welcomeVoucherMessage: "Your R50 welcome voucher is ready to use on qualifying bills.",
		rewardExpiryVoucherLabel: "Fives Sports Bar voucher",
	},
} as const;
