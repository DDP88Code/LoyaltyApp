import { execSync } from "node:child_process";
import http from "node:http";

const ORIGIN = "http://localhost:5173";
const PASSWORD = "CoffeeBeans2026";
const STAMP = Date.now();
const STOP_AFTER = process.env.ACCOUNT_DELETION_SMOKE_STOP_AFTER ?? "";

function progress(step, details) {
	if (details === undefined) {
		console.log(`[account-deletion-smoke] ${step}`);
		return;
	}
	console.log(`[account-deletion-smoke] ${step}: ${details}`);
}

function maybeStop(step) {
	if (STOP_AFTER === step) {
		console.log(`[account-deletion-smoke] STOP_AFTER reached at ${step}`);
		process.exit(0);
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function idKey(prefix) {
	return `${prefix}-${STAMP}-${Math.random().toString(36).slice(2, 10)}`;
}

function runD1(sql) {
	const command = `npx wrangler d1 execute fives-rewards-db --local --command ${JSON.stringify(sql)} --json`;
	const stdout = execSync(command, { encoding: "utf8" });
	const parsed = JSON.parse(stdout);
	return Array.isArray(parsed) ? parsed[0] : parsed;
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
			body: response.body,
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
	assert(relogin.ok, `Failed to sign in ${email}`);
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

async function getCustomerRewards(session) {
	const rewards = await session.request("GET", "/api/customer/rewards");
	assert(rewards.ok, `Failed loading customer rewards: ${JSON.stringify(rewards.json)}`);
	return rewards.json?.data;
}

function welcomeRewardCount(rewardsPayload) {
	const all = [
		...(rewardsPayload?.available ?? []),
		...(rewardsPayload?.redeemed ?? []),
		...(rewardsPayload?.expired ?? []),
	];
	return all.filter((reward) => reward.rewardType === "voucher" && Number(reward.valueCents) === 5000).length;
}

function tableCountsForCustomer(customerId, authUserId) {
	const query = [
		"SELECT",
		`(SELECT COUNT(*) FROM profiles WHERE id='${customerId}') AS profiles,`,
		`(SELECT COUNT(*) FROM user WHERE id='${authUserId}') AS authUsers,`,
		`(SELECT COUNT(*) FROM session WHERE user_id='${authUserId}') AS sessions,`,
		`(SELECT COUNT(*) FROM account WHERE user_id='${authUserId}') AS accounts,`,
		`(SELECT COUNT(*) FROM customer_rewards WHERE customer_id='${customerId}') AS customerRewards,`,
		`(SELECT COUNT(*) FROM loyalty_transactions WHERE customer_id='${customerId}') AS loyaltyTransactions,`,
		`(SELECT COUNT(*) FROM points_awards WHERE customer_id='${customerId}') AS pointsAwards,`,
		`(SELECT COUNT(*) FROM bill_events WHERE customer_id='${customerId}') AS billEvents,`,
		`(SELECT COUNT(*) FROM item_campaign_transactions WHERE customer_id='${customerId}') AS itemCampaignTransactions,`,
		`(SELECT COUNT(*) FROM item_campaign_reward_issuances WHERE customer_id='${customerId}') AS itemCampaignRewardIssuances,`,
		`(SELECT COUNT(*) FROM points_redemptions WHERE customer_id='${customerId}') AS pointsRedemptions,`,
		`(SELECT COUNT(*) FROM notifications WHERE customer_id='${customerId}') AS notifications,`,
		`(SELECT COUNT(*) FROM push_subscriptions WHERE customer_id='${customerId}') AS pushSubscriptions,`,
		`(SELECT COUNT(*) FROM loyalty_codes WHERE customer_id='${customerId}') AS loyaltyCodes`,
	].join(" ");

	const row = d1First(query);

	return {
		profiles: Number(row.profiles ?? 0),
		authUsers: Number(row.authUsers ?? 0),
		sessions: Number(row.sessions ?? 0),
		accounts: Number(row.accounts ?? 0),
		customerRewards: Number(row.customerRewards ?? 0),
		loyaltyTransactions: Number(row.loyaltyTransactions ?? 0),
		pointsAwards: Number(row.pointsAwards ?? 0),
		billEvents: Number(row.billEvents ?? 0),
		itemCampaignTransactions: Number(row.itemCampaignTransactions ?? 0),
		itemCampaignRewardIssuances: Number(row.itemCampaignRewardIssuances ?? 0),
		pointsRedemptions: Number(row.pointsRedemptions ?? 0),
		notifications: Number(row.notifications ?? 0),
		pushSubscriptions: Number(row.pushSubscriptions ?? 0),
		loyaltyCodes: Number(row.loyaltyCodes ?? 0),
	};
}

async function main() {
	await new Session().request("POST", "/api/dev/seed");
	progress("seed_complete");

	const admin = await ensureUserWithRole(
		`delete.admin.${STAMP}@example.test`,
		"Delete Admin",
		"admin",
	);
	const staff = await ensureUserWithRole(
		`delete.staff.${STAMP}@example.test`,
		"Delete Staff",
		"staff",
	);

	const staffContext = await staff.request("GET", "/api/staff/context");
	assert(staffContext.ok, `Failed to load staff context: ${JSON.stringify(staffContext.json)}`);
	const locationId = staffContext.json?.data?.locations?.[0]?.id;
	assert(typeof locationId === "string" && locationId.length > 0, "No active location found");

	const businessId = d1First("SELECT id FROM businesses WHERE slug='fives-pub-and-grill' LIMIT 1").id;
	assert(typeof businessId === "string", "Business id not found");

	const programEnable = await admin.request("PATCH", "/api/admin/points/program", {
		active: true,
		earnRatePoints: 10,
		earnRateSpendCents: 100,
		name: "Reward Points",
	});
	assert(programEnable.ok, `Failed to enable points program: ${programEnable.body}`);

	// 1. Fresh customer with no loyalty activity can be deleted.
	const fresh = await registerCustomer("Delete Fresh", `delete.fresh.${STAMP}@example.test`);
	const freshProfile = d1First(`SELECT auth_user_id FROM profiles WHERE id='${fresh.customerId}'`);
	const freshAuthUserId = freshProfile.auth_user_id;
	const freshDelete = await fresh.session.request("DELETE", "/api/customer/account");
	assert(freshDelete.ok, `Fresh account deletion failed: ${freshDelete.body}`);
	const freshAfter = tableCountsForCustomer(fresh.customerId, freshAuthUserId);
	assert(freshAfter.profiles === 0, "Fresh profile should be removed");
	assert(freshAfter.authUsers === 0, "Fresh auth user should be removed");
	progress("scenario_fresh_delete_ok");
	maybeStop("fresh-delete");

	const control = await registerCustomer("Delete Control", `delete.control.${STAMP}@example.test`);
	const controlMeBefore = await control.session.request("GET", "/api/me");
	assert(controlMeBefore.ok, "Control account should be active before delete test");

	const targetEmail = `delete.target.${STAMP}@example.test`;
	const target = await registerCustomer("Delete Target", targetEmail);

	// 3, 10, 12 prep: welcome reward + claim marker + birthday persisted.
	const mobile = `06${String(STAMP % 100000000).padStart(8, "0")}`;
	const profilePatch = await target.session.request("PATCH", "/api/customer/profile", {
		mobileNumber: mobile,
		birthday: "1990-01-01",
	});
	assert(profilePatch.ok, `Target profile update failed: ${profilePatch.body}`);
	const rewardsAfterProfile = await getCustomerRewards(target.session);
	assert(welcomeRewardCount(rewardsAfterProfile) === 1, "Welcome reward should be issued once");
	progress("target_profile_patch_ok");

	// 8. QR/OTP
	const loyaltyCode = await target.session.request("POST", "/api/customer/loyalty-code", {});
	assert(loyaltyCode.ok, `Failed to create loyalty code: ${loyaltyCode.body}`);

	// 8, 9. Push subscription records; notifications are produced by reward flows below.
	const pushUpsert = await target.session.request("POST", "/api/customer/push/subscriptions", {
		endpoint: `https://example.test/push/${STAMP}`,
		p256dhKey: "p256dh-test-key",
		authKey: "auth-test-key",
		deviceLabel: "Delete smoke device",
	});
	assert(pushUpsert.ok, `Failed creating push subscription: ${pushUpsert.body}`);
	progress("target_push_subscription_ok");

	// 11. Coffee history
	const coffeeEarn = await staff.request("POST", `/api/staff/customers/${target.customerId}/coffee`, {
		locationId,
		quantity: 1,
		billReference: `DEL-COFFEE-${STAMP}`,
		idempotencyKey: idKey("coffee"),
	});
	assert(coffeeEarn.ok, `Failed to create coffee history: ${coffeeEarn.body}`);
	progress("target_coffee_history_ok");

	// 2, 5. Reward points + bill event
	const pointsAward = await staff.request("POST", `/api/staff/points/customers/${target.customerId}/award`, {
		locationId,
		eligibleSpendRand: "500.00",
		billReference: `DEL-PTS-${STAMP}`,
		requestIdempotencyKey: idKey("award"),
	});
	assert(pointsAward.ok, `Failed to create points award: ${pointsAward.body}`);
	assert(
		Number(pointsAward.json?.data?.totalPoints ?? 0) > 0,
		`Expected positive points award total. Got: ${JSON.stringify(pointsAward.json)}`,
	);
	progress("target_points_award_ok", `totalPoints=${pointsAward.json?.data?.totalPoints ?? 0}`);

	// 4. Points catalogue claim history
	const pointsRewardDef = await admin.request("POST", "/api/admin/rewards", {
		name: `Delete Points Voucher ${STAMP}`,
		description: "Deletion regression points voucher",
		rewardType: "voucher",
		valueCents: 1500,
		validDays: 30,
		active: true,
		welcomeReward: false,
		terms: "Delete smoke",
	});
	assert(pointsRewardDef.ok, `Failed to create points reward definition: ${pointsRewardDef.body}`);
	const pointsRewardDefId = pointsRewardDef.json?.data?.id;
	assert(typeof pointsRewardDefId === "string", "Points reward definition id missing");

	const catalogueCreate = await admin.request("POST", "/api/admin/points/catalogue", {
		rewardDefinitionId: pointsRewardDefId,
		pointsCost: 10,
		active: true,
		sortOrder: 0,
		imageKey: null,
	});
	assert(catalogueCreate.ok, `Failed to create points catalogue item: ${catalogueCreate.body}`);
	const catalogueItemId = catalogueCreate.json?.data?.id;
	assert(typeof catalogueItemId === "string", "Points catalogue item id missing");

	const redeem = await target.session.request("POST", `/api/customer/points/redeem/${catalogueItemId}`, {
		requestIdempotencyKey: idKey("redeem"),
	});
	assert(redeem.ok, `Failed to redeem points catalogue item: ${redeem.body}`);
	progress("target_points_redeem_ok");
	maybeStop("points-redeem");

	// 6, 7. Item Campaign purchase + reward issuance
	const campaignRewardDef = await admin.request("POST", "/api/admin/rewards", {
		name: `Delete Campaign Reward ${STAMP}`,
		description: "Deletion regression campaign reward",
		rewardType: "free_item",
		itemReference: `DEL-CAMP-ITEM-${STAMP}`,
		validDays: 30,
		active: true,
		welcomeReward: false,
		terms: "Delete smoke",
	});
	assert(campaignRewardDef.ok, `Failed to create campaign reward definition: ${campaignRewardDef.body}`);
	const campaignRewardDefId = campaignRewardDef.json?.data?.id;
	assert(typeof campaignRewardDefId === "string", "Campaign reward definition id missing");

	const now = new Date();
	const startAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
	const endAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

	const campaignCreate = await admin.request("POST", "/api/admin/points/campaigns", {
		name: `Delete Campaign ${STAMP}`,
		description: "Deletion regression campaign",
		itemReference: `DEL-CAMP-${STAMP}`,
		unitPriceCents: 1000,
		targetQuantity: 2,
		rewardDefinitionId: campaignRewardDefId,
		earnsRewardPoints: false,
		status: "active",
		startAt,
		endAt,
		maxQuantityPerBill: 10,
		sortOrder: 1,
	});
	assert(campaignCreate.ok, `Failed to create item campaign: ${campaignCreate.body}`);
	const campaignId = campaignCreate.json?.data?.id;
	assert(typeof campaignId === "string", "Campaign id missing");

	const campaignBill = await staff.request("POST", `/api/staff/points/customers/${target.customerId}/bill`, {
		locationId,
		billTotalRand: "20.00",
		otherExcludedSpendRand: "0.00",
		billReference: `DEL-CAMP-BILL-${STAMP}`,
		requestIdempotencyKey: idKey("campaign-bill"),
		campaignLines: [{ campaignId, quantity: 2 }],
	});
	assert(campaignBill.ok, `Failed to create campaign purchase/issuance: ${campaignBill.body}`);
	progress("target_campaign_purchase_and_issuance_ok");
	maybeStop("campaign-issuance");

	const targetProfile = d1First(`SELECT auth_user_id FROM profiles WHERE id='${target.customerId}'`);
	const targetAuthUserId = targetProfile.auth_user_id;
	const targetBefore = tableCountsForCustomer(target.customerId, targetAuthUserId);

	assert(targetBefore.loyaltyTransactions > 0, "Expected loyalty transaction history before delete");
	assert(targetBefore.customerRewards > 0, "Expected customer rewards before delete");
	assert(targetBefore.pointsRedemptions > 0, "Expected points redemption history before delete");
	assert(targetBefore.pointsAwards > 0, "Expected points awards before delete");
	assert(targetBefore.billEvents > 0, "Expected bill events before delete");
	assert(targetBefore.itemCampaignTransactions > 0, "Expected campaign transactions before delete");
	assert(targetBefore.itemCampaignRewardIssuances > 0, "Expected campaign reward issuances before delete");
	assert(targetBefore.loyaltyCodes > 0, "Expected loyalty code rows before delete");
	assert(targetBefore.notifications > 0, "Expected notifications before delete");
	assert(targetBefore.pushSubscriptions > 0, "Expected push subscriptions before delete");
	progress("target_pre_delete_counts_ok", JSON.stringify(targetBefore));

	const deleteResponse = await target.session.request("DELETE", "/api/customer/account");
	assert(deleteResponse.ok, `Target account deletion failed: ${deleteResponse.body}`);
	progress("target_delete_call_ok");

	const deletedMe = await target.session.request("GET", "/api/me");
	assert(deletedMe.status === 401, "Deleted customer session should be invalid");

	const targetAfter = tableCountsForCustomer(target.customerId, targetAuthUserId);
	assert(targetAfter.profiles === 0, "Profile should be removed");
	assert(targetAfter.authUsers === 0, "Auth user should be removed");
	assert(targetAfter.sessions === 0, "Sessions should be removed");
	assert(targetAfter.accounts === 0, "Accounts should be removed");
	assert(targetAfter.customerRewards === 0, "Customer rewards should be removed");
	assert(targetAfter.loyaltyTransactions === 0, "Loyalty transactions should be removed");
	assert(targetAfter.pointsAwards === 0, "Points awards should be removed");
	assert(targetAfter.billEvents === 0, "Bill events should be removed");
	assert(targetAfter.itemCampaignTransactions === 0, "Item campaign transactions should be removed");
	assert(targetAfter.itemCampaignRewardIssuances === 0, "Item campaign reward issuances should be removed");
	assert(targetAfter.pointsRedemptions === 0, "Points redemption records should be removed");
	assert(targetAfter.notifications === 0, "Notifications should be removed");
	assert(targetAfter.pushSubscriptions === 0, "Push subscriptions should be removed");
	assert(targetAfter.loyaltyCodes === 0, "Loyalty codes should be removed");
	progress("target_post_delete_counts_ok", JSON.stringify(targetAfter));

	const fkCheck = runD1("PRAGMA foreign_key_check");
	const fkRows = fkCheck?.results ?? [];
	assert(fkRows.length === 0, `Foreign key check returned violations: ${JSON.stringify(fkRows)}`);

	// 12. Anti-abuse marker remains and blocks repeat welcome issuance.
	const rejoin = await registerCustomer("Delete Target", targetEmail);
	const rejoinPatch = await rejoin.session.request("PATCH", "/api/customer/profile", {
		mobileNumber: mobile,
	});
	assert(rejoinPatch.ok, `Rejoin profile update failed: ${rejoinPatch.body}`);
	const rejoinRewards = await getCustomerRewards(rejoin.session);
	assert(
		welcomeRewardCount(rejoinRewards) === 0,
		"Welcome reward should not be reissued after account deletion for same identity",
	);
	progress("target_anti_abuse_rejoin_ok");

	const plainClaimRowCount = d1Count(
		`SELECT COUNT(*) AS value FROM welcome_reward_claims WHERE business_id='${businessId}' AND (identity_hash='${targetEmail.toLowerCase()}' OR identity_hash='${mobile}')`,
	);
	assert(plainClaimRowCount === 0, "Welcome claim marker must remain pseudonymous (hashed)");

	// 16. Other customers remain unaffected.
	const controlMeAfter = await control.session.request("GET", "/api/me");
	assert(controlMeAfter.ok, "Control account should remain unaffected");
	progress("control_customer_unaffected_ok");

	console.log("[account-deletion-smoke] PASS");
	console.log(
		JSON.stringify(
			{
				targetBefore,
				targetAfter,
				rejoinWelcomeCount: welcomeRewardCount(rejoinRewards),
				controlEmail: controlMeAfter.json?.data?.user?.email ?? null,
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error("[account-deletion-smoke] FAIL");
	console.error(error?.stack ?? String(error));
	process.exit(1);
});
