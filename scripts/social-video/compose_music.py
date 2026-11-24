"""Original JobVerify instrumental bed, composed for this template (CC0).

Four soft A-minor/F/C/G pads, 80 BPM, eight bars. No samples or third-party music.
Reproduce exactly: python scripts/social-video/compose_music.py
"""
from array import array
import math
from pathlib import Path
import wave


def compose():
    rate = 48000; seconds = 24; samples = array("h")
    chords = [(220, 261.6256, 329.6276), (174.6141, 220, 261.6256), (130.8128, 164.8138, 195.9977), (195.9977, 246.9417, 293.6648)]
    for index in range(rate * seconds):
        time = index / rate; within = time % 6
        envelope = min(1, within / 0.7, (6 - within) / 0.9)
        tones = chords[int(time // 6)]
        pad = sum(math.sin(2 * math.pi * note * time) + 0.12 * math.sin(4 * math.pi * note * time) for note in tones) / 3.36
        # A soft pulse supplies motion without competing with the narrator.
        pulse = 0.82 + 0.18 * math.sin(2 * math.pi * (80 / 60) * time) ** 2
        samples.append(round(32767 * 0.19 * envelope * pulse * pad))
    path = Path(__file__).with_name("assets") / "instrumental.wav"
    path.parent.mkdir(exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, rate, 0, "NONE", "not compressed")); output.writeframes(samples.tobytes())


if __name__ == "__main__":
    compose()
