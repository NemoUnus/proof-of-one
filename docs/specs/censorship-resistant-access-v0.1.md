# Access under network restrictions — specification v0.1

*Authors: Ostrakon and Prosopon (AI agents), with Argus and Themis (AI agents). Implements Decision Log #34, raised by the founder, Nemo Unus. Status: design. Not audited.*

The people who most need a verifiable, private poll often live where access to such a service is restricted: app stores are unavailable, websites are blocked, and some services refuse connections from certain countries or from VPNs. Proof of One must keep working there. Its rule is that **using an ordinary VPN or circumvention tool never breaks enrolment or voting**, and that people without one still get through.

## 1. Requirements

| # | Requirement | How |
|---|---|---|
| A1 | **Never block VPN, Tor or proxy users** | Relays, the enrolment service and archive gateways accept connections from any network, without IP reputation checks, geographic blocking or CAPTCHAs tied to location. |
| A2 | **Circumvention built in** | The app includes Tor with several pluggable transports (for example Snowflake, obfs4 and WebTunnel), tried in turn. A user who already has a VPN can rely on it instead. The app also supports a user-configured proxy. |
| A3 | **No dependency on Google or Apple servers for core functions** | Device integrity is checked with **hardware key attestation**, whose certificate chain the enclave can verify offline, not with services that need Google or Apple servers at the time of use. No Google or Apple account, phone number, SMS or e-mail is required. |
| A4 | **Several ways to get the app** | Android: signed packages published in several independent places (the code repository, an open-source app store such as F-Droid, and mirrors), with the signing-key fingerprint published in several places so that counterfeit apps can be detected. iOS has fewer options and is listed as a limitation. |
| A5 | **Signed, updatable endpoint list** | Addresses of relays and services are distributed as a signed list through several channels. When an address is blocked, the app fetches a new list. Old addresses keep working where they can. |
| A6 | **Tolerant of poor connections** | Ballots are prepared offline and submitted when a connection is available (polls stay open at least 48 hours). Enrolment resumes after an interruption instead of starting again. Proving keys ship with the app, so voting downloads almost nothing. |
| A7 | **Several independent relays and gateways** | Ballots and ledger reads go through several independent relays and archive gateways, reachable over Tor. A member can always submit directly. |
| A8 | **Low-profile presence on the phone** | Duress PIN, no history of polls answered (whitepaper §9.3), network traffic that looks like ordinary Tor or VPN use, and an app name and icon the member may change. Themis and Argus review the residual risk of simply having the app installed. |

## 2. Limits

- **iOS distribution** depends on app-store availability in each region. A web version cannot replace the app, because browsers cannot read the chip of an identity document.
- **No circumvention method works everywhere or forever.** The design relies on several transports and on the wider circumvention community, and is reviewed as conditions change.
- **Having the app installed may itself be a risk** in some places. This is a participant-safety question (whitepaper §14) that needs human expert review before any use in high-risk settings.

## 3. Wording

Following Decision #2, public texts describe this as access from "networks with restricted access" and do not name governments.

— Ostrakon, Prosopon, Argus and Themis (AI agents, Proof of One)
