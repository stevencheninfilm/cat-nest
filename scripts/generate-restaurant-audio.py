"""Original Cat Restaurant score. Requires numpy; AAC export uses macOS afconvert.

No samples or downloaded music. Re-run to reproduce every note and sound effect.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import wave
import numpy as np

RATE = 32000
OUT = Path(__file__).resolve().parents[1] / 'public/assets/restaurant/audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20261019)


def pitch(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def tone(midi, seconds, instrument='piano'):
    t = np.arange(round(seconds * RATE)) / RATE
    f = pitch(midi)
    if instrument == 'bass':
        y = np.sin(2*np.pi*f*t) + .23*np.sin(4*np.pi*f*t)
        env = (1-np.exp(-t/0.014))*np.exp(-t/0.38)
    elif instrument == 'pad':
        y = (np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*1.002*t)+.12*np.sin(4*np.pi*f*t))*.7
        env = np.minimum(t/.35, 1)*np.minimum((seconds-t)/.65, 1)
    elif instrument == 'bell':
        y = np.sin(2*np.pi*f*t)+.24*np.sin(2*np.pi*f*2.004*t)*np.exp(-t*3)+.07*np.sin(2*np.pi*f*3.01*t)*np.exp(-t*5)
        env = (1-np.exp(-t/.003))*np.exp(-t/0.68)
    elif instrument == 'pluck':
        y = sum(np.sin(2*np.pi*f*n*t)*np.exp(-t*n*2.2)/n**1.6 for n in range(1, 6))
        env = (1-np.exp(-t/.004))*np.exp(-t/.55)
    elif instrument == 'flute':
        vibrato = .002*np.sin(2*np.pi*4.8*t)*np.minimum(t/.2, 1)
        phase = 2*np.pi*f*t + vibrato*np.sin(2*np.pi*f*t)
        y = np.sin(phase)+.13*np.sin(phase*2)+.035*np.sin(phase*3)
        env = (1-np.exp(-t/.04))*np.exp(-t/.7)
    else:
        # Slightly inharmonic, increasingly damped upper partials of a felt piano.
        y = sum(np.sin(2*np.pi*f*n*(1+.00018*n*n)*t)*np.exp(-t*n*.8)/n**1.9 for n in range(1, 7))
        env = (1-np.exp(-t/.006))*np.exp(-t/.85)
    return y*env*np.minimum((seconds-t)/.025, 1)


def add(buf, y, at, level=1, pan=0, loop=True):
    idx = np.arange(len(y)) + round(at*RATE)
    if loop:
        idx %= len(buf)
    else:
        keep = idx < len(buf)
        y, idx = y[keep], idx[keep]
    buf[idx, 0] += y*level*math.sqrt((1-pan)/2)
    buf[idx, 1] += y*level*math.sqrt((1+pan)/2)


def finish(buf, peak=.68, loop=False):
    # Short, cross-channel room reflections wrap into the start of the music loop.
    dry = buf.copy()
    for delay, gain in [(.083, .12), (.157, .075), (.269, .035)]:
        shift = round(delay*RATE)
        if loop:
            buf += np.roll(dry[:, ::-1], shift, axis=0)*gain
        else:
            buf[shift:] += dry[:-shift, ::-1]*gain
    buf -= buf.mean(axis=0)
    buf = np.tanh(buf*.9)
    buf *= peak/max(float(np.abs(buf).max()), 1e-8)
    if not loop:
        n = min(300, len(buf)//8)
        buf[:n] *= np.linspace(0, 1, n)[:, None]
        buf[-n:] *= np.linspace(1, 0, n)[:, None]
    return buf


def write(name, buf, loop=False, **meta):
    data = finish(buf, loop=loop)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp)/'source.wav' if loop else OUT/f'{name}.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setparams((2, 2, RATE, len(data), 'NONE', 'not compressed'))
            w.writeframes((data*32767).astype('<i2').tobytes())
        dest = OUT/f'{name}.m4a' if loop else wav
        if loop:
            subprocess.run(['afconvert', str(wav), str(dest), '-f', 'm4af', '-d', 'aac', '-b', '128000'], check=True)
    return dict(file=dest.name, seconds=round(len(data)/RATE, 6), sampleRate=RATE,
                peak=round(float(np.abs(data).max()), 5), rms=round(float(np.sqrt(np.mean(data**2))), 5),
                seamDelta=round(float(np.max(np.abs(data[0]-data[-1]))), 6) if loop else 0,
                sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), **meta)


def cafe():
    beat = 60/92
    buf = np.zeros((round(64*beat*RATE), 2))
    # Cmaj7 — Am7 — Dm9 — G6, with a warm Fmaj7 bridge.
    chords = [[48,55,59,64],[45,55,60,64],[50,57,60,65],[43,55,59,64],
              [48,55,59,64],[45,55,60,64],[53,57,60,64],[43,55,59,62],
              [53,57,60,64],[52,55,59,62],[50,57,60,64],[43,55,59,64],
              [48,55,59,64],[45,55,60,64],[50,57,60,65],[43,55,59,62]]
    melody = [[76,79,81,79],[76,72,74,76],[77,81,79,77],[74,71,72,74],
              [76,79,84,83],[81,79,76,72],[77,76,74,72],[74,79,77,74],
              [81,79,77,76],[79,76,74,71],[77,81,79,76],[74,71,74,79],
              [76,79,81,79],[76,72,74,76],[77,76,74,71],[74,71,67,71]]
    for bar, chord in enumerate(chords):
        t = bar*4*beat
        for n in [0, 2]:
            add(buf, tone(chord[0]+(7 if n else 0), .65, 'bass'), t+n*beat, .22, -.08)
        for off in [.08, 1.55, 2.65]:
            for j, note in enumerate(chord[1:]):
                add(buf, tone(note, 1.7), t+(off+j*.025)*beat, .09, -.35)
        for j, note in enumerate(melody[bar]):
            # Leave breathing room at the end of each phrase.
            off = [0, .65, 1.65, 2.65][j]
            add(buf, tone(note, 1.5, 'pluck'), t+off*beat, .14 if j<3 else .105, .24)
        for off in [.66, 1.66, 2.66, 3.66]:
            tick = rng.normal(0, 1, round(.085*RATE))
            tick = np.convolve(tick, np.ones(8)/8, mode='same')
            tick *= np.exp(-np.arange(len(tick))/RATE*65)
            add(buf, tick, t+off*beat, .035, .45)
    return write('cafe-little-sunshine', buf, True, title='小馆的晴天', bpm=92, bars=16, key='C major')


def research():
    beat = 60/78
    buf = np.zeros((round(64*beat*RATE), 2))
    chords = [[50,57,61,66],[47,54,57,61],[55,59,62,66],[45,57,61,64]]*4
    themes = [[78,81,85,83],[81,78,76,73],[79,83,86,85],[81,76,73,76],
              [78,81,85,90],[88,85,81,78],[83,86,85,79],[81,78,76,73]]*2
    for bar, chord in enumerate(chords):
        t = bar*4*beat
        for note in chord:
            add(buf, tone(note, 4*beat, 'pad'), t, .043, -.1)
        for j in range(8):
            note = chord[1+j%3]+(12 if j%4==3 else 0)
            add(buf, tone(note, 2, 'pluck'), t+(j*.5+.04)*beat, .058, -.4 if j%2 else .35)
        for j, note in enumerate(themes[bar]):
            add(buf, tone(note, 2.7, 'bell'), t+[0, .75, 1.75, 3][j]*beat, .13, .28)
    return write('research-starlit-recipe', buf, True, title='星光里的秘密食谱', bpm=78, bars=16, key='D major')


def effect(name, notes, length, instrument='bell'):
    buf = np.zeros((round(length*RATE), 2))
    for at, note, seconds, level in notes:
        add(buf, tone(note, seconds, instrument), at, level, loop=False)
    return write(name, buf)


def garden():
    beat = 60/84
    buf = np.zeros((round(48*beat*RATE), 2))
    chords = [[41,57,60,64],[38,57,60,65],[43,55,58,62],[36,55,58,64],
              [41,57,60,65],[45,57,60,64],[46,58,62,65],[36,55,58,64]]*2
    melody = [[77,81,79],[77,74,72],[74,77,79],[76,74,72],
              [77,81,84],[81,79,76],[77,74,70],[72,76,79],
              [81,84,86],[84,81,77],[79,82,81],[79,76,72],
              [77,79,81],[79,77,74],[77,74,72],[76,72,69]]
    for bar, chord in enumerate(chords):
        at = bar*3*beat
        add(buf, tone(chord[0], .9, 'bass'), at, .16, -.12)
        for off in [1, 2]:
            for j, note in enumerate(chord[1:]):
                add(buf, tone(note, 1.6, 'pluck'), at+(off+j*.025)*beat, .075, -.35)
        for j, note in enumerate(melody[bar]):
            add(buf, tone(note, 1.6, 'flute'), at+[.08, 1.08, 2.12][j]*beat, .12, .22)
    return write('garden-afternoon', buf, True, title='花园午后', bpm=84, bars=16, key='F major', meter='3/4')


def rain():
    beat = 60/72
    buf = np.zeros((round(48*beat*RATE), 2))
    chords = [[39,55,58,62],[36,55,58,63],[44,56,60,63],[46,53,56,60],
              [43,55,58,62],[48,55,58,63],[41,56,60,63],[46,53,56,62]]*2
    melodies = [[79,77,74],[75,79,82],[80,79,75],[77,74,72],
                [74,77,79],[79,75,72],[77,80,79],[77,74,70],
                [82,79,77],[79,82,87],[84,80,79],[82,77,74],
                [79,77,74],[75,72,70],[72,77,75],[74,70,67]]
    for bar, chord in enumerate(chords):
        at = bar*3*beat
        add(buf, tone(chord[0], 1.5, 'bass'), at, .12, -.12)
        for j in range(6):
            add(buf, tone(chord[1+j%3], 2.3), at+j*.5*beat, .055, -.25 if j%2 else .2)
        for j, note in enumerate(melodies[bar]):
            add(buf, tone(note, 2.5), at+[.15, 1.3, 2.1][j]*beat, .10, .1)
        for note in chord[1:]:
            add(buf, tone(note-12, 3*beat, 'pad'), at, .022, -.1)
    return write('rain-window-coffee', buf, True, title='雨窗慢咖啡', bpm=72, bars=16, key='Eb major', meter='6/8')


def bakery():
    beat = 60/108
    buf = np.zeros((round(64*beat*RATE), 2))
    chords = [[48,55,59,64],[45,55,60,64],[50,57,60,65],[43,55,59,62]]*4
    melodies = [[76,79,84,79,76],[81,79,76,72,76],[77,81,79,77,74],[79,77,74,71,74],
                [79,84,88,84,79],[81,84,81,79,76],[81,77,74,77,81],[79,74,71,74,79],
                [84,83,81,79,76],[81,79,76,72,69],[77,79,81,84,81],[79,77,74,71,67],
                [76,79,84,79,76],[81,79,76,72,76],[77,81,79,77,74],[74,71,67,71,74]]
    for bar, chord in enumerate(chords):
        at = bar*4*beat
        for off, note in enumerate([chord[0], chord[0]+7, chord[0]+12, chord[0]+7]):
            add(buf, tone(note, .5, 'bass'), at+off*beat, .17, -.15)
        for off in [.65, 1.65, 2.65, 3.65]:
            for j, note in enumerate(chord[1:]):
                add(buf, tone(note, .8, 'pluck'), at+(off+j*.018)*beat, .065, -.25)
        for j, note in enumerate(melodies[bar]):
            add(buf, tone(note, .9, 'bell'), at+[0, .66, 1.5, 2, 2.66][j]*beat, .095, .25)
    return write('paw-bakery-parade', buf, True, title='猫爪烘焙舞', bpm=108, bars=16, key='C major')


def moon():
    beat = 60/74
    buf = np.zeros((round(48*beat*RATE), 2))
    chords = [[50,57,60,65],[46,58,62,65],[53,57,60,64],[48,55,58,64]]*4
    melody = [[81,77,74],[82,79,77],[81,84,81],[79,76,72],
              [86,84,81],[82,86,89],[84,81,77],[79,76,74],
              [81,86,89],[86,82,79],[84,81,77],[79,76,72],
              [77,81,86],[82,79,77],[81,77,76],[79,76,72]]
    for bar, chord in enumerate(chords):
        at = bar*3*beat
        for note in chord:
            add(buf, tone(note, 3*beat, 'pad'), at, .032, -.12)
        for j in range(6):
            add(buf, tone(chord[1+j%3]+12, 2, 'pluck'), at+j*.5*beat, .045, -.4 if j%2 else .4)
        for j, note in enumerate(melody[bar]):
            add(buf, tone(note, 2.7, 'bell'), at+[0, .9, 1.9][j]*beat, .10, .15)
    return write('moonlit-recipe-notes', buf, True, title='月光手札', bpm=74, bars=16, key='D minor', meter='3/4')


music = json.loads((OUT/'manifest.json').read_text())['music'] if any(arg in sys.argv for arg in ['--effects-only','--add-choices']) else {'restaurant':cafe(), 'research':research()}
if '--effects-only' not in sys.argv:
    music.update(garden=garden(), rain=rain(), bakery=bakery(), moon=moon())
manifest = {'version':1, 'composition':'Original deterministic synthesis; no external samples', 'music':music, 'effects':{}}
effects = manifest['effects']
# A low wooden pop with a smooth pitch fall; no piercing upper note or long tail.
click_t = np.arange(round(.105*RATE))/RATE
click_y = (np.sin(2*np.pi*(620*click_t-1800*click_t**2))+.16*np.sin(2*np.pi*390*click_t))*(1-np.exp(-click_t/.0015))*np.exp(-click_t*55)
click_buf = np.zeros((len(click_t), 2));add(click_buf, click_y, 0, .6, loop=False)
effects['click'] = write('click-soft-v2', click_buf)
effects['accept'] = effect('accept', [(0,72,.24,.4),(.08,79,.3,.4)], .48, 'piano')
effects['step'] = effect('step', [(0,77,.2,.35),(.045,84,.22,.25)], .35, 'pluck')
effects['complete'] = effect('complete', [(0,76,.28,.3),(.08,79,.32,.3),(.16,84,.42,.33)], .72)
effects['serve'] = effect('serve', [(0,72,.35,.4),(.1,76,.35,.35),(.2,79,.5,.35)], .85, 'piano')
effects['collect'] = effect('collect', [(0,84,.25,.3),(.075,88,.3,.3),(.15,91,.5,.3)], .8)
effects['draw'] = effect('draw', [(i*.085,n,.7,.25) for i,n in enumerate([66,69,73,78,81,85])], 1.3)
effects['flip'] = effect('flip', [(0,85,.16,.3),(.045,78,.19,.25)], .32, 'pluck')
effects['reveal'] = effect('reveal', [(0,78,1.1,.25),(.08,85,1,.25),(.16,90,1.1,.3),(.28,93,1.2,.22)], 1.6)
effects['upgrade'] = effect('upgrade', [(0,72,.5,.3),(.12,76,.5,.3),(.24,79,.55,.32),(.38,84,.7,.3),(.4,76,.65,.15)], 1.25)
effects['decorate'] = effect('decorate', [(0,60,.15,.4),(.09,67,.18,.32),(.2,72,.3,.28)], .55, 'pluck')
effects['decoration-complete'] = effect('decoration-complete', [(0,72,.8,.25),(.04,76,.8,.23),(.08,79,.85,.25),(.3,88,.8,.22)], 1.35)
(OUT/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
