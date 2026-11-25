use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};

static RELATORIO_ABERTO: AtomicBool = AtomicBool::new(false);
static JANELA_SEGUINTE: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub fn definir_popup_power_bi(janela: WebviewWindow, ativo: bool) {
    if janela.label() == "sistema" {
        RELATORIO_ABERTO.store(ativo, Ordering::Relaxed);
    }
}

fn destino_permitido(url: &Url) -> bool {
    // O login pode abrir uma janela vazia antes de indicar o endereço da Microsoft.
    url.as_str() == "about:blank"
        || (url.scheme() == "https"
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none()
            && matches!(
                url.host_str(),
                Some("login.microsoftonline.com" | "app.powerbi.com")
            ))
}

pub fn abrir_popup(
    app: &AppHandle,
    url: Url,
    features: NewWindowFeatures,
) -> NewWindowResponse<Wry> {
    if !RELATORIO_ABERTO.load(Ordering::Relaxed) || !destino_permitido(&url) {
        return NewWindowResponse::Deny;
    }

    let id = JANELA_SEGUINTE.fetch_add(1, Ordering::Relaxed);
    let janela = WebviewWindowBuilder::new(
        app,
        format!("power-bi-popup-{id}"),
        WebviewUrl::External("about:blank".parse().expect("URL fixa da janela")),
    )
    // Preserva o ambiente e o vínculo com a página que chamou window.open.
    .window_features(features)
    .title("Power BI · Microsoft")
    .inner_size(620.0, 760.0)
    .center()
    .on_navigation(destino_permitido)
    .build();

    match janela {
        Ok(window) => NewWindowResponse::Create { window },
        Err(_) => NewWindowResponse::Deny,
    }
}
