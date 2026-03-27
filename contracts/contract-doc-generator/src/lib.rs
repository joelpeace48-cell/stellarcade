use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Types & State
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GeneratorState {
    Idle,
    Discovery,
    Parsing,
    Generation,
    Complete,
    Failed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDoc {
    pub name: String,
    pub description: Option<String>,
    pub methods: Vec<MethodDoc>,
    pub types: Vec<TypeDoc>,
    pub events: Vec<EventDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodDoc {
    pub name: String,
    pub description: Option<String>,
    pub signature: String,
    pub parameters: Vec<ParameterDoc>,
    pub return_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterDoc {
    pub name: String,
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDoc {
    pub name: String,
    pub description: Option<String>,
    pub fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDoc {
    pub name: String,
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// Generator Engine
// ---------------------------------------------------------------------------

pub struct DocGenerator {
    pub base_path: PathBuf,
    pub output_path: PathBuf,
    pub state: GeneratorState,
}

impl DocGenerator {
    pub fn new(base_path: PathBuf, output_path: PathBuf) -> Self {
        Self {
            base_path,
            output_path,
            state: GeneratorState::Idle,
        }
    }

    /// Primary routine to generate documentation for all contracts
    pub fn run(&mut self) -> Result<(), String> {
        self.state = GeneratorState::Discovery;
        println!("EVENT: Starting contract discovery in {:?}", self.base_path);
        
        let mut contracts = self.discover_contracts()?;
        contracts.sort();
        
        self.state = GeneratorState::Parsing;
        println!("EVENT: Parsing {} contracts", contracts.len());
        
        let mut docs = Vec::new();
        for contract_path in contracts {
            match self.parse_contract(&contract_path) {
                Ok(doc) => docs.push(doc),
                Err(e) => {
                    println!("WARNING: Failed to parse {:?}: {}", contract_path, e);
                }
            }
        }

        self.state = GeneratorState::Generation;
        println!("EVENT: Finalizing Markdown generation");
        
        self.write_docs(docs)?;

        self.state = GeneratorState::Complete;
        println!("EVENT: Documentation generation successful");
        
        Ok(())
    }

    fn discover_contracts(&self) -> Result<Vec<PathBuf>, String> {
        let mut contracts = Vec::new();
        let entries = fs::read_dir(&self.base_path).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                let cargo_toml = path.join("Cargo.toml");
                let src_lib = path.join("src").join("lib.rs");
                
                // Exclude shared crates and the generator itself
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name == "shared" || name == "contract-doc-generator" || name == "deployment-scripts" {
                    continue;
                }

                if cargo_toml.exists() && src_lib.exists() {
                    contracts.push(path);
                }
            }
        }
        Ok(contracts)
    }

    fn parse_contract(&self, path: &Path) -> Result<ContractDoc, String> {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("Unknown").to_string();
        let lib_path = path.join("src").join("lib.rs");
        let content = fs::read_to_string(lib_path).map_err(|e| e.to_string())?;

        let mut doc = ContractDoc {
            name: name.clone(),
            description: None,
            methods: Vec::new(),
            types: Vec::new(),
            events: Vec::new(),
        };

        let mut lines = content.lines().peekable();
        let mut current_docs = Vec::new();

        while let Some(line) = lines.next() {
            let trimmed = line.trim();
            
            if trimmed.is_empty() {
                continue;
            }

            if trimmed.starts_with("///") {
                current_docs.push(trimmed[3..].trim().to_string());
                continue;
            }

            // Skip decorators but keep current_docs
            if trimmed.starts_with("#[") {
                continue;
            }

            // Extract Contract Header
            if doc.description.is_none() && !current_docs.is_empty() && (trimmed.contains("pub struct") || trimmed.contains("impl")) {
                 doc.description = Some(current_docs.join(" "));
            }

            // Detect Methods
            if trimmed.contains("pub fn") {
                let name_regex = Regex::new(r"fn\s+([a-zA-Z0-9_]+)").unwrap();
                // Capture multi-line signatures (common in contract methods).
                let mut signature = trimmed.to_string();
                while !signature.contains('{') {
                    let Some(next_line) = lines.peek() else { break };
                    let next_trimmed = next_line.trim();
                    if next_trimmed.is_empty() {
                        break;
                    }
                    signature.push(' ');
                    signature.push_str(next_trimmed);
                    lines.next();
                    if next_trimmed.contains('{') || next_trimmed.ends_with(';') {
                        break;
                    }
                }

                let normalized_signature = signature
                    .replace('{', "")
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
                    .replace("( ", "(")
                    .replace(", )", ")")
                    .replace(" )", ")");

                if let Some(cap) = name_regex.captures(&normalized_signature) {
                    let (parameters, return_type) = self.extract_params_and_return(&normalized_signature);
                    doc.methods.push(MethodDoc {
                        name: cap[1].to_string(),
                        description: if current_docs.is_empty() { None } else { Some(current_docs.join(" ")) },
                        signature: normalized_signature,
                        parameters,
                        return_type,
                    });
                }
            }

            // Detect Events (marked with #[contractevent])
            // Since we skipped #[ earlier, we need to check if the NEXT line is an event struct
            // Actually, let's look back or handle decorators specifically
            if trimmed.contains("struct") {
                 if !current_docs.is_empty() {
                    let name_regex = Regex::new(r"struct\s+([a-zA-Z0-9_]+)").unwrap();
                    if let Some(cap) = name_regex.captures(trimmed) {
                        let struct_name = cap[1].to_string();
                        if struct_name.contains("Event") || struct_name.contains("Claimed") {
                            doc.events.push(EventDoc {
                                name: struct_name,
                                description: Some(current_docs.join(" ")),
                            });
                        } else {
                            doc.types.push(TypeDoc {
                                name: struct_name,
                                description: Some(current_docs.join(" ")),
                                fields: Vec::new(),
                            });
                        }
                    }
                 }
            }

            current_docs.clear();
        }

        Ok(doc)
    }

    fn extract_params_and_return(&self, signature: &str) -> (Vec<ParameterDoc>, Option<String>) {
        let mut parameters = Vec::new();
        let mut return_type = None;

        let base_signature;
        if let Some(arrow_pos) = signature.find("->") {
            return_type = Some(signature[arrow_pos + 2..].trim().to_string());
            base_signature = &signature[..arrow_pos];
        } else {
            base_signature = signature;
        }

        // Extract parameters between first ( and last ) of the base_signature
        if let Some(start_paren) = base_signature.find('(') {
            if let Some(end_paren) = base_signature.rfind(')') {
                let params_str = &base_signature[start_paren + 1..end_paren];
                if !params_str.trim().is_empty() {
                    for param in params_str.split(',') {
                        let parts: Vec<&str> = param.split(':').collect();
                        if parts.len() == 2 {
                            parameters.push(ParameterDoc {
                                name: parts[0].trim().to_string(),
                                type_name: parts[1].trim().to_string(),
                            });
                        }
                    }
                }
            }
        }

        (parameters, return_type)
    }

    fn write_docs(&self, mut docs: Vec<ContractDoc>) -> Result<(), String> {
        if !self.output_path.exists() {
            fs::create_dir_all(&self.output_path).map_err(|e| e.to_string())?;
        }

        docs.sort_by(|a, b| a.name.cmp(&b.name));

        for doc in docs {
            let file_name = format!("{}.md", doc.name);
            let file_path = self.output_path.join(&file_name);

            let mut content = format!("# {}\n\n", doc.name);
            if let Some(desc) = &doc.description {
                content.push_str(&format!("{}\n\n", desc));
            }

            if !doc.methods.is_empty() {
                content.push_str("## Public Methods\n\n");
                for m in &doc.methods {
                    content.push_str(&format!("### `{}`\n", m.name));
                    if let Some(d) = &m.description {
                        content.push_str(&format!("{}\n\n", d));
                    }
                    content.push_str(&format!("```rust\n{}\n```\n\n", m.signature));

                    if !m.parameters.is_empty() {
                        content.push_str("#### Parameters\n\n");
                        content.push_str("| Name | Type |\n");
                        content.push_str("|------|------|\n");
                        for p in &m.parameters {
                            content.push_str(&format!("| `{}` | `{}` |\n", p.name, p.type_name));
                        }
                        content.push_str("\n");
                    }

                    if let Some(rt) = &m.return_type {
                        content.push_str("#### Return Type\n\n");
                        content.push_str(&format!("`{}`\n\n", rt));
                    }
                }
            }

            if !doc.events.is_empty() {
                content.push_str("## Events\n\n");
                for e in &doc.events {
                    content.push_str(&format!("- **{}**: {}\n", e.name, e.description.as_deref().unwrap_or("No description")));
                }
                content.push_str("\n");
            }

            fs::write(file_path, content).map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_parsing_logic() {
        let dir = tempdir().unwrap();
        let src_dir = dir.path().join("src");
        fs::create_dir(&src_dir).unwrap();
        let lib_rs = src_dir.join("lib.rs");
        
        let mock_code = r#"
/// The Reward Distribution contract manages lifecycle of rewards.
#[contract]
pub struct RewardContract;

#[contractimpl]
impl RewardContract {
    /// Initializes the contract.
    pub fn init(env: Env, admin: Address) { }

    /// Accrues rewards for a user.
    pub fn accrue(env: Env, user: Address) { }
}

/// Emitted when a reward is claimed.
#[contractevent]
pub struct RewardClaimed {
    pub user: Address,
    pub amount: i128,
}
"#;
        fs::write(lib_rs, mock_code).unwrap();
        fs::write(dir.path().join("Cargo.toml"), "").unwrap();

        let generator = DocGenerator::new(dir.path().to_path_buf(), dir.path().join("docs"));
        let doc = generator.parse_contract(dir.path()).unwrap();

        assert_eq!(doc.name, dir.path().file_name().unwrap().to_str().unwrap());
        assert!(doc.description.unwrap().contains("Reward Distribution"));
        assert_eq!(doc.methods.len(), 2);
        assert_eq!(doc.methods[0].name, "init");
        assert_eq!(doc.methods[0].parameters.len(), 2);
        assert_eq!(doc.methods[0].parameters[0].name, "env");
        assert_eq!(doc.methods[0].parameters[0].type_name, "Env");
        assert_eq!(doc.events.len(), 1);
        assert_eq!(doc.events[0].name, "RewardClaimed");
    }

    #[test]
    fn test_multiline_method_signature_parsing() {
        let dir = tempdir().unwrap();
        let src_dir = dir.path().join("src");
        fs::create_dir(&src_dir).unwrap();
        let lib_rs = src_dir.join("lib.rs");

        let mock_code = r#"
#[contract]
pub struct PrizePool;

#[contractimpl]
impl PrizePool {
    /// Releases reserved amount.
    pub fn release(
        env: Env,
        admin: Address,
        game_id: u64,
        amount: i128,
    ) -> Result<(), Error> {
        Ok(())
    }
}
"#;
        fs::write(lib_rs, mock_code).unwrap();
        fs::write(dir.path().join("Cargo.toml"), "").unwrap();

        let generator = DocGenerator::new(dir.path().to_path_buf(), dir.path().join("docs"));
        let doc = generator.parse_contract(dir.path()).unwrap();

        assert_eq!(doc.methods.len(), 1);
        assert_eq!(doc.methods[0].name, "release");
        assert_eq!(
            doc.methods[0].signature,
            "pub fn release(env: Env, admin: Address, game_id: u64, amount: i128) -> Result<(), Error>"
        );
        assert_eq!(doc.methods[0].parameters.len(), 4);
        assert_eq!(doc.methods[0].parameters[2].name, "game_id");
        assert_eq!(doc.methods[0].parameters[2].type_name, "u64");
        assert_eq!(doc.methods[0].return_type.as_deref(), Some("Result<(), Error>"));
    }
}
