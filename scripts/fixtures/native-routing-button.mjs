import { createElement } from "react";
export function Button({ children, onClick }) {
	globalThis.nativeRoutingTest.actions[String(children)] = onClick;
	return createElement("button", { onClick }, children);
}
