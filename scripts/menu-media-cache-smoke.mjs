import http from "node:http";

const ORIGIN = "http://localhost:5173";
const PASSWORD = "CoffeeBeans2026";
const STAMP = Date.now();

function rawRequest(method, path, headers, bodyString) {
	return new Promise((resolve, reject) => {
		const target = new URL(`${ORIGIN}${path}`);
		const req = http.request(
			{
				method,
				hostname: target.hostname,
				port: target.port,
				path: `${target.pathname}${target.search}`,
				headers,
				agent: false,
			},
			(res) => {
				const chunks = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => {
					resolve({
						status: res.statusCode,
						headers: res.headers,
						body: Buffer.concat(chunks).toString("utf8"),
					});
				});
			},
		);
		req.on("error", reject);
		if (bodyString !== undefined) req.write(bodyString);
		req.end();
	});
}

class Session {
	constructor() {
		this.cookies = {};
	}

	cookieHeader() {
		return Object.entries(this.cookies)
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}

	async request(method, path, body) {
		const headers = { Accept: "application/json", Origin: ORIGIN };
		let bodyString;
		if (body !== undefined) {
			bodyString = JSON.stringify(body);
			headers["Content-Type"] = "application/json";
			headers["Content-Length"] = Buffer.byteLength(bodyString);
		}
		const cookieHeader = this.cookieHeader();
		if (cookieHeader) headers.Cookie = cookieHeader;

		const response = await rawRequest(method, path, headers, bodyString);
		const setCookies = response.headers["set-cookie"];
		if (Array.isArray(setCookies)) {
			for (const raw of setCookies) {
				const pair = raw.split(";")[0];
				const eq = pair.indexOf("=");
				if (eq === -1) continue;
				this.cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
			}
		}

		let json = null;
		try {
			json = JSON.parse(response.body);
		} catch {
			json = null;
		}

		return {
			status: response.status,
			headers: response.headers,
			ok: response.status >= 200 && response.status < 300,
			json,
		};
	}
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

async function hasPublicMenuImage(key) {
	if (typeof key !== "string" || key.length === 0) {
		return false;
	}
	const path = `/api/media/public/menu?key=${encodeURIComponent(key)}`;
	const response = await new Session().request("GET", path);
	return response.ok;
}

const ONE_PIXEL_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8N7vEAAAAASUVORK5CYII=";

async function uploadMenuImage(session) {
	const form = new FormData();
	form.append(
		"file",
		new Blob([Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")], { type: "image/png" }),
		"menu-cache-smoke.png",
	);

	const headers = { Origin: ORIGIN };
	const cookieHeader = session.cookieHeader();
	if (cookieHeader) headers.Cookie = cookieHeader;

	const response = await fetch(`${ORIGIN}/api/admin/menu/media/upload`, {
		method: "POST",
		headers,
		body: form,
	});

	let json = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}

	return {
		status: response.status,
		ok: response.ok,
		json,
	};
}

async function main() {
	await new Session().request("POST", "/api/dev/seed");

	const admin = new Session();
	const adminLogin = await admin.request("POST", "/api/auth/sign-in/email", {
		email: "admin@example.test",
		password: PASSWORD,
	});
	if (!adminLogin.ok) {
		throw new Error(`Failed to login admin: ${JSON.stringify(adminLogin.json)}`);
	}

	const email = `menu-cache.${STAMP}@example.test`;
	const customer = new Session();
	const registered = await customer.request("POST", "/api/auth/sign-up/email", {
		name: "Menu Cache Customer",
		email,
		password: PASSWORD,
	});
	if (!registered.ok) {
		throw new Error(`Failed to register customer: ${JSON.stringify(registered.json)}`);
	}

	const menu = await customer.request("GET", "/api/customer/menu");
	if (!menu.ok || !menu.json?.success) {
		throw new Error(`Failed to fetch customer menu: ${JSON.stringify(menu.json)}`);
	}

	let categories = menu.json.data?.categories ?? [];
	let firstImageKey = categories
		.flatMap((category) => category.items ?? [])
		.map((item) => item.imageKey)
		.find((key) => typeof key === "string" && key.length > 0);

	if (firstImageKey && !(await hasPublicMenuImage(firstImageKey))) {
		firstImageKey = null;
	}

	if (!firstImageKey) {
		const uploaded = await uploadMenuImage(admin);
		assert(uploaded.ok, `Menu image upload failed: ${JSON.stringify(uploaded.json)}`);
		const uploadedKey = uploaded.json?.data?.imageKey;
		assert(
			typeof uploadedKey === "string" && uploadedKey.length > 0,
			`Upload did not return imageKey: ${JSON.stringify(uploaded.json)}`,
		);

		let targetItemId = categories
			.flatMap((category) => category.items ?? [])
			.map((item) => item.id)
			.find((id) => typeof id === "string" && id.length > 0);

		if (!targetItemId) {
			const createdCategory = await admin.request("POST", "/api/admin/menu/categories", {
				name: `Menu Cache Category ${STAMP}`,
				description: "Cache smoke generated category",
				sortOrder: 9991,
				active: true,
				imageKey: null,
			});
			assert(createdCategory.ok, `Category create failed: ${JSON.stringify(createdCategory.json)}`);
			const categoryId = createdCategory.json?.data?.id;
			assert(typeof categoryId === "string" && categoryId.length > 0, "Created category missing id");

			const createdItem = await admin.request("POST", "/api/admin/menu/items", {
				categoryId,
				name: `Menu Cache Item ${STAMP}`,
				description: "Cache smoke generated item",
				priceCents: 1599,
				imageKey: null,
				active: true,
				available: true,
				popular: false,
				vegetarian: false,
				spicy: false,
				sortOrder: 9991,
			});
			assert(createdItem.ok, `Item create failed: ${JSON.stringify(createdItem.json)}`);
			targetItemId = createdItem.json?.data?.id;
			assert(typeof targetItemId === "string" && targetItemId.length > 0, "Created item missing id");
		}

		const patched = await admin.request("PATCH", `/api/admin/menu/items/${targetItemId}`, {
			imageKey: uploadedKey,
		});
		assert(patched.ok, `Item patch with imageKey failed: ${JSON.stringify(patched.json)}`);
		firstImageKey = uploadedKey;
	}

	assert(firstImageKey, "No menu image key found for cache smoke test");

	const publicImagePath = `/api/media/public/menu?key=${encodeURIComponent(firstImageKey)}`;
	const publicImage = await new Session().request("GET", publicImagePath);
	assert(publicImage.ok, `Public menu image route failed with status ${publicImage.status}`);
	const publicCacheControl = String(publicImage.headers["cache-control"] ?? "");
	assert(
		publicCacheControl.includes("public") &&
			publicCacheControl.includes("max-age=31536000") &&
			publicCacheControl.includes("immutable"),
		`Unexpected public cache-control header: ${publicCacheControl}`,
	);
	const publicContentType = String(publicImage.headers["content-type"] ?? "");
	assert(
		publicContentType.startsWith("image/"),
		`Expected image content-type, received: ${publicContentType}`,
	);
	assert(Boolean(publicImage.headers.etag), "Expected etag on public menu image response");

	const privateWithoutSession = await new Session().request(
		"GET",
		`/api/media/object?key=${encodeURIComponent(firstImageKey)}`,
	);
	assert(
		privateWithoutSession.status === 401,
		`Expected private media endpoint to require auth, got ${privateWithoutSession.status}`,
	);

	const privateWithSession = await customer.request(
		"GET",
		`/api/media/object?key=${encodeURIComponent(firstImageKey)}`,
	);
	assert(privateWithSession.ok, "Authenticated private media request failed");
	const privateCacheControl = String(privateWithSession.headers["cache-control"] ?? "");
	assert(
		privateCacheControl.includes("private"),
		`Expected private cache-control on authenticated media endpoint, got: ${privateCacheControl}`,
	);

	console.log("Menu media cache smoke checks passed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
