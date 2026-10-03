# Pixel-Racer

Rennspiel von oben für MakeCode Arcade, als Erweiterung mit eigenen Blöcken. Grafiken und Sounds
stammen aus dem [Arcade Asset Generator](https://theodorthg.github.io/arcade-asset-generator/).

- 1 bis 4 Spieler auf einem gemeinsamen Bildschirm, am selben Gerät oder online im Mehrspieler-Modus
  von arcade.makecode.com. Weitere Spieler übernehmen mit **A** ein Computer-Auto.
- **A** oder ↑ = Gas, **B** oder ↓ = Bremse/Rückwärts, ← → lenken.
- Meisterschaft über alle Strecken: Punkte 4/3/2/1 je Rennen, Runden einstellbar.
- Strecken: Grüne Wiese, Wüste, Schnee (rutschig). Boost-Felder und Ölflecken.

```blocks
pixelracer.setLaps(3)
pixelracer.setMaxPlayers(4)
pixelracer.startGame()
```

## Eigene Strecken
Tilemap mit **8×8-Kacheln**, 20×15 Felder (ein Bildschirm), Block `Strecke … Karte … Stil …` oder Tilemap
mit Namen `strecke1`, `strecke2` … Kacheln (je Stil `Grass`, `Desert`, `Snow`):
`rcGrassRoad`, `rcGrassOff`, `rcGrassWall` (Wand anhaken!), `rcGrassFinish`, `rcGrassStart`, `rcGrassBoost`, `rcGrassOil`.
Kontrollpunkte `rcCheck1`, `rcCheck2` … in Fahrtrichtung quer über die Straße legen; Start-Kacheln vor der Ziellinie.
Autos: Animation mit 16 Bildern `rcCar1` … `rcCar4` (Bild 0 schaut nach rechts, dann im Uhrzeigersinn).

Einbinden: Erweiterungen → `github:theodorthg/pxt-pixelracer`. Lizenz: MIT.
