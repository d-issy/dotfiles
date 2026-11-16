//! Reproductions of JavaScript runtime behaviour that the output depends on,
//! kept so the Rust port renders exactly what the Node version did.

mod date;
mod json;
mod string;

pub use date::date_parse;
pub use json::{number_to_string, property_order, stringify};
pub use string::{basename, is_whitespace, locale_compare, pad_start, slice_utf16, trim, trim_end};
