use super::*;

#[test]
fn preserves_integer_precision_and_number_kinds() {
    let value: Value = from_str(r#"[18446744073709551615,-9223372036854775808,1.0,-0.0]"#).unwrap();
    let values = value.as_array().unwrap();
    assert_eq!(values[0].as_u64(), Some(u64::MAX));
    assert_eq!(values[0].as_i64(), None);
    assert_eq!(values[1].as_i64(), Some(i64::MIN));
    assert_eq!(values[1].as_u64(), None);
    assert_eq!(values[2].as_i64(), None);
    assert!(values[3].as_f64().unwrap().is_sign_negative());
    assert_eq!(
        value.to_string(),
        r#"[18446744073709551615,-9223372036854775808,1.0,-0.0]"#
    );
}

#[test]
fn preserves_object_order_and_records_duplicate_fields() {
    let value: Value = from_str(r#"{"b":1,"a":2,"b":3,"c":4}"#).unwrap();
    assert_eq!(value.to_string(), r#"{"b":3,"a":2,"c":4}"#);
    let mut map = value.as_object().unwrap().clone();
    assert!(map.has_duplicate_key("b"));
    assert!(!map.has_duplicate_key("a"));
    assert_eq!(value, json!({"b": 3, "a": 2, "c": 4}));
    assert_eq!(map.remove("b"), Some(json!(3)));
    assert_eq!(
        map.keys().map(String::as_str).collect::<Vec<_>>(),
        ["c", "a"]
    );
    assert_eq!(json!({"a": 1, "b": 2}), json!({"b": 2, "a": 1}));
    assert!(!json!({"x": 1}).as_object().unwrap().has_duplicate_key("x"));
}

#[test]
fn macro_borrows_fields_and_builds_nested_values() {
    struct Record {
        name: String,
        values: Vec<Value>,
    }
    let record = Record {
        name: "name".into(),
        values: vec![json!(42)],
    };
    let value = json!({
        "name": record.name,
        "values": record.values,
        "nested": [null, {"bool": true, "float": 1.5,}, [],],
        "optional": None::<String>,
    });
    assert_eq!(
        value.to_string(),
        r#"{"name":"name","values":[42],"nested":[null,{"bool":true,"float":1.5},[]],"optional":null}"#
    );
    assert_eq!(record.name, "name");
    assert_eq!(record.values, [json!(42)]);
    assert_eq!(json!(f64::NAN), Value::Null);
}

#[test]
fn streams_concatenated_documents_and_stops_at_errors() {
    let values = stream("{\"a\":1}[2] true invalid null").collect::<Vec<_>>();
    assert_eq!(values.len(), 4);
    assert_eq!(values[0], Ok(json!({"a": 1})));
    assert_eq!(values[1], Ok(json!([2])));
    assert_eq!(values[2], Ok(json!(true)));
    assert!(values[3].is_err());
    assert!(from_str::<Value>("{}{}").is_err());
}

#[test]
fn renders_pretty_and_raw_values_and_reports_own_errors() {
    let value = json!({"key": ["line\n\"quoted\"", null]});
    assert_eq!(to_string(&value).unwrap(), value.to_string());
    assert_eq!(
        to_string_pretty(&json!({"a": 1})).unwrap(),
        "{\n  \"a\": 1\n}"
    );
    assert_eq!(raw(&json!("line\n\"quoted\"")), "line\n\"quoted\"");
    assert_eq!(raw(&json!(false)), "false");
    assert_eq!(raw(&json!(["x", null])), "[\"x\",null]");
    let error: Error = from_str::<Value>("{\n").unwrap_err();
    assert!(error.to_string().contains("line 2 column 0"));
    assert_eq!(Error::new("own error").to_string(), "own error");
}

#[test]
fn sorted_rendering_sorts_nested_objects_without_mutating_order() {
    let value = json!({"z": [{"b": 2, "a": 1}], "a": {"d": 4, "c": 3}});
    assert_eq!(
        raw_sorted(&value),
        r#"{"a":{"c":3,"d":4},"z":[{"a":1,"b":2}]}"#
    );
    assert_eq!(
        to_string_pretty_sorted(&value).unwrap(),
        "{\n  \"a\": {\n    \"c\": 3,\n    \"d\": 4\n  },\n  \"z\": [\n    {\n      \"a\": 1,\n      \"b\": 2\n    }\n  ]\n}"
    );
    assert_eq!(
        value.to_string(),
        r#"{"z":[{"b":2,"a":1}],"a":{"d":4,"c":3}}"#
    );
    assert_eq!(raw_sorted(&json!("text")), "text");
}

#[test]
fn pointers_decode_tokens_and_require_canonical_array_indices() {
    let mut value = json!({"a/b": {"~": [{"value": 1}]}, "": true, "~1": "escaped"});
    assert_eq!(value.pointer(""), Some(&value));
    assert_eq!(value.pointer("/"), Some(&json!(true)));
    assert_eq!(value.pointer("/~01"), Some(&json!("escaped")));
    assert_eq!(value.pointer("/a~1b/~0/0/value"), Some(&json!(1)));
    for pointer in [
        "a~1b/~0/0/value",
        "/a~1b/~0/+0",
        "/a~1b/~0/00",
        "/a~1b/~0/-",
        "/a~1b/~0/1",
        "/a~1b/~0/18446744073709551616",
        "/a~1b/~0/0/value/missing",
    ] {
        assert_eq!(value.pointer(pointer), None, "{pointer}");
    }
    let first = &mut value
        .get_mut("a/b")
        .unwrap()
        .get_mut("~")
        .unwrap()
        .as_array_mut()
        .unwrap()[0];
    *first.as_object_mut().unwrap().get_mut("value").unwrap() = json!(2);
    assert_eq!(value.pointer("/a~1b/~0/0/value"), Some(&json!(2)));
}
