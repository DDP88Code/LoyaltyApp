import { useEffect, useState } from "react";

function getInitialOnlineState(): boolean {
	if (typeof navigator === "undefined") return true;
	return navigator.onLine;
}

export function useOnlineStatus(): boolean {
	const [isOnline, setIsOnline] = useState(getInitialOnlineState);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const onOnline = () => setIsOnline(true);
		const onOffline = () => setIsOnline(false);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, []);

	return isOnline;
}
