// El shell de escritorio no lleva lógica propia: todo el visor vive en la
// aplicación web (apps/web), que Tauri empaqueta y sirve en un WebView.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error al arrancar Byndr ECAD Viewer");
}
