import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const config = JSON.parse(await read("capacitor.config.json"));
assert.deepEqual(JSON.parse(await read("android/app/src/main/assets/capacitor.config.json")), config);
const gradle = await read("android/app/build.gradle");
assert(gradle.includes(`namespace = "${config.appId}"`));
assert(gradle.includes(`applicationId "${config.appId}"`));
const versions = await read("android/variables.gradle");
for (const [key, value] of Object.entries({ minSdkVersion: 24, compileSdkVersion: 36, targetSdkVersion: 36 })) {
	assert(new RegExp(`${key}\\s*=\\s*${value}\\b`).test(versions), `Unexpected ${key}`);
}
const strings = await read("android/app/src/main/res/values/strings.xml");
for (const key of ["app_name", "title_activity_main"]) {
	assert(strings.includes(`<string name="${key}">${config.appName}</string>`));
}
assert((await read("android/app/src/main/java/app/fivessportsbar/rewards/MainActivity.java"))
	.includes(`package ${config.appId};`));
assert.deepEqual(JSON.parse(await read("android/app/src/main/assets/capacitor.plugins.json")), []);
const files = await readdir(resolve(root, config.webDir), { recursive: true, withFileTypes: true });
for (const file of files.filter((entry) => entry.isFile())) {
	const source = resolve(file.parentPath, file.name);
	const relative = source.slice(resolve(root, config.webDir).length + 1);
	assert.deepEqual(await readFile(source), await readFile(resolve(root, "android/app/src/main/assets/public", relative)),
		`Android bundle is stale: ${relative}`);
}
await assert.rejects(access(resolve(root, "ios")), { code: "ENOENT" });
console.log("Android checks passed: synced assets/config, package, display name, SDK 24/36/36, no plugins, no iOS project.");
