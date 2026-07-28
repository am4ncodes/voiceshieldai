import os
from pydub import AudioSegment

# ==========================================
# Create output folder
# ==========================================

os.makedirs("user_audio", exist_ok=True)

# ==========================================
# Function to convert audio to WAV (16 kHz)
# ==========================================

def convert_to_wav(input_path):

    # Get file name without extension
    filename = os.path.splitext(os.path.basename(input_path))[0]

    # Output file path
    output_path = f"user_audio/{filename}.wav"

    # Load audio automatically
    audio = AudioSegment.from_file(input_path)

    # Convert to Mono + 16 kHz
    audio = audio.set_channels(1)
    audio = audio.set_frame_rate(16000)

    # Export as WAV
    audio.export(output_path, format="wav")

    print("\n==============================")
    print("Audio converted successfully!")
    print(f"Saved to : {output_path}")
    print("==============================")

    return output_path

