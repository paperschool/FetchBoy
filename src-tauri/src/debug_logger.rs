use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub type SharedDebugLogger = Arc<Mutex<DebugLogger>>;

pub struct DebugLogger {
    logs_dir: PathBuf,
    current_date: String,
    debug_writer: BufWriter<File>,
    traffic_writer: BufWriter<File>,
    write_count: u32,
}

impl DebugLogger {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        let logs_dir = app_data_dir.join("logs");
        fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs dir: {e}"))?;

        // Cleanup old logs (>7 days)
        Self::cleanup_old_logs(&logs_dir);

        let today = Self::today_str();
        let debug_writer = Self::open_log_file(&logs_dir, &format!("fetchboy-debug-{today}.log"))?;
        let traffic_writer = Self::open_log_file(&logs_dir, &format!("fetchboy-traffic-{today}.log"))?;

        Ok(Self {
            logs_dir,
            current_date: today,
            debug_writer,
            traffic_writer,
            write_count: 0,
        })
    }

    pub fn log_internal(&mut self, level: &str, source: &str, message: &str) {
        if self.check_date_rollover().is_err() {
            return;
        }
        let ts = Self::timestamp_str();
        let _ = writeln!(self.debug_writer, "[{ts}] [{level}] [{source}] {message}");
        self.maybe_flush();
    }

    pub fn log_traffic(&mut self, method: &str, url: &str, status: u16, duration_ms: i64) {
        if self.check_date_rollover().is_err() {
            return;
        }
        let ts = Self::timestamp_str();
        let _ = writeln!(self.traffic_writer, "[{ts}] {method} {url} {status} {duration_ms}ms");
        self.maybe_flush();
    }

    fn maybe_flush(&mut self) {
        self.write_count += 1;
        if self.write_count >= 10 {
            let _ = self.debug_writer.flush();
            let _ = self.traffic_writer.flush();
            self.write_count = 0;
        }
    }

    fn check_date_rollover(&mut self) -> Result<(), ()> {
        let today = Self::today_str();
        if today != self.current_date {
            let debug = Self::open_log_file(&self.logs_dir, &format!("fetchboy-debug-{today}.log"));
            let traffic = Self::open_log_file(&self.logs_dir, &format!("fetchboy-traffic-{today}.log"));
            match (debug, traffic) {
                (Ok(d), Ok(t)) => {
                    let _ = self.debug_writer.flush();
                    let _ = self.traffic_writer.flush();
                    self.debug_writer = d;
                    self.traffic_writer = t;
                    self.current_date = today;
                }
                _ => return Err(()),
            }
        }
        Ok(())
    }

    fn open_log_file(dir: &Path, name: &str) -> Result<BufWriter<File>, String> {
        let path = dir.join(name);
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("Failed to open log file {}: {e}", path.display()))?;
        Ok(BufWriter::new(file))
    }

    fn cleanup_old_logs(logs_dir: &Path) {
        let today = Self::today_str();
        let cutoff = Self::date_days_ago(7);

        let entries = match fs::read_dir(logs_dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !name.starts_with("fetchboy-") || !name.ends_with(".log") {
                continue;
            }
            // Extract date: fetchboy-debug-YYYY-MM-DD.log or fetchboy-traffic-YYYY-MM-DD.log
            if let Some(date_part) = Self::extract_date_from_filename(&name) {
                if date_part < cutoff && date_part != today {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        eprintln!("Failed to cleanup old log {}: {e}", name);
                    }
                }
            }
        }
    }

    fn extract_date_from_filename(name: &str) -> Option<String> {
        // Pattern: fetchboy-{type}-YYYY-MM-DD.log
        let without_ext = name.strip_suffix(".log")?;
        let parts: Vec<&str> = without_ext.splitn(3, '-').collect();
        if parts.len() < 3 {
            return None;
        }
        // parts[2] is like "debug-2026-03-26" or "traffic-2026-03-26"
        let rest = parts[2];
        // Find the date part (last 10 chars should be YYYY-MM-DD)
        if rest.len() >= 10 {
            let date = &rest[rest.len() - 10..];
            if date.len() == 10 && date.chars().nth(4) == Some('-') && date.chars().nth(7) == Some('-') {
                return Some(date.to_string());
            }
        }
        None
    }

    fn today_str() -> String {
        let now = time::OffsetDateTime::now_utc();
        format!("{:04}-{:02}-{:02}", now.year(), now.month() as u8, now.day())
    }

    fn timestamp_str() -> String {
        let now = time::OffsetDateTime::now_utc();
        format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
            now.year(), now.month() as u8, now.day(),
            now.hour(), now.minute(), now.second(),
            now.millisecond()
        )
    }

    fn date_days_ago(days: i64) -> String {
        let now = time::OffsetDateTime::now_utc();
        let past = now - time::Duration::days(days);
        format!("{:04}-{:02}-{:02}", past.year(), past.month() as u8, past.day())
    }
}
