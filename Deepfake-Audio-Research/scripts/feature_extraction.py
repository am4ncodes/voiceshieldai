import os
import librosa
import numpy as np
import pandas as pd

# Create output folder
os.makedirs("output/features", exist_ok=True)

# Store all extracted features
all_features = []

# ==========================================
# Feature Extraction Function
# ==========================================

def extract_features(audio_path, label):

    print(f"\nProcessing : {audio_path}")

    # Load cleaned audio
    y, sr = librosa.load(audio_path, sr=16000)

    # ---------------- MFCC ----------------
    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sr,
        n_mfcc=13
    )

    mfcc_mean = np.mean(mfcc, axis=1)

    # ---------------- Chroma ----------------
    chroma = librosa.feature.chroma_stft(
        y=y,
        sr=sr
    )

    chroma_mean = np.mean(chroma)

    # ---------------- Spectral Centroid ----------------
    centroid = librosa.feature.spectral_centroid(
        y=y,
        sr=sr
    )

    centroid_mean = np.mean(centroid)

    # ---------------- Spectral Bandwidth ----------------
    bandwidth = librosa.feature.spectral_bandwidth(
        y=y,
        sr=sr
    )

    bandwidth_mean = np.mean(bandwidth)

    # ---------------- Spectral Rolloff ----------------
    rolloff = librosa.feature.spectral_rolloff(
        y=y,
        sr=sr
    )

    rolloff_mean = np.mean(rolloff)

    # ---------------- Zero Crossing Rate ----------------
    zcr = librosa.feature.zero_crossing_rate(y)

    zcr_mean = np.mean(zcr)

    # ---------------- RMS Energy ----------------
    rms = librosa.feature.rms(y=y)

    rms_mean = np.mean(rms)

    # ---------------- Pitch ----------------
    pitches, magnitudes = librosa.piptrack(
        y=y,
        sr=sr
    )

    pitch = pitches[pitches > 0]

    if len(pitch) > 0:
        pitch_mean = np.mean(pitch)
    else:
        pitch_mean = 0

    # ==========================================
    # Store everything
    # ==========================================

    feature_dict = {}

    # MFCC 1-13
    for i in range(13):
        feature_dict[f"mfcc_{i+1}"] = mfcc_mean[i]

    feature_dict["chroma"] = chroma_mean
    feature_dict["centroid"] = centroid_mean
    feature_dict["bandwidth"] = bandwidth_mean
    feature_dict["rolloff"] = rolloff_mean
    feature_dict["zcr"] = zcr_mean
    feature_dict["rms_energy"] = rms_mean
    feature_dict["pitch"] = pitch_mean

    feature_dict["label"] = label

    all_features.append(feature_dict)

# ==========================================
# Process REAL audio
# ==========================================

real_folder = "output/cleaned_audio/real"

for file in os.listdir(real_folder):

    if file.endswith(".wav"):

        extract_features(
            os.path.join(real_folder, file),
            "real"
        )


# ==========================================
# Process FAKE audio
# ==========================================

fake_folder = "output/cleaned_audio/fake"

for file in os.listdir(fake_folder):

    if file.endswith(".wav"):

        extract_features(
            os.path.join(fake_folder, file),
            "fake"
        )

# ==========================================
# Save all extracted features
# ==========================================

df = pd.DataFrame(all_features)

csv_path = "output/features/audio_features.csv"

df.to_csv(
    csv_path,
    index=False
)

print("\n===================================")
print("FEATURE EXTRACTION COMPLETED")
print("===================================")
print(f"Total Audio Files : {len(df)}")
print(f"CSV Saved : {csv_path}")

print("\nFirst 5 Rows:")
print(df.head())
        