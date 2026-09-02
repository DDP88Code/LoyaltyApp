// Generates placeholder PWA icons so the manifest is valid before real artwork exists.
// Run: node scripts/generate-placeholder-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../public/icons",
);

const BACKGROUND = [0x14, 0x11, 0x0f];
const COPPER = [0xc9, 0x7b, 0x3c];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function makeIcon(size, { padding }) {
	const centre = size / 2;
	const radius = centre - padding;
	const rows = [];

	for (let y = 0; y < size; y++) {
		const row = Buffer.alloc(1 + size * 3);
		for (let x = 0; x < size; x++) {
			const dx = x - centre + 0.5;
			const dy = y - centre + 0.5;
			const colour = dx * dx + dy * dy <= radius * radius ? COPPER : BACKGROUND;
			row.set(colour, 1 + x * 3);
		}
		rows.push(row);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
	["icon-192.png", 192, { padding: 24 }],
	["icon-512.png", 512, { padding: 64 }],
	// Maskable icons need the safe zone, so the shape is inset further.
	["icon-512-maskable.png", 512, { padding: 110 }],
	["apple-touch-icon.png", 180, { padding: 18 }],
];

for (const [name, size, options] of targets) {
	writeFileSync(resolve(OUT_DIR, name), makeIcon(size, options));
	console.log(`wrote public/icons/${name}`);
}
