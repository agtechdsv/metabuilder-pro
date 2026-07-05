use tauri::{Emitter, Manager, State, command};
use tauri_plugin_opener::OpenerExt;
use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_deep_link::DeepLinkExt;

struct CliState {
    child: Mutex<Option<CommandChild>>,
}

#[command]
fn start_cli(app: tauri::AppHandle, state: State<'_, CliState>, mode: Option<i32>, config_path: Option<String>) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    if child_guard.is_some() {
        return Ok("Já está rodando".to_string());
    }

    let mut args = vec!["--headless".to_string()];
    if let Some(m) = mode {
        if m == 3 {
            args.push("--action=sync".to_string());
        } else {
            args.push("--action=tunnel".to_string());
        }
    } else {
        args.push("--action=tunnel".to_string());
    }

    if let Some(cfg) = config_path {
        args.push(format!("--config={}", cfg));
    }

    let sidecar_command = app.shell().sidecar("cli").unwrap().args(args);
    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    *child_guard = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("[CLI] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    eprintln!("[CLI ERROR] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    println!("[CLI] Encerrado com código {:?}", payload.code);
                    let state = app_handle.state::<CliState>();
                    let mut child_guard = state.child.lock().unwrap();
                    *child_guard = None;
                }
                _ => {}
            }
        }
    });

    Ok("Iniciado com sucesso".to_string())
}

#[command]
fn stop_cli(state: State<'_, CliState>) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    if let Some(child) = child_guard.take() {
        let _ = child.kill();
        return Ok("Parado com sucesso".to_string());
    }
    Ok("Não estava rodando".to_string())
}

#[command]
fn status_cli(state: State<'_, CliState>) -> Result<bool, String> {
    let child_guard = state.child.lock().unwrap();
    Ok(child_guard.is_some())
}

/// Abre uma URL no navegador padrão do sistema.
/// Executado do lado Rust para contornar restrições de ACL do plugin opener.
#[command]
fn open_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }

            if let Some(url) = args.iter().find(|a| a.starts_with("metabuilder://")) {
                let _ = app.emit("deep-link://new-url", vec![url.clone()]);
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(all(debug_assertions, windows))]
            app.deep_link().register_all()?;

            app.manage(CliState {
                child: Mutex::new(None),
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_cli, stop_cli, status_cli, open_browser])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
