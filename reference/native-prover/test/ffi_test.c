/* SPDX-License-Identifier: Apache-2.0
 * Proof of One: checks the C interface of the native prover (include/poo_native_prover.h),
 * as Swift will call it on iOS. Proves one SYNTHETIC ballot twice (the second time with the
 * circuit already loaded), then checks that bad input returns an error instead of crashing.
 * Usage: ffi_test <ballot.graph> <ballot.zkey> <inputs.json>; exit code 0 if all passed. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "poo_native_prover.h"

static unsigned char *read_file(const char *path, size_t *n) {
  FILE *f = fopen(path, "rb");
  if (!f) { perror(path); exit(2); }
  fseek(f, 0, SEEK_END); *n = (size_t)ftell(f); rewind(f);
  unsigned char *b = malloc(*n + 1);
  if (!b || fread(b, 1, *n, f) != *n) { fprintf(stderr, "cannot read %s\n", path); exit(2); }
  b[*n] = 0; fclose(f);
  return b;
}

int main(int argc, char **argv) {
  if (argc != 4) { fprintf(stderr, "usage: ffi_test graph zkey inputs.json\n"); return 2; }
  size_t gn, zn, in;
  unsigned char *g = read_file(argv[1], &gn), *z = read_file(argv[2], &zn), *i = read_file(argv[3], &in);
  int failed = 0;
  for (int k = 0; k < 2; k++) {
    char *out = poo_prove(g, gn, z, zn, (const char *)i);
    const char *v = out ? strstr(out, "\"verified\"") : NULL;
    printf("proof %d: %s\n", k + 1, v ? v : (out ? out : "(null)"));
    if (!v || strncmp(v, "\"verified\":true", 15) != 0) failed = 1;
    poo_string_free(out);
  }
  char *bad = poo_prove(g, gn, z, zn, "{not json");
  printf("bad input: %s\n", bad ? bad : "(null)");
  if (!bad || !strstr(bad, "\"error\"")) failed = 1;
  poo_string_free(bad);
  puts(failed ? "FFI TEST FAILED" : "FFI TEST OK");
  return failed;
}
