use tauri::{Emitter, Manager, State, command};
use tauri_plugin_opener::OpenerExt;
use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
#[cfg(all(debug_assertions, windows))]
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

/// Executa um instalador MSI de forma nativa e independente.
#[command]
fn run_installer(path: String) -> Result<(), String> {
    std::process::Command::new("msiexec")
        .args(&["/i", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
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

            // Grava o HTML da splash em um arquivo temporário e carrega via file://
            // WebView2 (Windows) bloqueia data: URIs mas aceita file:// sem problemas.
            let splash_html_raw = include_str!("../splash.html");
            let version = app.package_info().version.to_string();
            let splash_html = splash_html_raw.replace("<span id=\"version\">v1.0</span>", &format!("<span id=\"version\">v{}</span>", version));
            
            let splash_path = std::env::temp_dir().join(format!("metabuilder_splash_{}.html", version));
            std::fs::write(&splash_path, splash_html)
                .expect("Falha ao escrever splash.html temporário");

            // Converte o caminho para URL file:// compatível com qualquer OS
            let splash_url_str = format!("file:///{}", splash_path.to_string_lossy().replace('\\', "/"));
            let splash_url = tauri::Url::parse(&splash_url_str)
                .expect("URL da splash inválida");

            let _splash_window = tauri::WebviewWindowBuilder::new(
                app,
                "splashscreen",
                tauri::WebviewUrl::External(splash_url),
            )
            .title("MetaBuilder PRO")
            .inner_size(600.0, 380.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .center()
            .visible(true)
            .build()?;

            // Transição: aguarda animação completa e mostra a janela principal
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                // Aguarda a animação de progresso rodar completamente
                // 6 steps × ~450ms + fadeIn 350ms + margem = ~3.5s
                std::thread::sleep(std::time::Duration::from_millis(3500));

                // Fecha a splash e mostra a janela principal
                if let Some(splash) = app_handle.get_webview_window("splashscreen") {
                    let _ = splash.close();
                }
                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }

                // Limpa o arquivo temporário da splash
                let splash_tmp = std::env::temp_dir().join("metabuilder_splash.html");
                let _ = std::fs::remove_file(splash_tmp);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_cli,
            stop_cli,
            status_cli,
            open_browser,
            run_installer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
