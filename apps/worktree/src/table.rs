use std::fmt::Write;

/// Columns padded to the widest cell (header included), two spaces apart; the
/// last column is not padded.
pub fn render<const N: usize>(header: [&str; N], rows: &[[String; N]]) -> String {
    let mut widths = header.map(|cell| cell.chars().count());
    for row in rows {
        for (width, cell) in widths.iter_mut().zip(row) {
            *width = (*width).max(cell.chars().count());
        }
    }
    let header = header.map(str::to_string);
    let mut out = String::new();
    for row in std::iter::once(&header).chain(rows) {
        for (index, (cell, width)) in row.iter().zip(widths).enumerate() {
            if index + 1 == N {
                out.push_str(cell);
            } else {
                let _ = write!(out, "{cell:<width$}  ");
            }
        }
        out.push('\n');
    }
    out
}

/// The first `N` fields of `awk -F '\t'`, missing ones empty.
pub fn awk_tab_columns<const N: usize>(line: &str) -> [String; N] {
    let mut fields = line.split('\t');
    std::array::from_fn(|_| fields.next().unwrap_or_default().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pads_all_but_last_column() {
        let rows = [["main", "-", "no", "/r"].map(String::from)];
        assert_eq!(
            render(["Branch", "Window", "Managed", "Path"], &rows),
            "Branch  Window  Managed  Path\nmain    -       no       /r\n"
        );
    }

    #[test]
    fn awk_columns() {
        assert_eq!(awk_tab_columns::<3>("a\tb"), ["a", "b", ""]);
        assert_eq!(awk_tab_columns::<2>("a\tb\tc"), ["a", "b"]);
    }
}
