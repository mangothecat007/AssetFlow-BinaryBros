// public/audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Calculate volume (RMS) on the audio thread
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const volume = Math.sqrt(sum / channelData.length) * 100;

      // Send both audio data and volume to the main thread
      this.port.postMessage({
        audio: channelData,
        volume: volume
      });
    }
    return true;
  }
}


registerProcessor('audio-processor', AudioProcessor);
