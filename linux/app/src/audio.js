// Leitura das saídas de áudio a partir do `pactl --format=json list sinks`. Módulo puro;
// quem executa o pactl é o audio-output.js (design.md D10).

/** Lista de saídas [{name, label}]; JSON inválido vira lista vazia. */
export function parseSinks(jsonText) {
    let raw;
    try {
        raw = JSON.parse(jsonText);
    } catch {
        return [];
    }
    if (!Array.isArray(raw))
        return [];
    return raw
        .filter(sink => sink && typeof sink.name === 'string' && sink.name)
        .map(sink => ({
            name: sink.name,
            label: (typeof sink.description === 'string' && sink.description.trim()) || sink.name,
        }));
}

/** Nome da saída padrão a partir da saída do `pactl get-default-sink`. */
export function parseDefaultSink(output) {
    const name = String(output ?? '').trim();
    return name || null;
}
