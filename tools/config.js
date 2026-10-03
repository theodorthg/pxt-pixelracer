// Gemeinsame Einstellungen für die eingebauten Grafiken, Strecken und Sounds.
module.exports = {
    styles: ['grass', 'desert', 'snow'],          // Reihenfolge = pixelracer.Style
    tileSeed: '1', carSeed: '1',
    carColors: [8, 2, 7, 5],                      // Spieler 1–4
    sfx: { lap: ['coin', '3'], boost: ['powerup', '5'], crash: ['hit', '4'], oil: ['death', '2'], beep: ['blip', '2'], go: ['blip', '7'] },
    melodies: { startTune: ['start', '4'], raceTune: ['level', '3'], winTune: ['win', '3'], endTune: ['gameover', '3'] },
};
