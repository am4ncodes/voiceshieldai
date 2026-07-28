import os
import librosa
import librosa.display
import matplotlib.pyplot as plt

import noisereduce as nr
import soundfile as sf
import numpy as np

os.makedirs("output/cleaned_audio/real", exist_ok=True)
os.makedirs("output/cleaned_audio/fake", exist_ok=True)

# =====================================================
# Create output folders
# =====================================================

os.makedirs("output/waveforms/real", exist_ok=True)
os.makedirs("output/waveforms/fake", exist_ok=True)

os.makedirs("output/spectrograms/real", exist_ok=True)
os.makedirs("output/spectrograms/fake", exist_ok=True)

# =====================================================
# Function to process one audio file
# =====================================================

def process_audio(audio_path, category):

    print("\n----------------------------------------")
    print(f"Processing : {audio_path}")

    # Load audio
    y, sr = librosa.load(audio_path, sr=16000)

    # Normalize Audio

    y = librosa.util.normalize(y)

    print("Audio normalized.")

    # Noise Reduction

    clean_audio = nr.reduce_noise(
        y=y,
        sr=sr,
        stationary=True
    )

    print("Noise reduced.")



    # Audio Information
    print(f"Sample Rate      : {sr} Hz")
    print(f"Samples          : {len(clean_audio)}")
    print(f"Duration         : {len(clean_audio)/sr:.2f} seconds")
    print(f"Data Type        : {clean_audio.dtype}")

    # File name
    filename = os.path.splitext(os.path.basename(audio_path))[0]

    clean_path = f"output/cleaned_audio/{category}/{filename}_clean.wav"

    sf.write(
        clean_path,
        clean_audio,
        sr
    )

    print("Cleaned audio saved!")

    # Plot waveform
    plt.figure(figsize=(12,4))

    librosa.display.waveshow(
        clean_audio,
        sr=sr
    )

    plt.title(f"Waveform - {filename}")
    plt.xlabel("Time (seconds)")
    plt.ylabel("Amplitude")

    save_path = f"output/waveforms/{category}/{filename}_waveform.png"

    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()

    print("Waveform Saved Successfully!")

    # ======================================
    # Generate Spectrogram
    # ======================================

    D = librosa.amplitude_to_db(
        np.abs(librosa.stft(clean_audio)),
        ref=np.max
    )

    plt.figure(figsize=(12,5))

    librosa.display.specshow(
        D,
        sr=sr,
        x_axis="time",
        y_axis="log",
        cmap="magma"
    )

    plt.colorbar(format="%+2.0f dB")
    plt.title(f"Spectrogram - {filename}")

    spectrogram_path = f"output/spectrograms/{category}/{filename}_spectrogram.png"

    plt.tight_layout()
    plt.savefig(spectrogram_path)
    plt.close()

    print("Spectrogram Saved Successfully!")   

# =====================================================
# Process all REAL audio
# =====================================================

real_folder = "audio/real"

for file in os.listdir(real_folder):

    if file.lower().endswith(".wav"):

        process_audio(
            os.path.join(real_folder, file),
            "real"
        )

# =====================================================
# Process all FAKE audio
# =====================================================

fake_folder = "audio/fake"

for file in os.listdir(fake_folder):

    if file.lower().endswith(".wav"):

        process_audio(
            os.path.join(fake_folder, file),
            "fake"
        )

print("\n===================================")
print("ALL AUDIO FILES PROCESSED")
print("===================================")