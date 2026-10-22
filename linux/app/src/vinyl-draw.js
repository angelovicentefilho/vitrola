// Desenho do toca-discos com cairo, igual ao do Mac (TurntableViews.swift).
// Só depende do cairo: a vitrola flutuante (GTK) e a extensão do notch (St.DrawingArea) usam o mesmo.
// O selo (capa) é pintado por quem chama, pela função `paintLabel(cr, cx, cy, r)`.

import Cairo from 'cairo';

import {TURNTABLE_WIDTH_FACTOR} from './vinyl-geometry.js';

const rad = degrees => degrees * Math.PI / 180;

function circle(cr, cx, cy, r) {
    cr.newSubPath();
    cr.arc(cx, cy, r, 0, 2 * Math.PI);
}

function roundedRect(cr, x, y, w, h, r) {
    cr.newSubPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}

/** Selo padrão quando não há capa: gradiente vermelho (o ícone de nota fica por conta de quem chama). */
export function paintDefaultLabel(cr, cx, cy, r) {
    const g = new Cairo.LinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStopRGB(0, 0.93, 0.36, 0.24);
    g.addColorStopRGB(1, 0.72, 0.13, 0.24);
    circle(cr, cx, cy, r);
    cr.setSource(g);
    cr.fill();
    // Nota musical simples: haste e cabeça.
    cr.setSourceRGBA(1, 1, 1, 0.9);
    const s = r * 0.5;
    cr.rectangle(cx + s * 0.18, cy - s * 0.7, s * 0.14, s * 1.1);
    cr.fill();
    cr.save();
    cr.translate(cx - s * 0.05, cy + s * 0.42);
    cr.scale(1.3, 1);
    circle(cr, 0, 0, s * 0.22);
    cr.restore();
    cr.fill();
}

/**
 * Disco de vinil de diâmetro d com o canto superior esquerdo em (x, y), girado `angle` graus.
 * @param {(cr, cx, cy, r) => void} paintLabel pinta o selo (capa) num círculo já recortado
 */
export function drawDisc(cr, x, y, d, angle, paintLabel = paintDefaultLabel) {
    const r = d / 2;
    const cx = x + r;
    const cy = y + r;

    // Sombra.
    cr.save();
    circle(cr, cx, cy + d * 0.02, r * 1.01);
    cr.setSourceRGBA(0, 0, 0, 0.3);
    cr.fill();
    cr.restore();

    cr.save();
    cr.translate(cx, cy);
    cr.rotate(rad(angle));

    const body = new Cairo.RadialGradient(0, 0, 0, 0, 0, r);
    body.addColorStopRGB(0, 0.14, 0.14, 0.14);
    body.addColorStopRGB(0.5, 0.06, 0.06, 0.06);
    body.addColorStopRGB(1, 0.02, 0.02, 0.02);
    circle(cr, 0, 0, r);
    cr.setSource(body);
    cr.fill();

    cr.setLineWidth(0.6);
    for (let i = 0; i < 15; i++) {
        cr.setSourceRGBA(1, 1, 1, i % 4 === 0 ? 0.08 : 0.035);
        circle(cr, 0, 0, d * (0.40 + i * 0.038) / 2);
        cr.stroke();
    }
    cr.setLineWidth(Math.max(1, d * 0.006));
    cr.setSourceRGBA(1, 1, 1, 0.06);
    circle(cr, 0, 0, d * 0.985 / 2);
    cr.stroke();

    const labelR = d * 0.18;
    cr.save();
    circle(cr, 0, 0, labelR);
    cr.clip();
    paintLabel(cr, 0, 0, labelR);
    cr.restore();
    cr.setLineWidth(1);
    cr.setSourceRGBA(0, 0, 0, 0.35);
    circle(cr, 0, 0, labelR);
    cr.stroke();

    circle(cr, 0, 0, d * 0.015);
    cr.setSourceRGB(0.85, 0.85, 0.85);
    cr.fillPreserve();
    cr.setLineWidth(0.5);
    cr.setSourceRGBA(0, 0, 0, 0.5);
    cr.stroke();
    cr.restore();

    drawSheen(cr, cx, cy, r);
}

/** Reflexo fixo de luz (não gira): duas faixas claras em leque, como o gradiente angular do Mac. */
function drawSheen(cr, cx, cy, r) {
    const bands = [[0.10, 0.11], [0.60, 0.08]];     // [posição na volta, intensidade]
    const offset = rad(-20) - Math.PI / 2;
    for (const [at, alpha] of bands) {
        for (let step = -6; step <= 6; step++) {
            const a0 = offset + (at + (step - 0.5) * 0.01) * 2 * Math.PI;
            const a1 = offset + (at + (step + 0.5) * 0.01) * 2 * Math.PI;
            cr.moveTo(cx, cy);
            cr.arc(cx, cy, r, a0, a1);
            cr.closePath();
            cr.setSourceRGBA(1, 1, 1, alpha * (1 - Math.abs(step) / 7) * 0.6);
            cr.fill();
        }
    }
}

/** Braço da agulha para um disco de diâmetro d com o canto em (x, y); `angle` em graus. */
export function drawTonearm(cr, x, y, d, angle) {
    const px = x + d * 1.04;
    const py = y + d * 0.10;
    const length = d * 0.82;

    const base = new Cairo.LinearGradient(px - d * 0.075, py - d * 0.075, px + d * 0.075, py + d * 0.075);
    base.addColorStopRGB(0, 0.75, 0.75, 0.75);
    base.addColorStopRGB(1, 0.45, 0.45, 0.45);
    circle(cr, px, py + d * 0.01, d * 0.075);
    cr.setSourceRGBA(0, 0, 0, 0.35);
    cr.fill();
    circle(cr, px, py, d * 0.075);
    cr.setSource(base);
    cr.fill();

    cr.save();
    cr.translate(px, py);
    cr.rotate(rad(angle));

    // Sombra do braço.
    cr.save();
    cr.translate(d * 0.01, d * 0.02);
    roundedRect(cr, -d * 0.011, 0, d * 0.022, length, d * 0.011);
    cr.setSourceRGBA(0, 0, 0, 0.3);
    cr.fill();
    cr.restore();

    roundedRect(cr, -d * 0.0375, -d * 0.0975, d * 0.075, d * 0.085, d * 0.015);
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.fill();

    const metal = new Cairo.LinearGradient(-d * 0.011, 0, d * 0.011, 0);
    metal.addColorStopRGB(0, 0.92, 0.92, 0.92);
    metal.addColorStopRGB(0.5, 0.62, 0.62, 0.62);
    metal.addColorStopRGB(1, 0.85, 0.85, 0.85);
    roundedRect(cr, -d * 0.011, 0, d * 0.022, length, d * 0.011);
    cr.setSource(metal);
    cr.fill();

    roundedRect(cr, -d * 0.0275, length - d * 0.0675, d * 0.055, d * 0.095, d * 0.012);
    cr.setSourceRGB(0.16, 0.16, 0.16);
    cr.fillPreserve();
    cr.setLineWidth(0.5);
    cr.setSourceRGBA(1, 1, 1, 0.25);
    cr.stroke();
    cr.restore();

    circle(cr, px, py, d * 0.025);
    cr.setSourceRGB(0.88, 0.88, 0.88);
    cr.fill();
}

/** Toca-discos completo (disco + braço opcional) num quadro de (1,16 × d) por d em (x, y). */
export function drawTurntable(cr, x, y, d, {angle, armAngle, showArm, paintLabel}) {
    drawDisc(cr, x, y, d, angle, paintLabel);
    if (showArm)
        drawTonearm(cr, x, y, d, armAngle);
}

export {TURNTABLE_WIDTH_FACTOR};
