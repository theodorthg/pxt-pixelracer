// AUTOMATISCH ERZEUGT von tools/build-assets.js – Sounds in tools/config.js ändern.
namespace racerSounds {
    export const lap = music.createSoundEffect(WaveShape.Triangle, 1375, 1736, 138, 0, 97, SoundExpressionEffect.None, InterpolationCurve.Logarithmic)
    export const boost = music.createSoundEffect(WaveShape.Triangle, 352, 1726, 136, 28, 404, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const crash = music.createSoundEffect(WaveShape.Square, 706, 212, 180, 0, 113, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const oil = music.createSoundEffect(WaveShape.Sawtooth, 540, 58, 137, 11, 727, SoundExpressionEffect.Warble, InterpolationCurve.Linear)
    export const beep = music.createSoundEffect(WaveShape.Sine, 1092, 1092, 100, 0, 63, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const go = music.createSoundEffect(WaveShape.Square, 832, 832, 76, 0, 68, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const startTune = music.melodyPlayable(new music.Melody("g#4:2-169 c5:2 d#5:2 g#5:2 r:1 f5:2 g#5:8"))
    export const raceTune = music.melodyPlayable(new music.Melody("b4:1-164 d5:1 g5:1 g6:5"))
    export const winTune = music.melodyPlayable(new music.Melody("f4:2-152 f4:1 f4:1 c5:4 a4:2 c5:2 f5:6 r:1 e5:1 f5:8"))
    export const endTune = music.melodyPlayable(new music.Melody("c#5:3-95 c5:3 a#4:3 f3:10"))
}
