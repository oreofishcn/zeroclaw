use std::process::Command;

#[test]
fn help_only_exposes_agent_command() {
    let output = Command::new(env!("CARGO_BIN_EXE_zeroclaw"))
        .arg("--help")
        .output()
        .expect("zeroclaw --help should run");

    assert!(
        output.status.success(),
        "--help should exit successfully: status={:?}, stderr={}",
        output.status.code(),
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("agent"),
        "--help should expose agent command, got:\n{stdout}"
    );
    assert!(
        !stdout.contains("gateway"),
        "--help should not expose gateway in minimal build, got:\n{stdout}"
    );
    assert!(
        !stdout.contains("channel"),
        "--help should not expose channel in minimal build, got:\n{stdout}"
    );
    assert!(
        !stdout.contains("daemon"),
        "--help should not expose daemon in minimal build, got:\n{stdout}"
    );
}
