// =====================================================================
//  PIXEL-RACER – Rennspiel von oben als MakeCode-Erweiterung
//  1 bis 4 Spieler auf einem gemeinsamen Bildschirm (auch online im
//  Mehrspieler-Modus), freie Plätze fahren Computer-Gegner.
//  Strecken sind Tilemaps aus 8x8-Kacheln (20x15 = ein Bildschirm).
//  Grafiken: assets.ts, Strecken: tracks.ts, Sounds: sounds.ts (generiert).
// =====================================================================

namespace SpriteKind {
    export const RcCar = SpriteKind.create()
    export const RcFx = SpriteKind.create()
}

//% color="#c0392b" weight=98 icon="" block="Pixel-Racer"
//% groups='["Start", "Strecken", "Einstellungen", "Ereignisse", "Werte"]'
namespace pixelracer {
    /** Stil einer Strecke */
    export enum Style {
        //% block="Grüne Wiese"
        Grass = 0,
        //% block="Wüste"
        Desert = 1,
        //% block="Schnee"
        Snow = 2
    }
    const STYLE_NAMES = ["Grass", "Desert", "Snow"]
    const STYLE_GRIP = [100, 85, 40]          // Bodenhaftung in Prozent (Schnee rutscht)
    const KEY_NAMES = ["Road", "Off", "Wall", "Finish", "Start", "Boost", "Oil"]
    const K_NONE = 0, K_ROAD = 1, K_OFF = 2, K_WALL = 3, K_FINISH = 4, K_START = 5, K_BOOST = 6, K_OIL = 7, K_CP = 8
    const MAX_CARS = 4
    const MAX_TRACKS = 9
    const CAR_NAMES = ["Blau", "Rot", "Gruen", "Gelb"]
    const CAR_COLORS = [8, 2, 7, 5]
    const POINTS = [4, 3, 2, 1]

    // ---------------------------------------------------------------- Einstellungen
    let title = "PIXEL-RACER"
    let laps = 3
    let maxPlayers = 4
    let cpuCars = true
    let cpuSkill = 100
    let topSpeed = 90
    const trackMaps: tiles.TileMapData[] = [null, null, null, null, null, null, null, null, null]
    const trackStyles: number[] = [-1, -1, -1, -1, -1, -1, -1, -1, -1]
    let lapHandler: (player: number, lap: number) => void = null
    let raceHandler: (winner: number) => void = null

    // ---------------------------------------------------------------- Assets
    let carFrames: Image[][] = []
    let styleTiles: Image[][] = []
    let cpTiles: Image[] = []

    function projImg(name: string, fallback: Image): Image {
        const a = helpers.getImageByName(name)
        return a ? a : fallback
    }
    function projAnim(name: string, fallback: Image[]): Image[] {
        const a: Image[] = helpers.getAnimationByName(name)
        return a && a.length >= 16 ? a : fallback
    }
    function projTile(name: string, fallback: Image): Image {
        const a = helpers.getTileByName(name)
        return a ? a : fallback
    }
    function resolveAssets() {
        for (let i = 0; i < MAX_CARS; i++) carFrames[i] = projAnim("rcCar" + (i + 1), racerGfx.cars[i])
        for (let s = 0; s < STYLE_NAMES.length; s++) {
            const t = racerGfx.tilesets[s]
            const list: Image[] = [t[0]]
            for (let k = 0; k < KEY_NAMES.length; k++) list.push(projTile("rc" + STYLE_NAMES[s] + KEY_NAMES[k], t[k + 1]))
            styleTiles[s] = list
        }
        for (let n = 0; n < 9; n++) cpTiles[n] = projTile("rcCheck" + (n + 1), racerGfx.tilesets[0][K_CP + n])
    }
    function play(p: music.Playable) { music.play(p, music.PlaybackMode.InBackground) }

    // ---------------------------------------------------------------- Strecken
    function trackMap(i: number): tiles.TileMapData {
        if (i < 0 || i >= MAX_TRACKS) return null
        if (trackMaps[i]) return trackMaps[i]
        const named = helpers.getTilemapByName("strecke" + (i + 1))
        if (named) return named
        if (i < racerTracks.count) return racerTracks.tilemap(i)
        return null
    }
    function trackStyle(i: number): number {
        if (trackStyles[i] >= 0) return trackStyles[i]
        if (i < racerTracks.count && !trackMaps[i]) return racerTracks.styles[i]
        return i % STYLE_NAMES.length
    }
    function trackName(i: number): string {
        if (!trackMaps[i] && !helpers.getTilemapByName("strecke" + (i + 1)) && i < racerTracks.count) return racerTracks.names[i]
        return "Strecke " + (i + 1)
    }
    function countTracks(): number {
        let n = 0
        while (n < MAX_TRACKS && trackMap(n)) n++
        return n
    }

    // ---------------------------------------------------------------- Zustand
    const ctrls = [controller.player1, controller.player2, controller.player3, controller.player4]
    const cars: Sprite[] = [null, null, null, null]
    const human = [false, false, false, false]
    const angle = [0, 0, 0, 0]          // 0..16 (16 Richtungen, 0 = rechts, im Uhrzeigersinn)
    const speed = [0, 0, 0, 0]
    const lap = [0, 0, 0, 0]
    const nextCp = [1, 1, 1, 1]
    const finished = [false, false, false, false]
    const boostUntil = [0, 0, 0, 0]
    const spinUntil = [0, 0, 0, 0]
    const points = [0, 0, 0, 0]
    const stuckSince = [0, 0, 0, 0]
    const reverseUntil = [0, 0, 0, 0]
    let finishOrder: number[] = []
    let kindOf: number[] = []           // Kachelindex -> Art
    let roadIdx = 1
    let cpCount = 0
    let cpX: number[] = [], cpY: number[] = []
    let cpX0: number[] = [], cpY0: number[] = [], cpX1: number[] = [], cpY1: number[] = []
    let finX = 0, finY = 0
    let fields: number[][] = []        // je Ziel (Kontrollpunkt 1..n, dann Ziellinie) Entfernung pro Feld
    let mapW = 20, mapH = 15
    let style = 0
    let racing = false
    let started = false
    let track = 0
    let trackCount = 1
    let firstFinishAt = 0

    // ---------------------------------------------------------------- Strecke laden
    function loadTrack(i: number) {
        track = i
        style = trackStyle(i)
        tiles.setCurrentTilemap(trackMap(i))
        scene.setBackgroundColor(15)
        const data = game.currentScene().tileMap.data
        const ts = data.getTileset()
        kindOf = []
        roadIdx = -1
        for (let k = 0; k < ts.length; k++) {
            let kind = K_NONE
            for (let s = 0; s < STYLE_NAMES.length && kind == K_NONE; s++) {
                for (let j = 1; j <= KEY_NAMES.length; j++) {
                    if (ts[k].equals(styleTiles[s][j]) || ts[k].equals(racerGfx.tilesets[s][j])) { kind = j; break }
                }
            }
            for (let n = 0; n < 9 && kind == K_NONE; n++) if (ts[k].equals(cpTiles[n]) || ts[k].equals(racerGfx.tilesets[0][K_CP + n])) kind = K_CP + n
            kindOf.push(kind)
            if (kind == K_ROAD && roadIdx < 0) roadIdx = k
        }
        // Start, Kontrollpunkte und Ziel suchen; Markierungen durch Straße ersetzen
        const sumX = [0, 0, 0, 0, 0, 0, 0, 0, 0], sumY = [0, 0, 0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0]
        cpX0 = [999, 999, 999, 999, 999, 999, 999, 999, 999]; cpY0 = [999, 999, 999, 999, 999, 999, 999, 999, 999]
        cpX1 = [-1, -1, -1, -1, -1, -1, -1, -1, -1]; cpY1 = [-1, -1, -1, -1, -1, -1, -1, -1, -1]
        const starts: tiles.Location[] = []
        mapW = data.width; mapH = data.height
        const targetCells: number[][] = [[], [], [], [], [], [], [], [], [], []]
        const cost: number[] = []
        for (let r = 0; r < mapH; r++) for (let c = 0; c < mapW; c++) {
            const kind = kindOf[data.getTile(c, r)]
            cost.push(kind == K_WALL ? -1 : kind == K_OFF ? 4 : 1)
            if (kind >= K_CP) targetCells[kind - K_CP].push(r * mapW + c)
            if (kind == K_FINISH) targetCells[9].push(r * mapW + c)
        }
        let fx = 0, fy = 0, fn = 0
        cpCount = 0
        for (let r = 0; r < data.height; r++) for (let c = 0; c < data.width; c++) {
            const kind = kindOf[data.getTile(c, r)]
            if (kind >= K_CP) {
                const n = kind - K_CP
                sumX[n] += c * 8 + 4; sumY[n] += r * 8 + 4; cnt[n]++
                cpX0[n] = Math.min(cpX0[n], c * 8); cpY0[n] = Math.min(cpY0[n], r * 8)
                cpX1[n] = Math.max(cpX1[n], c * 8 + 8); cpY1[n] = Math.max(cpY1[n], r * 8 + 8)
                cpCount = Math.max(cpCount, n + 1)
                if (roadIdx >= 0) data.setTile(c, r, roadIdx)
            } else if (kind == K_START) {
                starts.push(tiles.getTileLocation(c, r))
                if (roadIdx >= 0) data.setTile(c, r, roadIdx)
            } else if (kind == K_FINISH) { fx += c * 8 + 4; fy += r * 8 + 4; fn++ }
        }
        cpX = []; cpY = []
        for (let n = 0; n < cpCount; n++) { cpX.push(cnt[n] ? sumX[n] / cnt[n] : 80); cpY.push(cnt[n] ? sumY[n] / cnt[n] : 60) }
        finX = fn ? fx / fn : 80; finY = fn ? fy / fn : 60
        fields = []
        for (let n = 0; n < cpCount; n++) fields.push(buildField(targetCells[n], cost))
        fields.push(buildField(targetCells[9], cost))
        // Autos im 2x2-Raster vor der Ziellinie aufstellen, Blick Richtung Ziel
        let ax = 0, ay = 0
        for (const st of starts) { ax += st.x; ay += st.y }
        if (starts.length) { ax /= starts.length; ay /= starts.length } else { ax = 40; ay = 24 }
        const a0 = dirTo(ax, ay, finX, finY) * Math.PI / 8
        const fx0 = Math.cos(a0), fy0 = Math.sin(a0)
        finishOrder = []
        for (let i = 0; i < MAX_CARS; i++) {
            if (!cars[i]) continue
            const side = (i & 1) ? 7 : -7, back = (i >> 1) * 15 - 7
            cars[i].setPosition(ax - fy0 * side - fx0 * back, ay + fx0 * side - fy0 * back)
            cars[i].vx = 0; cars[i].vy = 0
            stuckSince[i] = 0; reverseUntil[i] = 0
            angle[i] = dirTo(cars[i].x, cars[i].y, finX, finY)
            speed[i] = 0; lap[i] = 0; nextCp[i] = 1; finished[i] = false
            boostUntil[i] = 0; spinUntil[i] = 0
            cars[i].setImage(carFrames[i][Math.round(angle[i]) & 15])
        }
    }

    // Entfernungsfeld zu den Zielfeldern (Wände gesperrt, abseits teurer)
    function buildField(targets: number[], cost: number[]): number[] {
        const n = mapW * mapH
        const d: number[] = []
        for (let k = 0; k < n; k++) d.push(9999)
        for (const t of targets) d[t] = 0
        let changed = true, guard = 0
        while (changed && guard < 200) {
            changed = false
            guard++
            for (let k = 0; k < n; k++) {
                if (cost[k] < 0) continue
                const c = k % mapW, r = Math.idiv(k, mapW)
                let best = d[k]
                if (c > 0 && d[k - 1] + cost[k] < best) best = d[k - 1] + cost[k]
                if (c < mapW - 1 && d[k + 1] + cost[k] < best) best = d[k + 1] + cost[k]
                if (r > 0 && d[k - mapW] + cost[k] < best) best = d[k - mapW] + cost[k]
                if (r < mapH - 1 && d[k + mapW] + cost[k] < best) best = d[k + mapW] + cost[k]
                if (best < d[k]) { d[k] = best; changed = true }
            }
        }
        return d
    }
    function fieldOf(i: number): number[] { return fields[nextCp[i] <= cpCount ? nextCp[i] - 1 : cpCount] }
    function cellOf(x: number, y: number): number {
        return Math.clamp(0, mapH - 1, Math.floor(y / 8)) * mapW + Math.clamp(0, mapW - 1, Math.floor(x / 8))
    }

    function dirTo(x: number, y: number, tx: number, ty: number): number {
        let a = Math.atan2(ty - y, tx - x) / Math.PI * 8
        if (a < 0) a += 16
        return a
    }

    function createCar(i: number) {
        const s = sprites.create(carFrames[i][0], SpriteKind.RcCar)
        s.z = 10
        s.data["i"] = i
        cars[i] = s
    }

    function joinPlayer(i: number) {
        if (i >= maxPlayers || human[i] || !started) return
        human[i] = true
        if (!cars[i]) {
            createCar(i)
            cars[i].setPosition(cars[0] ? cars[0].x : 40, cars[0] ? cars[0].y + 10 : 20)
        }
        play(racerSounds.beep)
    }
    function pressA(k: number) { if (k > 0 && !human[k]) joinPlayer(k) }
    // einzeln registriert: der Web-Compiler erlaubt hier keine Controller aus einer Liste
    controller.player2.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(1) })
    controller.player3.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(2) })
    controller.player4.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(3) })

    // ---------------------------------------------------------------- Fahrphysik
    function kindAt(x: number, y: number): number {
        const tm = game.currentScene().tileMap
        if (!tm) return K_NONE
        const c = Math.floor(x / 8), r = Math.floor(y / 8)
        if (tm.data.isOutsideMap(c, r)) return K_WALL
        return kindOf[tm.data.getTile(c, r)]
    }

    function drive(i: number, dt: number, now: number) {
        const s = cars[i]
        let gas = false, brake = false, steer = 0
        if (human[i]) {
            const ct = ctrls[i]
            gas = ct.A.isPressed() || ct.up.isPressed()
            brake = ct.B.isPressed() || ct.down.isPressed()
            if (ct.left.isPressed()) steer -= 1
            if (ct.right.isPressed()) steer += 1
        } else {
            // Computer: zum nächsten Kontrollpunkt (zuletzt zur Ziellinie) lenken
            // dem Entfernungsfeld drei Felder weit bergab folgen
            const f = fieldOf(i)
            let k = cellOf(s.x, s.y)
            for (let step = 0; step < 3; step++) {
                const c = k % mapW, r = Math.idiv(k, mapW)
                let bk = k
                if (c > 0 && f[k - 1] < f[bk]) bk = k - 1
                if (c < mapW - 1 && f[k + 1] < f[bk]) bk = k + 1
                if (r > 0 && f[k - mapW] < f[bk]) bk = k - mapW
                if (r < mapH - 1 && f[k + mapW] < f[bk]) bk = k + mapW
                k = bk
            }
            const tx = (k % mapW) * 8 + 4, ty = Math.idiv(k, mapW) * 8 + 4
            let diff = dirTo(s.x, s.y, tx, ty) - angle[i]
            while (diff > 8) diff -= 16
            while (diff < -8) diff += 16
            if (diff > 0.4) steer = 1
            else if (diff < -0.4) steer = -1
            gas = Math.abs(diff) < 5
            brake = Math.abs(diff) > 6
            // festgefahren? kurz zurücksetzen und dabei wegdrehen
            if (racing && !finished[i] && Math.abs(speed[i]) < 10) {
                if (stuckSince[i] == 0) stuckSince[i] = now
                else if (now - stuckSince[i] > 700) { reverseUntil[i] = now + 650; stuckSince[i] = 0 }
            } else stuckSince[i] = 0
            if (now < reverseUntil[i]) { gas = false; brake = true; steer = -steer }
        }
        if (finished[i] || !racing) { gas = false; brake = true }

        const ground = kindAt(s.x, s.y)
        let maxSp = topSpeed * (human[i] ? 100 : cpuSkill * 0.92) / 100
        if (ground == K_OFF) maxSp = maxSp * 0.45
        if (now < boostUntil[i]) maxSp = maxSp * 1.6
        if (ground == K_BOOST && now > boostUntil[i] + 300) { boostUntil[i] = now + 900; play(racerSounds.boost) }
        if (ground == K_OIL && now > spinUntil[i] + 600) { spinUntil[i] = now + 700; play(racerSounds.oil) }

        // Gas / Bremse
        if (gas) speed[i] += 130 * dt
        else if (brake) speed[i] -= (speed[i] > 0 ? 220 : 90) * dt
        else speed[i] -= Math.sign(speed[i]) * Math.min(Math.abs(speed[i]), 70 * dt)
        speed[i] = Math.clamp(-35, now < boostUntil[i] ? topSpeed * 1.6 : maxSp, speed[i])
        if (speed[i] > maxSp && now >= boostUntil[i]) speed[i] -= 160 * dt

        // Lenken (nur in Fahrt), auf Öl dreht sich das Auto
        const sp = Math.abs(speed[i])
        if (now < spinUntil[i]) angle[i] += 22 * dt
        else angle[i] += steer * 10 * dt * Math.max(0.35, Math.min(1, sp / 35)) * (speed[i] < 0 ? -1 : 1)
        angle[i] = (angle[i] + 16) % 16

        // Bewegung mit Bodenhaftung (wenig Haftung = Driften)
        const a = Math.round(angle[i]) * Math.PI / 8
        const grip = Math.min(1, (now < spinUntil[i] ? 15 : STYLE_GRIP[style]) / 100 * dt * 12)
        s.vx += (Math.cos(a) * speed[i] - s.vx) * grip
        s.vy += (Math.sin(a) * speed[i] - s.vy) * grip
        const frame = Math.round(angle[i]) & 15
        if (s.data["f"] !== frame) { s.data["f"] = frame; s.setImage(carFrames[i][frame]) }

        // Aufprall an Wänden bremst
        if (s.isHittingTile(CollisionDirection.Left) || s.isHittingTile(CollisionDirection.Right)
            || s.isHittingTile(CollisionDirection.Top) || s.isHittingTile(CollisionDirection.Bottom)) {
            if (sp > 40) { play(racerSounds.crash); scene.cameraShake(1, 100) }
            speed[i] = speed[i] * 0.5
        }

        // Kontrollpunkte und Runden
        // Kontrollpunkt-Kacheln wurden durch Straße ersetzt: Feld des Kontrollpunkts oder sein Rechteck
        if (nextCp[i] <= cpCount) {
            const n = nextCp[i] - 1
            if (fields[n][cellOf(s.x, s.y)] == 0 || (s.x >= cpX0[n] - 4 && s.x <= cpX1[n] + 4 && s.y >= cpY0[n] - 4 && s.y <= cpY1[n] + 4)) nextCp[i]++
        } else if (ground == K_FINISH && !finished[i]) {
            lap[i]++
            nextCp[i] = 1
            if (lapHandler && human[i]) lapHandler(i + 1, lap[i])
            if (lap[i] >= laps) {
                finished[i] = true
                finishOrder.push(i)
                if (finishOrder.length == 1) firstFinishAt = now
                play(racerSounds.go)
            } else play(racerSounds.lap)
        }
    }

    // Autos stoßen sich gegenseitig ab
    sprites.onOverlap(SpriteKind.RcCar, SpriteKind.RcCar, function (a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        a.x -= dx / d * 2; a.y -= dy / d * 2
        b.x += dx / d * 2; b.y += dy / d * 2
        const ia: number = a.data["i"], ib: number = b.data["i"]
        speed[ia] = speed[ia] * 0.85
        speed[ib] = speed[ib] * 0.85
    })

    function progressOf(i: number): number {
        if (!cars[i]) return -1
        const tx = nextCp[i] <= cpCount ? cpX[nextCp[i] - 1] : finX
        const ty = nextCp[i] <= cpCount ? cpY[nextCp[i] - 1] : finY
        const d = Math.abs(cars[i].x - tx) + Math.abs(cars[i].y - ty)
        return lap[i] * 100 + nextCp[i] * 10 - d / 100
    }
    function standings(): number[] {
        const order = finishOrder.slice(0)
        const rest: number[] = []
        for (let i = 0; i < MAX_CARS; i++) if (cars[i] && order.indexOf(i) < 0) rest.push(i)
        rest.sort((x, y) => progressOf(y) - progressOf(x))
        return order.concat(rest)
    }

    game.onUpdate(function () {
        if (!started) return
        const dt = Math.min(0.05, game.eventContext().deltaTime)
        const now = game.runtime()
        for (let i = 0; i < MAX_CARS; i++) if (cars[i]) drive(i, dt, now)
    })

    // ---------------------------------------------------------------- Anzeige
    scene.createRenderable(100, function (target: Image, camera: scene.Camera) {
        if (!started) return
        const order = standings()
        for (let i = 0; i < MAX_CARS; i++) {
            if (!cars[i]) continue
            const x = i * 40
            target.fillRect(x, 0, 40, 7, 15)
            target.fillRect(x + 1, 1, 4, 5, CAR_COLORS[i])
            const pos = order.indexOf(i) + 1
            const txt = (finished[i] ? "Ziel" : "R" + Math.min(laps, lap[i] + 1) + "/" + laps) + " " + pos + "."
            target.print(txt, x + 7, 1, human[i] ? 1 : 11, image.font5)
        }
    })

    function banner(lines: string[], ms: number) {
        const h = 8 + lines.length * 10
        const img = image.create(150, h)
        img.fill(15)
        img.drawRect(0, 0, 150, h, 1)
        for (let k = 0; k < lines.length; k++) img.printCenter(lines[k], 5 + k * 10, k == 0 ? 5 : 1, image.font8)
        const b = sprites.create(img, SpriteKind.RcFx)
        b.setFlag(SpriteFlag.Ghost, true)
        b.setPosition(80, 60)
        b.z = 200
        b.lifespan = ms
    }

    // ---------------------------------------------------------------- Ablauf
    function runRace() {
        loadTrack(track)
        racing = false
        banner([trackName(track), laps + " Runden"], 1800)
        pause(1900)
        for (let n = 3; n >= 1; n--) { banner(["" + n], 650); play(racerSounds.beep); pause(700) }
        banner(["LOS!"], 600)
        play(racerSounds.go)
        racing = true
        firstFinishAt = 0
        // Rennen läuft, bis alle Menschen im Ziel sind oder 12 s nach dem Sieger
        while (true) {
            pause(100)
            let humansOpen = 0, open = 0
            for (let i = 0; i < MAX_CARS; i++) if (cars[i] && !finished[i]) { open++; if (human[i]) humansOpen++ }
            if (open == 0 || (firstFinishAt > 0 && (humansOpen == 0 || game.runtime() - firstFinishAt > 12000))) break
        }
        racing = false
        const order = standings()
        const lines = ["Ergebnis " + trackName(track)]
        for (let k = 0; k < order.length; k++) {
            points[order[k]] += POINTS[k]
            lines.push((k + 1) + ". " + carLabel(order[k]) + " +" + POINTS[k])
        }
        if (raceHandler) raceHandler(order[0] + 1)
        music.play(racerSounds.raceTune, music.PlaybackMode.InBackground)
        banner(lines, 3500)
        pause(3700)
    }

    function carLabel(i: number): string { return (human[i] ? "Spieler " + (i + 1) : "CPU " + CAR_NAMES[i]) }

    //% blockId=pr_start block="starte Pixel-Racer"
    //% group="Start" weight=100
    export function startGame() {
        if (started) return
        control.runInParallel(function () {
            resolveAssets()
            trackCount = Math.max(1, countTracks())
            game.setGameOverPlayable(true, racerSounds.winTune, false)
            game.setGameOverPlayable(false, racerSounds.endTune, false)
            play(racerSounds.startTune)
            game.splash(title, "A = Gas, B = Bremse, < > lenken")
            started = true
            human[0] = true
            for (let i = 0; i < MAX_CARS; i++) if (i == 0 || cpuCars || human[i]) createCar(i)
            banner(["Weitere Spieler:", "A druecken!"], 2000)
            for (track = 0; track < trackCount; track++) runRace()
            // Meisterschaft auswerten
            let best = 0
            for (let i = 1; i < MAX_CARS; i++) if (cars[i] && points[i] > points[best]) best = i
            const lines = ["Meisterschaft"]
            const ord: number[] = []
            for (let i = 0; i < MAX_CARS; i++) if (cars[i]) ord.push(i)
            ord.sort((x, y) => points[y] - points[x])
            for (let k = 0; k < ord.length; k++) lines.push((k + 1) + ". " + carLabel(ord[k]) + " " + points[ord[k]] + " P.")
            banner(lines, 4000)
            pause(4200)
            game.setGameOverMessage(human[best], human[best] ? "Spieler " + (best + 1) + " ist Meister!" : "Die CPU gewinnt!")
            game.over(human[best])
        })
    }

    //% blockId=pr_title block="setze Titel auf $text"
    //% text.defl="PIXEL-RACER"
    //% group="Start" weight=90
    export function setTitle(text: string) { title = text }

    /**
     * Legt eine Strecke fest (Tilemap mit 8x8-Kacheln, 20x15 Felder). Kontrollpunkte
     * rcCheck1, rcCheck2 ... in Fahrtrichtung, Startplätze mit der Start-Kachel.
     */
    //% blockId=pr_set_track block="Strecke $n Karte $map Stil $s"
    //% n.min=1 n.max=9 n.defl=1
    //% map.shadow=tiles_tilemap_editor
    //% inlineInputMode=inline
    //% group="Strecken" weight=100
    export function setTrack(n: number, map: tiles.TileMapData, s: Style) {
        const i = Math.clamp(1, MAX_TRACKS, n) - 1
        trackMaps[i] = map
        trackStyles[i] = s
    }

    //% blockId=pr_laps block="setze Runden auf $n"
    //% n.min=1 n.max=20 n.defl=3
    //% group="Einstellungen" weight=100
    export function setLaps(n: number) { laps = Math.max(1, n) }

    //% blockId=pr_max_players block="erlaube bis zu $n Spieler"
    //% n.min=1 n.max=4 n.defl=4
    //% group="Einstellungen" weight=90
    export function setMaxPlayers(n: number) { maxPlayers = Math.clamp(1, MAX_CARS, n) }

    //% blockId=pr_cpu block="Computer-Fahrer $on"
    //% on.shadow=toggleOnOff on.defl=true
    //% group="Einstellungen" weight=80
    export function setCpuCars(on: boolean) { cpuCars = on }

    //% blockId=pr_cpu_skill block="setze Stärke der Computer-Fahrer auf $percent \\%"
    //% percent.min=50 percent.max=130 percent.defl=100
    //% group="Einstellungen" weight=70
    export function setCpuSkill(percent: number) { cpuSkill = percent }

    //% blockId=pr_top_speed block="setze Höchsttempo auf $v"
    //% v.min=40 v.max=160 v.defl=90
    //% group="Einstellungen" weight=60
    export function setTopSpeed(v: number) { topSpeed = v }

    //% blockId=pr_on_lap block="wenn Spieler $player Runde $lap schafft"
    //% draggableParameters="reporter"
    //% group="Ereignisse" weight=100
    export function onLap(handler: (player: number, lap: number) => void) { lapHandler = handler }

    //% blockId=pr_on_race block="wenn Rennen endet mit Sieger $winner"
    //% draggableParameters="reporter"
    //% group="Ereignisse" weight=90
    export function onRaceEnd(handler: (winner: number) => void) { raceHandler = handler }

    //% blockId=pr_car block="Auto von Spieler $n"
    //% n.min=1 n.max=4 n.defl=1
    //% group="Werte" weight=100
    export function carOf(n: number): Sprite { return cars[Math.clamp(1, MAX_CARS, n) - 1] }

    //% blockId=pr_lap_of block="Runde von Spieler $n"
    //% n.min=1 n.max=4 n.defl=1
    //% group="Werte" weight=90
    export function lapOf(n: number): number { return lap[Math.clamp(1, MAX_CARS, n) - 1] }

    //% blockId=pr_points block="Punkte von Spieler $n"
    //% n.min=1 n.max=4 n.defl=1
    //% group="Werte" weight=80
    export function pointsOf(n: number): number { return points[Math.clamp(1, MAX_CARS, n) - 1] }

    //% blockId=pr_track block="aktuelle Strecke"
    //% group="Werte" weight=70
    export function currentTrack(): number { return Math.min(track, trackCount - 1) + 1 }
}
