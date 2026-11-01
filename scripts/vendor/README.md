# Pinned distribution tooling

`lapis-plugins/` is an unmodified Apache-2.0 snapshot of the first-party archive
builder, verifier, published-asset verifier and registry image compositor.
`provenance.json` records the source commit and SHA-256 of every file. Both
standalone plugins use the same snapshot; no sibling checkout is needed.
Update these files in their upstream owner first, then refresh this snapshot
and run the archive, sender and media acceptance gates. Do not patch the snapshot.
This preserves the established static Ed25519 registry protocol.
