// Conteúdo dos arquivos .desktop da Vitrola (autostart e menu de aplicativos). Módulo puro.

export const APP_ID = 'io.github.vitrola.Vitrola';

/** Um argumento do Exec= entre aspas, com os escapes da especificação Desktop Entry. */
export function quoteExecArg(arg) {
    return `"${String(arg).replace(/(["`$\\])/g, '\\$1')}"`;
}

/**
 * @param {string[]} command programa e argumentos (ex.: ['/home/a/.local/bin/vitrola'])
 * @param {{autostart?: boolean, icon?: string}} options
 */
export function desktopEntry(command, {autostart = false, icon = APP_ID} = {}) {
    const exec = [...command.map(quoteExecArg), ...(autostart ? ['--em-segundo-plano'] : [])].join(' ');
    const lines = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Vitrola',
        'Comment=Player de vinil para o YouTube Music',
        `Exec=${exec}`,
        `Icon=${icon}`,
        'Categories=AudioVideo;Audio;Player;',
        'Keywords=música;youtube;vinil;player;',
        'StartupNotify=false',
        `StartupWMClass=${APP_ID}`,
        'DBusActivatable=false',
    ];
    if (autostart)
        lines.push('X-GNOME-Autostart-enabled=true', 'NoDisplay=true');
    return `${lines.join('\n')}\n`;
}
