import { execSync } from "node:child_process";
import http from "node:http";

const ORIGIN = "http://localhost:5173";
const PASSWORD = "CoffeeBeans2026";
const STAMP = Date.now();

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function randomKey(prefix) {
	return `${prefix}-${STAMP}-${Math.random().toString(36).slice(2, 10)}`;
}

function runD1(sql) {
	try {
		const command = `npx wrangler d1 execute fives-rewards-db --local --command ${JSON.stringify(sql)} --json`;
		const stdout = execSync(command, { encoding: "utf8" });
		const parsed = JSON.parse(stdout);
		return Array.isArray(parsed) ? parsed[0] : parsed;
	} catch (error) {
		throw new Error(
			`D1 command failed: ${JSON.stringify({ sql, error: error instanceof Error ? error.message : String(error) })}`,
		);
	}
}

function d1First(sql) {
	const row = runD1(sql)?.results?.[0];
	if (!row) {
		throw new Error(`No rows returned for query: ${sql}`);
	}
	return row;
}

function d1Count(sql) {
	const row = d1First(sql);
	return Number(row.value ?? row.count ?? 0);
}

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
		if (bodyString !== undefined) {
			req.write(bodyString);
		}
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
		if (cookieHeader) {
			headers.Cookie = cookieHeader;
		}

		const response = await rawRequest(method, path, headers, bodyString);
		const setCookies = response.headers["set-cookie"];
		if (Array.isArray(setCookies)) {
			for (const raw of setCookies) {
				const pair = raw.split(";")[0];
				const eqIndex = pair.indexOf("=");
				if (eqIndex === -1) continue;
				this.cookies[pair.slice(0, eqIndex).trim()] = pair.slice(eqIndex + 1).trim();
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
			ok: response.status >= 200 && response.status < 300,
			json,
		};
	}
}

async function ensureUserWithRole(email, name, role) {
	const probe = new Session();
	const login = await probe.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	if (!login.ok) {
		await probe.request("POST", "/api/auth/sign-up/email", {
			name,
			email,
			password: PASSWORD,
		});
	}

	runD1(`UPDATE profiles SET role='${role}', active=1 WHERE email='${email}'`);

	const session = new Session();
	const relogin = await session.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	assert(relogin.ok, `Failed to sign in ${email}: ${JSON.stringify(relogin.json)}`);
	return session;
}

async function registerCustomer(name, email) {
	const session = new Session();
	const signUp = await session.request("POST", "/api/auth/sign-up/email", {
		name,
		email,
		password: PASSWORD,
	});
	if (!signUp.ok) {
		const signIn = await session.request("POST", "/api/auth/sign-in/email", {
			email,
			password: PASSWORD,
		});
		assert(signIn.ok, `Failed to sign in existing customer ${email}`);
	}
	const me = await session.request("GET", "/api/me");
	const customerId = me.json?.data?.user?.id;
	assert(typeof customerId === "string" && customerId.length > 0, "Customer id missing");
	return { session, customerId };
}

async function expectStatus(responsePromise, status, message) {
	const response = await responsePromise;
	if (response.status !== status) {
		throw new Error(`${message}. Expected ${status}, got ${response.status}: ${JSON.stringify(response.json)}`);
	}
	return response;
}

async function main() {
	await new Session().request("POST", "/api/dev/seed");

	const admin = await ensureUserWithRole(
		`points.admin.${STAMP}@example.test`,
		"Points Admin",
		"admin",
	);
	const staff = await ensureUserWithRole(
		`points.staff.${STAMP}@example.test`,
		"Points Staff",
		"staff",
	);

	const customerA = await registerCustomer("Points Customer A", `points.a.${STAMP}@example.test`);
	const customerB = await registerCustomer("Points Customer B", `points.b.${STAMP}@example.test`);

	const businessId = d1First("SELECT id FROM businesses WHERE slug='fives-pub-and-grill' LIMIT 1").id;
	assert(typeof businessId === "string" && businessId.length > 0, "Business id not found");

	let staffContext = await staff.request("GET", "/api/staff/context");
	assert(staffContext.ok, `Failed to load staff context: ${JSON.stringify(staffContext.json)}`);

	if ((staffContext.json?.data?.locations?.length ?? 0) < 2) {
		const secondLocationId = `loc-points-${STAMP}`;
		const locationName = `Points Smoke ${STAMP}`;
		const now = Date.now();
		runD1(
			`INSERT INTO locations (id, business_id, name, address, active, created_at, updated_at) VALUES ('${secondLocationId}', '${businessId}', '${locationName}', NULL, 1, ${now}, ${now})`,
		);
		staffContext = await staff.request("GET", "/api/staff/context");
	}

	const locations = staffContext.json?.data?.locations ?? [];
	assert(locations.length >= 2, "Need at least two active locations for duplicate-scope test");
	const locationA = locations[0].id;
	const locationB = locations[1].id;

	const programGet = await admin.request("GET", "/api/admin/points/program");
	assert(programGet.ok, `Failed to get points program: ${JSON.stringify(programGet.json)}`);
	const programId = programGet.json?.data?.id;
	assert(typeof programId === "string", "Points program id missing");

	const disableProgram = await admin.request("PATCH", "/api/admin/points/program", {
		active: false,
		earnRatePoints: 10,
		earnRateSpendCents: 100,
		name: "Reward Points",
	});
	assert(disableProgram.ok, `Failed to disable points program: ${JSON.stringify(disableProgram.json)}`);

	const disabledPayload = await customerA.session.request("GET", "/api/customer/points");
	assert(disabledPayload.ok, "Customer points fetch failed when disabled");
	assert(disabledPayload.json?.data === null, "Disabled points program should return null payload");

	const enableProgram = await admin.request("PATCH", "/api/admin/points/program", {
		active: true,
		earnRatePoints: 10,
		earnRateSpendCents: 100,
		name: "Reward Points",
	});
	assert(enableProgram.ok, `Failed to enable points program: ${JSON.stringify(enableProgram.json)}`);

	const now = new Date();
	const hour = 60 * 60 * 1000;
	const startAt = new Date(now.getTime() - hour).toISOString();
	const endAt = new Date(now.getTime() + hour).toISOString();

	const mult2 = await admin.request("POST", "/api/admin/points/promotions", {
		name: `2x-${STAMP}`,
		description: "2x promo",
		promotionType: "multiplier",
		multiplierBp: 20000,
		fixedBonusPoints: null,
		minEligibleSpendCents: null,
		startAt,
		endAt,
		enabled: true,
	});
	assert(mult2.ok, `Failed creating 2x promotion: ${JSON.stringify(mult2.json)}`);

	const mult3 = await admin.request("POST", "/api/admin/points/promotions", {
		name: `3x-${STAMP}`,
		description: "3x promo",
		promotionType: "multiplier",
		multiplierBp: 30000,
		fixedBonusPoints: null,
		minEligibleSpendCents: null,
		startAt,
		endAt,
		enabled: true,
	});
	assert(mult3.ok, `Failed creating 3x promotion: ${JSON.stringify(mult3.json)}`);

	const fixed200 = await admin.request("POST", "/api/admin/points/promotions", {
		name: `+200-${STAMP}`,
		description: "+200 promo",
		promotionType: "fixed_bonus",
		multiplierBp: null,
		fixedBonusPoints: 200,
		minEligibleSpendCents: null,
		startAt,
		endAt,
		enabled: true,
	});
	assert(fixed200.ok, `Failed creating +200 promotion: ${JSON.stringify(fixed200.json)}`);

	const fixed500 = await admin.request("POST", "/api/admin/points/promotions", {
		name: `+500-${STAMP}`,
		description: "+500 promo",
		promotionType: "fixed_bonus",
		multiplierBp: null,
		fixedBonusPoints: 500,
		minEligibleSpendCents: null,
		startAt,
		endAt,
		enabled: true,
	});
	assert(fixed500.ok, `Failed creating +500 promotion: ${JSON.stringify(fixed500.json)}`);

	const quote = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/quote`, {
		locationId: locationA,
		eligibleSpendRand: "100.00",
		billReference: `PTS-QUOTE-${STAMP}`,
	});
	assert(quote.ok, `Quote failed: ${JSON.stringify(quote.json)}`);
	assert(quote.json?.data?.basePoints === 1000, "Base points should be 1000 at 10 points/R1 on R100");
	assert(quote.json?.data?.bonusPoints === 2500, "Bonus points should be 2500 (3x + fixed 500)");
	assert(quote.json?.data?.totalPoints === 3500, "Total points should be 3500");

	const duplicateBill = `PTS-DUP-${STAMP}`;
	const award1 = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationA,
		eligibleSpendRand: "100.00",
		billReference: duplicateBill,
		requestIdempotencyKey: randomKey("award-1"),
	});
	assert(award1.ok, `First award failed: ${JSON.stringify(award1.json)}`);
	const award1Id = award1.json?.data?.awardId;
	assert(typeof award1Id === "string" && award1Id.length > 0, "First award id missing");

	const awardReplayKey = randomKey("award-replay");
	const awardReplay1 = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationA,
		eligibleSpendRand: "120.00",
		billReference: `PTS-IDEM-${STAMP}`,
		requestIdempotencyKey: awardReplayKey,
	});
	assert(awardReplay1.ok, "First request for award replay key failed");
	const awardReplay2 = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationA,
		eligibleSpendRand: "120.00",
		billReference: `PTS-IDEM-${STAMP}`,
		requestIdempotencyKey: awardReplayKey,
	});
	assert(awardReplay2.ok, "Replay request for award idempotency key failed");
	assert(
		awardReplay1.json?.data?.awardId === awardReplay2.json?.data?.awardId,
		"Replayed award request should return the original award",
	);

	await expectStatus(
		staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
			locationId: locationA,
			eligibleSpendRand: "100.00",
			billReference: duplicateBill,
			requestIdempotencyKey: randomKey("award-dup-blocked"),
		}),
		409,
		"Duplicate bill on same location should be blocked",
	);

	const overrideAward = await admin.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationA,
		eligibleSpendRand: "100.00",
		billReference: duplicateBill,
		requestIdempotencyKey: randomKey("award-override"),
		duplicateOverrideReason: "Manager override after till sync issue",
	});
	assert(overrideAward.ok, `Duplicate override failed: ${JSON.stringify(overrideAward.json)}`);
	assert(overrideAward.json?.data?.duplicateOverride === true, "Override award should be flagged");

	const secondLocationSameBill = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationB,
		eligibleSpendRand: "100.00",
		billReference: duplicateBill,
		requestIdempotencyKey: randomKey("award-location-scope"),
	});
	assert(
		secondLocationSameBill.ok,
		`Same bill on second location should be independent: ${JSON.stringify(secondLocationSameBill.json)}`,
	);

	const reverseAward = await admin.request("POST", `/api/admin/points/awards/${award1Id}/reverse`, {
		reason: "Receipt correction reversal",
	});
	assert(reverseAward.ok, `Reversal failed: ${JSON.stringify(reverseAward.json)}`);

	const reawardAfterReverse = await staff.request("POST", `/api/staff/points/customers/${customerA.customerId}/award`, {
		locationId: locationA,
		eligibleSpendRand: "100.00",
		billReference: duplicateBill,
		requestIdempotencyKey: randomKey("award-reaward"),
	});
	assert(reawardAfterReverse.ok, "Re-award after reversal should succeed");

	const pointsProgram = await admin.request("GET", "/api/admin/points/program");
	assert(pointsProgram.ok, "Program fetch failed after award tests");

	const rewardsList = await admin.request("GET", "/api/admin/rewards");
	assert(rewardsList.ok, `Failed loading reward definitions: ${JSON.stringify(rewardsList.json)}`);

	const pointsEligibleRewardCreate = await admin.request("POST", "/api/admin/rewards", {
		name: `Points Eligible ${STAMP}`,
		description: "Voucher reserved for points smoke test",
		rewardType: "voucher",
		valueCents: 2500,
		validDays: 30,
		active: true,
		welcomeReward: false,
		terms: "Points smoke test reward",
	});
	assert(
		pointsEligibleRewardCreate.ok,
		`Failed creating eligible points reward: ${JSON.stringify(pointsEligibleRewardCreate.json)}`,
	);
	const pointsEligibleRewardId = pointsEligibleRewardCreate.json?.data?.id;
	assert(typeof pointsEligibleRewardId === "string", "Eligible points reward id missing");

	const catalogueEligibility = await admin.request("GET", "/api/admin/points/catalogue");
	assert(
		catalogueEligibility.ok,
		`Failed loading points catalogue eligibility: ${JSON.stringify(catalogueEligibility.json)}`,
	);
	const redeemableReward = (catalogueEligibility.json?.data?.eligibleRewards ?? []).find(
		(reward) => reward.id === pointsEligibleRewardId,
	);
	assert(redeemableReward, "No eligible reward definition available for points catalogue");

	const discountRewardCreate = await admin.request("POST", "/api/admin/rewards", {
		name: `Discount Not Allowed ${STAMP}`,
		rewardType: "discount",
		valueCents: 1000,
		active: true,
		welcomeReward: false,
	});
	assert(discountRewardCreate.ok, "Failed to create discount reward for validation test");
	const discountRewardId = discountRewardCreate.json?.data?.id;
	assert(typeof discountRewardId === "string", "Discount reward id missing");

	await expectStatus(
		admin.request("POST", "/api/admin/points/catalogue", {
			rewardDefinitionId: discountRewardId,
			pointsCost: 1000,
			active: true,
			sortOrder: 0,
			imageKey: null,
		}),
		422,
		"Discount reward type should be rejected for points catalogue",
	);

	let catalogueItemId;
	const createCatalogue = await admin.request("POST", "/api/admin/points/catalogue", {
		rewardDefinitionId: redeemableReward.id,
		pointsCost: 1000,
		active: true,
		sortOrder: 0,
		imageKey: null,
	});
	if (createCatalogue.ok) {
		catalogueItemId = createCatalogue.json?.data?.id;
	} else {
		const catalogueList = await admin.request("GET", "/api/admin/points/catalogue");
		assert(catalogueList.ok, "Catalogue fetch failed after create conflict");
		const existing = (catalogueList.json?.data?.items ?? []).find(
			(item) => item.rewardDefinitionId === redeemableReward.id,
		);
		assert(existing, `Catalogue create failed and no existing item found: ${JSON.stringify(createCatalogue.json)}`);
		catalogueItemId = existing.id;
		const patchCatalogue = await admin.request(
			"PATCH",
			`/api/admin/points/catalogue/${catalogueItemId}`,
			{ pointsCost: 1000, active: true, sortOrder: 0 },
		);
		assert(patchCatalogue.ok, "Failed to update existing catalogue item");
	}
	assert(typeof catalogueItemId === "string" && catalogueItemId.length > 0, "Catalogue item id missing");

	const redeemKey = randomKey("redeem-replay");
	const redeem1 = await customerA.session.request("POST", `/api/customer/points/redeem/${catalogueItemId}`, {
		requestIdempotencyKey: redeemKey,
	});
	assert(redeem1.ok, `First redemption failed: ${JSON.stringify(redeem1.json)}`);
	const rewardIdFirstRedeem = redeem1.json?.data?.customerRewardId;

	const redeemReplay = await customerA.session.request("POST", `/api/customer/points/redeem/${catalogueItemId}`, {
		requestIdempotencyKey: redeemKey,
	});
	assert(redeemReplay.ok, `Replay redemption failed: ${JSON.stringify(redeemReplay.json)}`);
	assert(
		redeemReplay.json?.data?.customerRewardId === rewardIdFirstRedeem,
		"Retried redemption should return the original reward",
	);

	await expectStatus(
		admin.request("DELETE", `/api/admin/points/catalogue/${catalogueItemId}`),
		409,
		"Deleting used catalogue item should be rejected",
	);

	const usedPromotionRow = d1First(
		`SELECT multiplier_promotion_id as multiplierId, bonus_promotion_id as bonusId FROM points_awards WHERE id='${award1Id}' LIMIT 1`,
	);
	const usedPromotionId = usedPromotionRow.multiplierId ?? usedPromotionRow.bonusId;
	assert(typeof usedPromotionId === "string" && usedPromotionId.length > 0, "Used promotion id missing");
	await expectStatus(
		admin.request("DELETE", `/api/admin/points/promotions/${usedPromotionId}`),
		409,
		"Deleting used promotion should be rejected",
	);

	const fundCustomerB = await admin.request(
		"POST",
		`/api/admin/points/customers/${customerB.customerId}/adjustments`,
		{
			locationId: locationA,
			quantity: 1000,
			reason: "Seed exact balance for race",
			idempotencyKey: randomKey("adjust-customer-b"),
		},
	);
	assert(fundCustomerB.ok, `Funding customer B failed: ${JSON.stringify(fundCustomerB.json)}`);

	const customerBPointsBefore = await customerB.session.request("GET", "/api/customer/points");
	assert(customerBPointsBefore.ok, "Customer B points fetch failed");
	assert(customerBPointsBefore.json?.data?.summary?.availableBalance === 1000, "Customer B should start with 1000 points");

	const keyA = randomKey("race-a");
	const keyB = randomKey("race-b");
	const [raceA, raceB] = await Promise.all([
		customerB.session.request("POST", `/api/customer/points/redeem/${catalogueItemId}`, {
			requestIdempotencyKey: keyA,
		}),
		customerB.session.request("POST", `/api/customer/points/redeem/${catalogueItemId}`, {
			requestIdempotencyKey: keyB,
		}),
	]);

	const successCount = [raceA, raceB].filter((res) => res.status === 200).length;
	const conflictCount = [raceA, raceB].filter((res) => res.status === 409).length;
	assert(successCount === 1, `Concurrent redemption should have exactly one success, got ${successCount}`);
	assert(conflictCount === 1, `Concurrent redemption should have exactly one 409 conflict, got ${conflictCount}`);

	const customerBPointsAfter = await customerB.session.request("GET", "/api/customer/points");
	assert(customerBPointsAfter.ok, "Customer B points fetch after race failed");
	assert(
		customerBPointsAfter.json?.data?.summary?.availableBalance === 0,
		"Customer B final available balance must be exactly 0",
	);

	const redemptionRows = d1Count(
		`SELECT COUNT(*) as value FROM points_redemptions WHERE customer_id = '${customerB.customerId}'`,
	);
	const customerRewardRows = d1Count(
		`SELECT COUNT(*) as value FROM customer_rewards WHERE customer_id = '${customerB.customerId}' AND issuance_key LIKE 'points-redeem:%'`,
	);
	const rawBalanceRow = d1First(
		`SELECT COALESCE(SUM(quantity), 0) as value FROM loyalty_transactions WHERE customer_id = '${customerB.customerId}' AND program_id = '${programId}'`,
	);
	const rawBalance = Number(rawBalanceRow.value);

	assert(redemptionRows === 1, `Expected exactly one points_redemptions row, found ${redemptionRows}`);
	assert(customerRewardRows === 1, `Expected exactly one customer_rewards points row, found ${customerRewardRows}`);
	assert(rawBalance === 0, `Expected final raw balance 0, found ${rawBalance}`);

	const activity = await admin.request("GET", "/api/admin/points/activity");
	const report = await admin.request("GET", "/api/admin/points/report");
	assert(activity.ok, "Admin points activity failed");
	assert(report.ok, "Admin points report failed");

	console.log("[points-smoke] PASS");
	console.log(`- customerB redemption rows: ${redemptionRows}`);
	console.log(`- customerB reward rows: ${customerRewardRows}`);
	console.log(`- customerB final raw balance: ${rawBalance}`);
}

main().catch((error) => {
	console.error("[points-smoke] FAIL");
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
