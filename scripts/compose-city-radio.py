"""Render two original, loopable game radio instrumentals using the Python standard library."""
from array import array
import math
from pathlib import Path
import random
import subprocess
import tempfile
import wave

RATE = 22050
TAU = math.tau

SONGS = [
    ('tide-fm', 114, [45, 41, 48, 43], [0, 3, 7, 10], [12, 15, 19, 17, -1, 15, 22, 19]),
    ('harbor-fm', 97, [47, 50, 45, 43], [0, 4, 7, 11], [16, -1, 19, 23, 21, 16, -1, 14]),
]


def render(bpm, roots, chord, motif):
    beat = 60 / bpm
    duration = 16 * 4 * beat
    samples = array('f', [0]) * round(duration * RATE)
    randomizer = random.Random(73 + bpm)

    def add(position, length, note, volume, kind):
        start = round(position * RATE)
        hz = 440 * 2 ** ((note - 69) / 12)
        for i in range(round(length * RATE)):
            t = i / RATE
            phase = TAU * hz * t
            attack = min(1, t / (0.035 if kind == 'pad' else 0.005))
            tail = min(1, (length - t) / 0.058)
            if kind == 'kick':
                sound = math.sin(TAU * (48 * t + 3.2 * (1 - math.exp(-20 * t)))) * math.exp(-t * 16)
            elif kind == 'snare':
                sound = (randomizer.uniform(-1, 1) * 0.77 + math.sin(TAU * 174 * t) * 0.28) * math.exp(-t * 31)
            elif kind == 'hat':
                sound = randomizer.uniform(-1, 1) * math.exp(-t * 72)
            else:
                sound = math.sin(phase + math.sin(phase * 2.01) * 0.14) * 0.66 + math.sin(phase * 2) * 0.18
                sound += math.sin(phase * 3.005) * 0.09
                if kind == 'lead':
                    sound *= math.exp(-t * 4)
            samples[(start + i) % len(samples)] += sound * volume * attack * tail

    for bar in range(16):
        root = roots[(bar // 2) % 4]
        at = bar * beat * 4
        for offset in (0, 1.5, 2, 3.5):
            add(at + offset * beat, 0.2, 36, 0.40, 'kick')
        for offset in (1, 3):
            add(at + offset * beat, 0.17, 47, 0.28, 'snare')
        for i in range(8):
            add(at + (i / 2 + 0.025 * (i % 2)) * beat, 0.087, 70, 0.12 if i % 2 else 0.072, 'hat')
        for i, note in enumerate((0, 0, 7, 10, 0, 12, 7, 3)):
            add(at + beat * i / 2, beat * 0.41, root + note - 12, 0.21, 'bass')
        for interval in chord:
            add(at + 0.06, beat * 3.78, root + interval + 12, 0.063, 'pad')
        for i, interval in enumerate(motif):
            if interval < 0 or (bar % 4 == 0 and i > 3):
                continue
            note = root + interval + (12 if bar % 8 >= 4 else 0)
            add(at + beat * i / 2, beat * 0.52, note, 0.15, 'lead')
            add(at + beat * (i / 2 + 0.75), beat * 0.56, note, 0.049, 'lead')
    return array('h', [round(math.tanh(value * 1.15) * 28500) for value in samples])


if __name__ == '__main__':
    output = Path(__file__).resolve().parent.parent / 'public' / 'media'
    with tempfile.TemporaryDirectory() as directory:
        for name, *score in SONGS:
            temporary = Path(directory) / (name + '.wav')
            with wave.open(str(temporary), 'wb') as stream:
                stream.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
                stream.writeframes(render(*score).tobytes())
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(temporary),
                            '-c:a', 'libmp3lame', '-b:a', '80k', str(output / (name + '.mp3'))], check=True)
