// Erzeugt assets.ts, tracks.ts und sounds.ts mit dem Arcade Asset Generator. Aufruf: node tools/build-assets.js
const fs = require('fs'), path = require('path');
const G = require('../../generator/assetgen.js');
const S = require('../../generator/soundgen.js');
const C = require('./config.js');
const cap = s => s[0].toUpperCase() + s.slice(1);
const KEYS = ['road', 'off', 'wall', 'finish', 'start', 'boost', 'oil'];
let ts = '// AUTOMATISCH ERZEUGT von tools/build-assets.js – nicht von Hand bearbeiten.\nnamespace racerGfx {\n';
const sets = [];
C.styles.forEach(st => {
    const t = G.racerTiles(st, C.tileSeed), S_ = cap(st);
    KEYS.forEach(k => ts += G.imageToTS('t' + S_ + cap(k), t[k]));
    sets.push('[empty8, ' + KEYS.map(k => 't' + S_ + cap(k)).join(', ') + ', ' + t.cp.map((_, i) => 'cp' + (i + 1)).join(', ') + ']');
});
ts += G.imageToTS('empty8', new G.Pix(8, 8));
G.racerTiles('grass', C.tileSeed).cp.forEach((p, i) => ts += G.imageToTS('cp' + (i + 1), p));
ts += `    // Reihenfolge: leer, Straße, abseits, Wand, Ziel, Start, Boost, Öl, Kontrollpunkt 1–9\n    export const tilesets: Image[][] = [\n        ${sets.join(',\n        ')}\n    ]\n`;
C.carColors.forEach((c, i) => ts += G.framesToTS('car' + (i + 1), G.racerCar(c, C.carSeed)));
ts += `    export const cars: Image[][] = [car1, car2, car3, car4]\n`;
const it = G.racerItems();
ts += G.imageToTS('flag', it.flag) + G.framesToTS('smoke', it.smoke) + '}\n';
fs.writeFileSync(path.join(__dirname, '../assets.ts'), ts);
// Strecken
const CH = { '=': 1, '.': 2, '#': 3, 'F': 4, 'S': 5, 'b': 6, 'o': 7 };
let tr = '// AUTOMATISCH ERZEUGT von tools/build-assets.js.\nnamespace racerTracks {\n    export const count = ' + G.RACER_TRACKS.length + '\n';
tr += '    export const names: string[] = [' + G.RACER_TRACKS.map(t => JSON.stringify(t.name)).join(', ') + ']\n';
tr += '    export const styles: number[] = [' + G.RACER_TRACKS.map(t => C.styles.indexOf(t.style)).join(', ') + ']\n';
tr += '    export function tilemap(i: number): tiles.TileMapData {\n        switch (i) {\n';
G.RACER_TRACKS.forEach((t, i) => {
    const bytes = [20, 0, 15, 0];
    const walls = [];
    t.rows.forEach(r => { const wr = []; [...r].forEach(c => { bytes.push(c >= '1' && c <= '9' ? 7 + (+c) : CH[c]); wr.push(c === '#' ? '2' : '.'); }); walls.push('            ' + wr.join(' ')); });
    tr += `            case ${i}: return tiles.createTilemap(hex\`${Buffer.from(bytes).toString('hex')}\`, img\`\n${walls.join('\n')}\n            \`, racerGfx.tilesets[${C.styles.indexOf(t.style)}], TileScale.Eight)\n`;
});
tr += '        }\n        return null\n    }\n}\n';
fs.writeFileSync(path.join(__dirname, '../tracks.ts'), tr);
let snd = '// AUTOMATISCH ERZEUGT von tools/build-assets.js – Sounds in tools/config.js ändern.\nnamespace racerSounds {\n';
for (const k in C.sfx) snd += S.sfxToTS(k, S.sfx(C.sfx[k][0], C.sfx[k][1]));
for (const k in C.melodies) snd += S.melodyToTS(k, S.melody(C.melodies[k][0], C.melodies[k][1]));
fs.writeFileSync(path.join(__dirname, '../sounds.ts'), snd + '}\n');
console.log('assets.ts', Math.round(ts.length / 1024) + ' KB, tracks.ts, sounds.ts');
