// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        eprintln!("Ocorreu um erro fatal (Panic):");
        eprintln!("{:#?}", info);
        eprintln!("======================================");
        eprintln!("Por favor, copie ou tire uma foto desta tela!");
        eprintln!("Pressione ENTER para fechar...");
        let mut input = String::new();
        let _ = std::io::stdin().read_line(&mut input);
    }));

    app_lib::run();
}
