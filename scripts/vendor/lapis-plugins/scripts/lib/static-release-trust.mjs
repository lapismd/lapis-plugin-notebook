import { createPublicKey } from "node:crypto";

// Must match the installed app's pinned release key and the retained V1 trust root.
export const staticReleaseKeys = {
  "lapis-plugin-release-2026-06":
    "bMPnlO7b+Xtthfk5wGUQAWWUV7NuIAhED4kX2EGzJqc=",
};

export function assertStaticReleaseKey(keyId, privateKeyPem) {
  const publicKey = createPublicKey(privateKeyPem);
  const raw = publicKey
    .export({ format: "der", type: "spki" })
    .subarray(-32)
    .toString("base64");
  if (
    publicKey.asymmetricKeyType !== "ed25519" ||
    staticReleaseKeys[keyId] !== raw
  )
    throw new Error(
      "The signing key does not match the app's pinned static release trust root."
    );
}
