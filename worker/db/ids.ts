const TIME_LENGTH = 9;
const RANDOM_BYTES = 10;
const RANDOM_LENGTH = 16;

/**
 * Collision-resistant, k-sortable text id: base36 millisecond timestamp followed
 * by 80 bits of CSPRNG entropy. Not a secret — never use this for OTPs or tokens.
 */
export function newId(): string {
	const time = Date.now().toString(36).padStart(TIME_LENGTH, "0");
	const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_BYTES));
	let value = 0n;
	for (const byte of bytes) value = (value << 8n) | BigInt(byte);
	return time + value.toString(36).padStart(RANDOM_LENGTH, "0");
}
