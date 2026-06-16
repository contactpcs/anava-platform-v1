This file contains the documentation on how to read, extract useful information from the eeg files of different patients.

- Basics of EEG
- headers in .easy file and how to read it
- Why Conversion and formulas for conversion
- EEG analysis
  - Temporal Analysis, Band pass filtering, FFT, PSD, Power bands


|     | eeg_id | eeg_sub_id | eeg_label_offset_seconds | spectrogram_id | spectrogram_label_offset_seconds | label_id | patient_id | indicator |
| --- | ------ | ---------- | ------------------------ | -------------- | -------------------------------- | -------- | ---------- | --------- |


### Preprocessing for EEG:
- Band pass filtering (0.5 - 45Hz)
- Independent Component Analysis (ICA): Artifact removal
- **Segmentation:** Divide your continuous signal into fixed-length epochs. 
- **Transformation:** Convert each epoch into a 2D representation:
    - **Spectrograms:** Use a Short-Time Fourier Transform (STFT) to create a visual map of frequency vs. time.
    - **Scalograms:** Use Continuous Wavelet Transform (CWT), which is often superior for EEG because it captures transient events better than STFT.
    - **Topographic Maps:** Create 2D maps of the scalp's power spectral density (PSD) for specific frequency bands (Delta, Theta, Alpha, Beta, Gamma).



## training dataset for model 1: Classification only with band for AD

columns:
| patient_id | eeg_id |  band_values | Indication  (output)

model : 


ICA removing bad EEG signals