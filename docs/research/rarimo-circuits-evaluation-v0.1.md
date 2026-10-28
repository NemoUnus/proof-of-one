# Reusing Rarimo's passport circuits? Evaluation v0.1

*Authors: Kryptos and Prosopon (AI agents). Schedule task 0.6-08. Status: desk review of public source code, 27 October 2026; nothing was compiled or run. Not a security review of Rarimo's system.*

## 1. Question

Proof of One's document-validity proof π_doc ([spec](../specs/document-validity-proof-v0.1.md)) supports one signature suite: RSA-2048, PKCS#1 v1.5, SHA-256. Real passports use many more. Rarimo, whose Freedom Tool runs private polls with biometric passports ([landscape review §3.3](landscape-review-v0.2.md)), publishes circuits that cover many of them. Should we reuse them instead of writing each suite ourselves?

## 2. What was reviewed

| Repository | State reviewed | Licence |
|---|---|---|
| [rarimo/passport-zk-circuits](https://github.com/rarimo/passport-zk-circuits) (Circom) | Latest commit of 2 July 2026 | MIT |
| [rarimo/passport-contracts](https://github.com/rarimo/passport-contracts) (Solidity; generated Noir verifiers) | Latest commit of 11 September 2026 | MIT |

The Circom repository includes a Halborn audit report dated 16 March 2024, which covers an earlier version.

## 3. Findings

**Same architecture as π_doc.** Rarimo's circuits do what π_doc does, in the same order:

1. Hash the data groups and compare them with the hashes in the security object.
2. Hash the security object and compare it with the signed attributes.
3. Verify the document signer's signature.
4. Prove that the signer's key is a leaf of a public tree of checked signers.

Like us, they pad the hashed data outside the circuit and fix byte offsets ("shifts") as compile-time parameters. As a result, each combination of document layout and signature suite becomes its own circuit, with its own setup and verifier. The contracts repository lists dozens of generated verifiers.

**Much wider coverage.** The signature templates cover:

- RSA PKCS#1 v1.5: 2048 and 4096 bits with SHA-256; 2048 bits with SHA-1; 3072 bits with SHA-1 and a non-standard exponent.
- RSA-PSS: 2048 and 4096 bits with SHA-256; SHA-384 variants.
- ECDSA: P-256, P-224, secp192, brainpoolP256r1, brainpoolP320r1 and brainpoolP384r1.

Hashing covers SHA-1, SHA-224, SHA-256, SHA-384 and SHA-512, and both TD3 (passport) and TD1 (ID card) layouts are handled. The circuits also commit to the Active Authentication key in DG15. The matching signature is checked by the contract, not in the circuit.

**The production path has moved to Noir.** The current contracts carry generated Noir (UltraHonk) verifiers, and their changelog lists many new Noir passport circuits. The Circom repository appears to be the earlier generation; their Noir circuits are in [rarimo/passport-zk-circuits-noir](https://github.com/rarimo/passport-zk-circuits-noir).

**One open question, raised privately first.** We have a question about how the register circuits (Circom and Noir) derive the signer-tree leaf. It does not concern Proof of One's code: π_doc's leaf binds every limb of the signer's key. Because the code is public and appears to be in use, the founder will raise it privately with Rarimo's maintainers before we write about it here.

## 4. Assessment

| Option | For | Against |
|---|---|---|
| A. Vendor Rarimo's Circom circuits as a whole | Widest coverage at once; MIT licence | Their identity model (one identity per passport, reissuable) and tree layout differ from ours; the Circom code is no longer their production path; every reused circuit would still need our own review for missing constraints |
| **B. Reuse templates selectively (recommended)** | Their ECDSA, RSA-PSS and SHA-1/384/512 templates are the fastest route to the suites the trust list shows we need. Our circuit structure, tree and attribute outputs stay unchanged | Each template must be read, tested with our attack cases and credited; mixed sources to maintain |
| C. Write every suite ourselves | Full control | Slow; repeats work that already exists and has had at least one audit |
| D. Move π_doc to Noir | Matches Rarimo's and ZKPassport's current direction and our aggregation prototype (Decision Log #29) | A rewrite of π_doc; to be decided with the setup choice (issue #7, schedule 1.1) |

**Recommendation: B now, D as an open question for schedule 1.1.**

- Add suites in the order the measured coverage requires, once document-signer certificates are collected ([trust list §4](../specs/trust-list-v0.1.md)). The expected order is ECDSA P-256 and brainpoolP256r1 first, then RSA-PSS, then RSA-4096.
- For each suite, take Rarimo's template as the starting point under its MIT licence, keep its copyright notice, and record it in PROVENANCE.md.
- Run our existing attack tests on each suite (altered data, wrong signer, untrusted signer, leaf of another signer) before it is accepted.
- Keep the rule that the signer-tree leaf binds the whole key, whatever the suite.

## 5. Also worth borrowing

- **Test data.** Their test helper turns a passport read into JSON circuit inputs, and records which offsets differ between issuers. Reusing that knowledge, though not real passport data, would make our synthetic documents more realistic.
- **Active Authentication.** They commit to the DG15 key in the proof and check the challenge signature outside the circuit. Our own question about chip cloning (whether chip authentication can be used without revealing a linkable chip key) is listed in the [document-validity proof §6](../specs/document-validity-proof-v0.1.md).

— Kryptos and Prosopon (AI agents, Proof of One)
