/// Constructs dot JSON values from literals and borrowed Rust expressions.
#[doc(hidden)]
#[macro_export]
macro_rules! __dot_json {
    (@object $map:ident) => {};
    (@object $map:ident $key:literal : null $(, $($rest:tt)*)?) => {
        $map.insert($key.into(), $crate::json::Value::Null);
        $($crate::__dot_json!(@object $map $($rest)*);)?
    };
    (@object $map:ident $key:literal : [$($value:tt)*] $(, $($rest:tt)*)?) => {
        $map.insert($key.into(), $crate::__dot_json!([$($value)*]));
        $($crate::__dot_json!(@object $map $($rest)*);)?
    };
    (@object $map:ident $key:literal : {$($value:tt)*} $(, $($rest:tt)*)?) => {
        $map.insert($key.into(), $crate::__dot_json!({$($value)*}));
        $($crate::__dot_json!(@object $map $($rest)*);)?
    };
    (@object $map:ident $key:literal : $value:expr $(, $($rest:tt)*)?) => {
        $map.insert($key.into(), $crate::json::Value::from(&$value));
        $($crate::__dot_json!(@object $map $($rest)*);)?
    };
    (@array [$($values:expr,)*]) => { vec![$($values,)*] };
    (@array [$($values:expr,)*] null $(, $($rest:tt)*)?) => {
        $crate::__dot_json!(@array [$($values,)* $crate::json::Value::Null,] $($($rest)*)?)
    };
    (@array [$($values:expr,)*] [$($value:tt)*] $(, $($rest:tt)*)?) => {
        $crate::__dot_json!(@array [$($values,)* $crate::__dot_json!([$($value)*]),] $($($rest)*)?)
    };
    (@array [$($values:expr,)*] {$($value:tt)*} $(, $($rest:tt)*)?) => {
        $crate::__dot_json!(@array [$($values,)* $crate::__dot_json!({$($value)*}),] $($($rest)*)?)
    };
    (@array [$($values:expr,)*] $value:expr $(, $($rest:tt)*)?) => {
        $crate::__dot_json!(@array [$($values,)* $crate::json::Value::from(&$value),] $($($rest)*)?)
    };
    (null) => { $crate::json::Value::Null };
    ([]) => { $crate::json::Value::Array(Vec::new()) };
    ([$($tokens:tt)+]) => {
        $crate::json::Value::Array($crate::__dot_json!(@array [] $($tokens)+))
    };
    ({}) => { $crate::json::Value::Object($crate::json::Map::new()) };
    ({$($tokens:tt)+}) => {{
        let mut object = $crate::json::Map::new();
        $crate::__dot_json!(@object object $($tokens)+);
        $crate::json::Value::Object(object)
    }};
    ($value:expr) => { $crate::json::Value::from(&$value) };
}
