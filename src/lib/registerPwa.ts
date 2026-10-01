import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
	immediate: true,
	onRegisteredSW(_swUrl, registration) {
		if (!registration) return;
		void registration.update();
		setInterval(() => {
			void registration.update();
		}, 60_000);
	},
	onNeedRefresh() {
		void updateSW(true);
	},
});
