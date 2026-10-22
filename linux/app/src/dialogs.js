// Janelinhas de aviso, ajuda e "Sobre".

import Gtk from 'gi://Gtk?version=4.0';

export function alert(parent, message, detail = '') {
    const dialog = new Gtk.AlertDialog({message, detail, buttons: ['OK']});
    dialog.show(parent ?? null);
}

const HELP = `• A música toca dentro da Vitrola. Fechar a janela do YouTube Music não para a música; para sair, use "Sair da Vitrola" no menu ou Ctrl+Q.

• O notch na barra superior, o ícone de disco e a vitrola "Sempre na frente" vêm da extensão "Vitrola" do GNOME Shell. Ative em Extensões (ou: gnome-extensions enable vitrola@vitrola.github.io) e saia e entre de novo na sessão.

• Buscar de qualquer app: Ctrl+Super+M (com a extensão). Sem a extensão, crie um atalho em Configurações › Teclado › Atalhos personalizados com o comando: vitrola --buscar

• Volume: role o mouse sobre o notch ou a vitrola. Saída de áudio: menu › Saída de áudio.`;

export function showHelp(parent) {
    alert(parent, 'Como usar a Vitrola', HELP);
}

export function showAbout(parent) {
    const about = new Gtk.AboutDialog({
        transient_for: parent ?? null,
        modal: Boolean(parent),
        program_name: 'Vitrola',
        logo_icon_name: 'media-optical-symbolic',
        comments: 'Player de vinil para o YouTube Music, no notch e na tela.',
        license_type: Gtk.License.CUSTOM,
        license: 'Uso pessoal.',
    });
    about.present();
}
