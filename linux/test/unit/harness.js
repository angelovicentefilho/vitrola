// Mini-harness de testes que roda igual no Node e no GJS.
// No Node, delega para node:test (`node --test linux/test/unit/`).
// No GJS, os testes ficam guardados e o run-gjs.js os executa.

const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
const nodeTest = isNode ? await import('node:test') : null;
const pending = [];

export function test(name, fn) {
    if (nodeTest)
        nodeTest.test(name, fn);
    else
        pending.push({name, fn});
}

class AssertionError extends Error {}

function fail(message, detail) {
    throw new AssertionError(detail ? `${message}\n${detail}` : message);
}

export const assert = {
    ok(value, message = 'esperava um valor verdadeiro') {
        if (!value)
            fail(message);
    },
    equal(actual, expected, message = 'valores diferentes') {
        if (actual !== expected)
            fail(message, `  recebido: ${JSON.stringify(actual)}\n  esperado: ${JSON.stringify(expected)}`);
    },
    deepEqual(actual, expected, message = 'estruturas diferentes') {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b)
            fail(message, `  recebido: ${a}\n  esperado: ${b}`);
    },
};

/** Executa os testes guardados (GJS). Devolve quantos falharam. */
export async function runPending(log) {
    let failed = 0;
    for (const {name, fn} of pending) {
        try {
            await fn();
            log(`  ✓ ${name}`);
        } catch (e) {
            failed++;
            log(`  ✗ ${name}\n    ${String(e.message).replace(/\n/g, '\n    ')}`);
        }
    }
    log(`${pending.length - failed} passaram, ${failed} falharam`);
    return failed;
}
