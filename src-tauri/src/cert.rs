use hudsucker::certificate_authority::RcgenAuthority;
use hudsucker::rcgen::{BasicConstraints, CertificateParams, DistinguishedName, DnType, IsCa, KeyPair};
use std::fs;
use std::path::PathBuf;

pub struct CertificateAuthority {
    authority: RcgenAuthority,
    // Used by install_to_system on non-macOS targets
    #[allow(dead_code)]
    cert_path: PathBuf,
}

impl CertificateAuthority {
    /// Load the CA from disk or generate a new one on first launch.
    pub fn load_or_create(
        app_data_dir: PathBuf,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let ca_dir = app_data_dir.join("ca");
        fs::create_dir_all(&ca_dir)?;

        let cert_path = ca_dir.join("ca.pem");
        let key_path = ca_dir.join("ca-key.pem");

        let (cert_pem, key_pem) = if cert_path.exists() && key_path.exists() {
            let cert = fs::read_to_string(&cert_path)?;
            let key = fs::read_to_string(&key_path)?;
            (cert, key)
        } else {
            let (cert, key) = Self::generate_ca_pem()?;
            fs::write(&cert_path, &cert)?;
            fs::write(&key_path, &key)?;
            (cert, key)
        };

        let key_pair = KeyPair::from_pem(&key_pem)?;
        let issuer = hudsucker::rcgen::Issuer::from_ca_cert_pem(&cert_pem, key_pair)?;
        let crypto_provider = rustls::crypto::ring::default_provider();
        let authority = RcgenAuthority::new(issuer, 1_000, crypto_provider);

        Ok(Self {
            authority,
            cert_path,
        })
    }

    /// Generate a new self-signed CA certificate and return (cert_pem, key_pem).
    fn generate_ca_pem() -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
        let key_pair = KeyPair::generate()?;
        let key_pem = key_pair.serialize_pem();

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "FetchBoy Proxy CA");

        let mut params = CertificateParams::new(Vec::<String>::new())?;
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.distinguished_name = dn;

        let cert = params.self_signed(&key_pair)?;
        let cert_pem = cert.pem();

        Ok((cert_pem, key_pem))
    }

    /// Add the CA certificate to the OS trust store.
    /// On macOS requires user approval; on Windows may require elevation.
    #[allow(dead_code)]
    pub fn install_to_system(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("security")
                .args([
                    "add-trusted-cert",
                    "-d",
                    "-r",
                    "trustRoot",
                    "-k",
                    "/Library/Keychains/System.keychain",
                    self.cert_path.to_str().unwrap(),
                ])
                .output()?;
            if !output.status.success() {
                return Err(format!(
                    "security add-trusted-cert failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )
                .into());
            }
        }

        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("certutil")
                .args(["-addstore", "-user", "Root", self.cert_path.to_str().unwrap()])
                .output()?;
            if !output.status.success() {
                return Err(format!(
                    "certutil -addstore failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )
                .into());
            }
        }

        Ok(())
    }

    /// Consume the CA and return the inner `RcgenAuthority` for use with the proxy builder.
    pub fn into_authority(self) -> RcgenAuthority {
        self.authority
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn tmp_dir(label: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("fetchboy_cert_test_{label}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn generate_ca_pem_returns_valid_pem() {
        let (cert_pem, key_pem) = CertificateAuthority::generate_ca_pem().unwrap();
        assert!(
            cert_pem.contains("BEGIN CERTIFICATE"),
            "cert_pem should contain PEM header"
        );
        assert!(
            key_pem.contains("PRIVATE KEY"),
            "key_pem should contain key PEM header"
        );
    }

    #[test]
    fn load_or_create_generates_files_on_first_run() {
        let dir = tmp_dir("first_run");
        let ca = CertificateAuthority::load_or_create(dir.clone()).unwrap();
        let cert_path = dir.join("ca").join("ca.pem");
        let key_path = dir.join("ca").join("ca-key.pem");
        assert!(cert_path.exists(), "ca.pem should be created");
        assert!(key_path.exists(), "ca-key.pem should be created");
        let _ = ca; // ensure no drop issues
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_or_create_reuses_existing_ca() {
        let dir = tmp_dir("reuse");
        // First call creates the CA files.
        let _ = CertificateAuthority::load_or_create(dir.clone()).unwrap();
        let cert_before = fs::read_to_string(dir.join("ca").join("ca.pem")).unwrap();

        // Second call should load the same cert, not regenerate.
        let _ = CertificateAuthority::load_or_create(dir.clone()).unwrap();
        let cert_after = fs::read_to_string(dir.join("ca").join("ca.pem")).unwrap();

        assert_eq!(cert_before, cert_after, "CA cert should not be regenerated");
        let _ = fs::remove_dir_all(&dir);
    }
}
