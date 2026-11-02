// Writes dist/.well-known/assetlinks.json at build time, so Android trusts this
// domain for the YNeet Play Store app (the app then opens full screen, with no
// browser address bar).
//
// Railway variables (same on app.yneet.in and www.yneet.in):
//   ANDROID_PACKAGE                 default "in.yneet.app"
//   ANDROID_SHA256_FINGERPRINTS     comma-separated SHA-256 fingerprints, from
//                                   Play Console → Test and release → App integrity
//                                   → App signing (app signing key + upload key)
// Changing a variable triggers a rebuild, so no code change is needed later.
import fs from "node:fs";
import path from "node:path";

export default function assetLinks() {
  let outDir = "dist";
  return {
    name: "yneet-assetlinks",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const pkg = (process.env.ANDROID_PACKAGE || "in.yneet.app").trim();
      const prints = (process.env.ANDROID_SHA256_FINGERPRINTS || "")
        .split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
      const body = prints.length
        ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints } }]
        : [];
      const dir = path.resolve(outDir, ".well-known");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "assetlinks.json"), JSON.stringify(body, null, 2));
    },
  };
}
