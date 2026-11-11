/* SPDX-License-Identifier: Apache-2.0
 * Proof of One native prover: C interface for Swift (iOS) and other C callers.
 * TEST-ONLY setups. See src/lib.rs, module ffi. */
#ifndef POO_NATIVE_PROVER_H
#define POO_NATIVE_PROVER_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Proves one ballot. Returns JSON {"proof":...,"public":...,"verified":bool,"loadMs":n,"proveMs":n}
 * or {"error":"..."}; release it with poo_string_free. The circuit is loaded once and kept. */
char *poo_prove(const uint8_t *graph, size_t graph_len, const uint8_t *zkey, size_t zkey_len, const char *inputs_json);
void poo_string_free(char *s);
#ifdef __cplusplus
}
#endif
#endif
