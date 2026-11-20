// SPDX-License-Identifier: Apache-2.0
// The Worker's entry point: loads the service core (core.wasm) once, then serves requests
// with service.js. No request logs (wrangler.toml: observability off).
import coreModule from "./core.wasm";
import { makeCore } from "./core.js";
import { handle } from "./service.js";

let core = null;
export default {
  fetch(request, env) {
    core ||= makeCore(coreModule);
    return handle(request, env, { core });
  },
};
