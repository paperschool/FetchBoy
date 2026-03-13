// Prevents extra console window on Windows in release. DO NOT REMOVE.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // App bootstrap delegates to library setup so runtime wiring is centralized in lib.rs.
    fetch_boy::run()
}
