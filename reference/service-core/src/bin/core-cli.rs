// SPDX-License-Identifier: Apache-2.0
// The service core's entry point on the command line, for tests: `core-cli <function>`
// reads the JSON input on stdin and prints the JSON output (as the WebAssembly `call`).
use std::io::Read;
fn main() {
    let name = std::env::args().nth(1).unwrap_or_default();
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    println!("{}", poo_service_core::call(&name, &input));
}
