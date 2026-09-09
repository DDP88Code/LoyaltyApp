// Generates PWA icons from public/icons/logo-source.png.
// Run: node scripts/generate-placeholder-icons.mjs
import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../public/icons",
);
const SOURCE_PATH = resolve(OUT_DIR, "logo-source.png");

const MASKABLE_INSET_RATIO = 0.8;

const targets = [
	{ name: "icon-192.png", size: 192 },
	{ name: "icon-512.png", size: 512 },
	{ name: "icon-512-maskable.png", size: 512, maskable: true },
	{ name: "apple-touch-icon.png", size: 180 },
];

function opaqueBlackBackground() {
	return { r: 0, g: 0, b: 0, alpha: 1 };
}

async function ensureSourceExists() {
	try {
		await access(SOURCE_PATH);
	} catch {
		throw new Error(`Source icon not found: ${SOURCE_PATH}`);
	}
}

async function writeStandardIcon(name, size) {
	await sharp(SOURCE_PATH)
		.rotate()
		.resize(size, size, {
			fit: "contain",
			background: opaqueBlackBackground(),
		})
		.png()
		.toFile(resolve(OUT_DIR, name));
}

async function writeMaskableIcon(name, size) {
	const innerSize = Math.round(size * MASKABLE_INSET_RATIO);
	const inset = Math.floor((size - innerSize) / 2);

	const inner = await sharp(SOURCE_PATH)
		.rotate()
		.resize(innerSize, innerSize, {
			fit: "contain",
			background: opaqueBlackBackground(),
		})
		.png()
		.toBuffer();

	await sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: opaqueBlackBackground(),
		},
	})
		.composite([{ input: inner, left: inset, top: inset }])
		.png()
		.toFile(resolve(OUT_DIR, name));
}

await mkdir(OUT_DIR, { recursive: true });
await ensureSourceExists();

for (const target of targets) {
	if (target.maskable) {
		await writeMaskableIcon(target.name, target.size);
	} else {
		await writeStandardIcon(target.name, target.size);
	}
	console.log(`wrote public/icons/${target.name}`);
}
