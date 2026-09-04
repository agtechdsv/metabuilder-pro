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
    dev_pid: Mutex<Option<u32>>,
}

#[derive(serde::Deserialize)]
struct WorkspaceInfo {
    name: String,
    slug: String,
}

struct TrayState {
    show_i: tauri::menu::MenuItem<tauri::Wry>,
    hide_i: tauri::menu::MenuItem<tauri::Wry>,
    quit_i: tauri::menu::MenuItem<tauri::Wry>,
    new_ws_i: tauri::menu::MenuItem<tauri::Wry>,
    new_proj_i: tauri::menu::MenuItem<tauri::Wry>,
    sync_byoc_i: tauri::menu::MenuItem<tauri::Wry>,
    start_tunnel_i: tauri::menu::MenuItem<tauri::Wry>,
    stop_tunnel_i: tauri::menu::MenuItem<tauri::Wry>,
    // Workspaces armazenados para reconstruir submenu
    workspaces: Mutex<Vec<WorkspaceInfo>>,
    // Controle de estado para enable/disable
    is_admin: Mutex<bool>,
    tunnel_active: Mutex<bool>,
}

struct PtyState {
    pty_master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    pty_writer: Mutex<Option<Box<dyn Write + Send>>>,
}

#[command]
fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path.replace("/", "\\"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(cmd)
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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

    if let Ok(local_data_dir) = app.path().app_local_data_dir() {
        let logs_dir = local_data_dir.join("logs");
        if let Some(logs_str) = logs_dir.to_str() {
            args.push(format!("--log-dir={}", logs_str));
        }
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
    // Kill the entire process tree using taskkill so node.js children are also killed
    let pid_opt = {
        let pid_guard = state.dev_pid.lock().unwrap();
        *pid_guard
    };

    if let Some(pid) = pid_opt {
        // taskkill /F (force) /T (tree) /PID kills node.js and all children
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }

    // Also try killing via the child handle as a fallback
    let mut child_guard = state.child.lock().unwrap();
    if let Some(child) = child_guard.take() {
        let _ = child.kill();
    }

    // Clear the stored PID
    let mut pid_guard = state.dev_pid.lock().unwrap();
    *pid_guard = None;

    // Also kill any lingering node processes on port 3000 as a safety net
    let _ = std::process::Command::new("cmd")
        .args(&["/c", "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %a"])
        .output();

    Ok("Parado com sucesso".to_string())
}

#[command]
fn start_nextjs_dev(app: tauri::AppHandle, state: State<'_, CliState>, project_path: String) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    if child_guard.is_some() {
        return Ok("Já está rodando".to_string());
    }

    let sidecar_command = app.shell().command("cmd")
        .args(vec!["/c", "set \"DATABASE_URL=\" && set \"NEXT_PUBLIC_SUPABASE_URL=\" && set \"SUPABASE_SERVICE_ROLE_KEY=\" && call npm install && npm run dev"])
        .current_dir(&project_path);

    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    // Store the PID so we can kill the entire process tree later with taskkill
    {
        let mut pid_guard = state.dev_pid.lock().unwrap();
        *pid_guard = Some(child.pid());
    }

    *child_guard = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", String::from_utf8_lossy(&line).to_string());
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", format!("ERROR: {}", String::from_utf8_lossy(&line)));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    let _ = app_handle.emit("nextjs-dev-log", format!("Encerrado com código {:?}", payload.code));
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
fn start_npm_install(app: tauri::AppHandle, state: State<'_, CliState>, project_path: String) -> Result<String, String> {
    let sidecar_command = app.shell().command("cmd")
        .args(vec!["/c", "npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps"])
        .current_dir(&project_path);

    let (mut rx, _child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_handle.emit("nextjs-dev-log", "[Build] Iniciando npm install...".to_string());
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", String::from_utf8_lossy(&line).to_string());
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", format!("ERROR: {}", String::from_utf8_lossy(&line)));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    let code = payload.code.unwrap_or(-1);
                    if code == 0 {
                        let _ = app_handle.emit("nextjs-dev-log", "[Build] npm install concluído com sucesso!".to_string());
                        let _ = app_handle.emit("npm-install-done", true);
                    } else {
                        let _ = app_handle.emit("nextjs-dev-log", format!("[Build] npm install falhou com código {}", code));
                        let _ = app_handle.emit("npm-install-done", false);
                    }
                }
                _ => {}
            }
        }
    });

    Ok("Install iniciado".to_string())
}

#[command]
fn start_nextjs_server(app: tauri::AppHandle, state: State<'_, CliState>, project_path: String) -> Result<String, String> {
    let mut child_guard = state.child.lock().unwrap();
    if child_guard.is_some() {
        return Ok("Já está rodando".to_string());
    }

    let sidecar_command = app.shell().command("cmd")
        .args(vec!["/c", "set \"DATABASE_URL=\" && set \"NEXT_PUBLIC_SUPABASE_URL=\" && set \"SUPABASE_SERVICE_ROLE_KEY=\" && npm run dev"])
        .current_dir(&project_path);

    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    {
        let mut pid_guard = state.dev_pid.lock().unwrap();
        *pid_guard = Some(child.pid());
    }
    *child_guard = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", String::from_utf8_lossy(&line).to_string());
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    let _ = app_handle.emit("nextjs-dev-log", format!("ERROR: {}", String::from_utf8_lossy(&line)));
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                    let _ = app_handle.emit("nextjs-dev-log", format!("Encerrado com código {:?}", payload.code));
                    let state = app_handle.state::<CliState>();
                    let mut child_guard = state.child.lock().unwrap();
                    *child_guard = None;
                }
                _ => {}
            }
        }
    });

    Ok("Servidor iniciado".to_string())
}

#[command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[command]
fn statuscli(state: State<'_, CliState>) -> Result<bool, String> {
    let child_guard = state.child.lock().unwrap();
    Ok(child_guard.is_some())
}

#[command]
async fn runsynccli(app: tauri::AppHandle, config_path: Option<String>) -> Result<String, String> {
    let mut args = vec!["--headless".to_string(), "--action=sync".to_string()];

    if let Some(cfg) = config_path {
        args.push(format!("--config={}", cfg));
    }

    if let Ok(local_data_dir) = app.path().app_local_data_dir() {
        let logs_dir = local_data_dir.join("logs");
        if let Some(logs_str) = logs_dir.to_str() {
            args.push(format!("--log-dir={}", logs_str));
        }
    }

    let sidecar_command = app.shell().sidecar("cli").unwrap().args(args);
    let (mut rx, _child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    
    // We wait for the process to finish by reading the events
    let mut exit_code = None;
    
    while let Some(event) = rx.recv().await {
        match event {
            tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line).to_string();
                let _ = app_clone.emit("sync-log", text);
            }
            tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line).to_string();
                let _ = app_clone.emit("sync-log", format!("ERROR: {}", text));
            }
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            _ => {}
        }
    }

    if let Some(code) = exit_code {
        if code == 0 {
            Ok("Sincronização finalizada com sucesso".to_string())
        } else {
            Err(format!("Processo finalizado com erro (código {})", code))
        }
    } else {
        Err("Processo finalizado de forma inesperada".to_string())
    }
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

#[command]
fn update_tray_menu(
    app: tauri::AppHandle,
    is_logged_in: bool,
    is_admin: bool,
    tunnel_active: bool,
    workspaces: Vec<WorkspaceInfo>
) -> Result<(), String> {
    use tauri::menu::{Menu, PredefinedMenuItem};

    let state = app.state::<TrayState>();

    // 1. Atualiza estados internos
    *state.is_admin.lock().unwrap() = is_admin;
    *state.tunnel_active.lock().unwrap() = tunnel_active;
    *state.workspaces.lock().unwrap() = workspaces;

    // 2. Se não estiver logado, desabilita todos os itens de ação
    if !is_logged_in {
        let _ = state.new_ws_i.set_enabled(false);
        let _ = state.new_proj_i.set_enabled(false);
        let _ = state.sync_byoc_i.set_enabled(false);
        let _ = state.start_tunnel_i.set_enabled(false);
        let _ = state.stop_tunnel_i.set_enabled(false);
        return Ok(());
    }

    // 3. Logado: aplica enable/disable conforme permissões e estado
    let _ = state.new_ws_i.set_enabled(is_admin);
    let _ = state.new_proj_i.set_enabled(true);
    let _ = state.sync_byoc_i.set_enabled(true);
    let _ = state.start_tunnel_i.set_enabled(!tunnel_active);
    let _ = state.stop_tunnel_i.set_enabled(tunnel_active);

    // 3. Reconstrói o menu completo com o submenu de workspaces atualizado
    let workspaces_snap = state.workspaces.lock().unwrap();
    
    let mut ws_menu_items: Vec<tauri::menu::MenuItem<tauri::Wry>> = Vec::new();
    for ws in workspaces_snap.iter() {
        let id = format!("new_proj_{}", ws.slug);
        match tauri::menu::MenuItem::with_id(&app, &id, &ws.name, true, None::<&str>) {
            Ok(item) => ws_menu_items.push(item),
            Err(_) => {
                // ID já existe — cria com sufixo único para evitar conflito
                let fallback_id = format!("new_proj_{}_t{}", ws.slug, std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
                if let Ok(item) = tauri::menu::MenuItem::with_id(&app, &fallback_id, &ws.name, true, None::<&str>) {
                    ws_menu_items.push(item);
                }
            }
        }
    }
    drop(workspaces_snap);

    let proj_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = ws_menu_items
        .iter()
        .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
        .collect();

    let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();

    menu_items.push(&state.show_i);
    menu_items.push(&state.hide_i);

    let sep1 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    menu_items.push(&sep1);

    if is_admin {
        menu_items.push(&state.new_ws_i);
    }

    let submenu_holder;
    if proj_refs.is_empty() {
        menu_items.push(&state.new_proj_i);
    } else {
        let sub = tauri::menu::Submenu::with_items(&app, "Novo Projeto", true, &proj_refs)
            .map_err(|e| e.to_string())?;
        submenu_holder = Some(sub);
        menu_items.push(submenu_holder.as_ref().unwrap() as &dyn tauri::menu::IsMenuItem<tauri::Wry>);
    }

    menu_items.push(&state.sync_byoc_i);

    let sep2 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    menu_items.push(&sep2);

    // Ambos os itens de túnel ficam visíveis; apenas um habilitado por vez
    menu_items.push(&state.start_tunnel_i);
    menu_items.push(&state.stop_tunnel_i);

    let sep3 = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    menu_items.push(&sep3);
    menu_items.push(&state.quit_i);

    let menu = Menu::with_items(&app, &menu_items).map_err(|e| e.to_string())?;

    if let Some(tray) = app.tray_by_id("main_tray") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
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
                dev_pid: Mutex::new(None),
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

            // Estado inicial: usuário não está logado — desabilita todos os itens de ação
            // Serão habilitados dinamicamente após o login via update_tray_menu
            let _ = new_ws_i.set_enabled(false);
            let _ = new_proj_i.set_enabled(false);
            let _ = sync_byoc_i.set_enabled(false);
            let _ = start_tunnel_i.set_enabled(false);
            let _ = stop_tunnel_i.set_enabled(false);

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

            app.manage(TrayState {
                show_i,
                hide_i,
                quit_i,
                new_ws_i,
                new_proj_i,
                sync_byoc_i,
                start_tunnel_i,
                stop_tunnel_i,
                workspaces: Mutex::new(Vec::new()),
                is_admin: Mutex::new(false),
                tunnel_active: Mutex::new(false),
            });

            let _tray = TrayIconBuilder::with_id("main_tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
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
                        id if id.starts_with("new_proj_") => { 
                            let _ = app.emit("tray-event", id); 
                        },
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
            start_nextjs_dev,
            start_npm_install,
            start_nextjs_server,
            statuscli,
            runsynccli,
            openbrowser,
            runinstaller,
            spawn_pty,
            write_pty,
            resize_pty,
            update_tray_menu,
            open_devtools,
            open_in_explorer
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            let state = app_handle.state::<CliState>();
            let mut guard = state.child.lock().unwrap();
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    });
}
