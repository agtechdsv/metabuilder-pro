use tauri::{Emitter, Manager, State, command};
use tauri_plugin_opener::OpenerExt;
use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty};
use std::io::{Read, Write};
use std::str::FromStr;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

struct CliState {
    child: Mutex<Option<CommandChild>>,
}

struct PtyState {
    pty_master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    pty_writer: Mutex<Option<Box<dyn Write + Send>>>,
}

#[command]
fn startcli(app: tauri::AppHandle, state: State<'_, CliState>, mode: Option<i32>, config_path: Option<String>) -> Result<String, String> {
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
fn stopcli(state: State<'_, CliState>) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    if let Some(child) = child_guard.take() {
        let _ = child.kill();
        return Ok("Parado com sucesso".to_string());
    }
    Ok("Não estava rodando".to_string())
}

#[command]
fn statuscli(state: State<'_, CliState>) -> Result<bool, String> {
    let child_guard = state.child.lock().unwrap();
    Ok(child_guard.is_some())
}

/// Abre uma URL no navegador padrão do sistema.
/// Executado do lado Rust para contornar restrições de ACL do plugin opener.
#[command]
fn openbrowser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Executa um instalador MSI de forma nativa e independente.
#[command]
fn runinstaller(path: String) -> Result<(), String> {
    std::process::Command::new("msiexec")
        .args(&["/i", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn spawn_pty(app: tauri::AppHandle, state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let cmd = CommandBuilder::new("powershell.exe");
    #[cfg(not(target_os = "windows"))]
    let cmd = CommandBuilder::new("bash");

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    
    *state.pty_master.lock().unwrap() = Some(pair.master);
    *state.pty_writer.lock().unwrap() = Some(writer);
    
    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let _ = app.emit("pty_output", buf[..n].to_vec());
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[command]
fn write_pty(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    if let Some(writer) = state.pty_writer.lock().unwrap().as_mut() {
        let _ = writer.write_all(data.as_bytes());
    }
    Ok(())
}

#[command]
fn resize_pty(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    if let Some(master) = state.pty_master.lock().unwrap().as_ref() {
        let _ = master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            #[cfg(all(debug_assertions, windows))]
            app.deep_link().register_all()?;

            app.manage(CliState {
                child: Mutex::new(None),
            });

            app.manage(PtyState {
                pty_master: Mutex::new(None),
                pty_writer: Mutex::new(None),
            });

            // Set up Global Shortcut
            let shortcut = Shortcut::from_str("ctrl+shift+m").unwrap();
            let _ = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

            // Set up System Tray
            let show_i = MenuItem::with_id(app, "show", "Mostrar IDE", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Esconder IDE", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let new_ws_i = MenuItem::with_id(app, "new_ws", "Novo Workspace", true, None::<&str>)?;
            let new_proj_i = MenuItem::with_id(app, "new_proj", "Novo Projeto", true, None::<&str>)?;
            let sync_byoc_i = MenuItem::with_id(app, "sync_byoc", "Sincronizar BYOC", true, None::<&str>)?;
            let start_tunnel_i = MenuItem::with_id(app, "start_tunnel", "Iniciar Túnel", true, None::<&str>)?;
            let stop_tunnel_i = MenuItem::with_id(app, "stop_tunnel", "Parar Túnel", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_i,
                    &hide_i,
                    &PredefinedMenuItem::separator(app)?,
                    &new_ws_i,
                    &new_proj_i,
                    &sync_byoc_i,
                    &PredefinedMenuItem::separator(app)?,
                    &start_tunnel_i,
                    &stop_tunnel_i,
                    &PredefinedMenuItem::separator(app)?,
                    &quit_i,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => std::process::exit(0),
                        "new_ws" => { let _ = app.emit("tray-event", "new_ws"); },
                        "new_proj" => { let _ = app.emit("tray-event", "new_proj"); },
                        "sync_byoc" => { let _ = app.emit("tray-event", "sync_byoc"); },
                        "start_tunnel" => { let _ = app.emit("tray-event", "start_tunnel"); },
                        "stop_tunnel" => { let _ = app.emit("tray-event", "stop_tunnel"); },
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

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
            startcli,
            stopcli,
            statuscli,
            openbrowser,
            runinstaller,
            spawn_pty,
            write_pty,
            resize_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
