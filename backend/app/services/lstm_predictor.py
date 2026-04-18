import os
import numpy as np

class LSTMPredictor:
    def __init__(self):
        self.model = None
        self.device = None
        self.model_path = os.path.join(os.path.dirname(__file__), "../ml/disruption_lstm.pt")

    def load_model(self):
        """Load pre-trained PyTorch LSTM model if it exists"""
        if not os.path.exists(self.model_path):
            print("[WARNING] PyTorch LSTM model not found. Run Phase 2 training.")
            return False
            
        try:
            import torch
            from app.ml.train_lstm import DisruptionLSTM
            
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            
            # Recreate model architecture and load weights
            self.model = DisruptionLSTM(input_size=3)
            self.model.load_state_dict(torch.load(self.model_path, map_location=self.device, weights_only=True))
            self.model.to(self.device)
            self.model.eval() # Set to evaluation mode
            
            print(f"[INFO] PyTorch LSTM Predictive Model loaded successfully on {self.device}.")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to load PyTorch LSTM model: {e}")
            return False

    def predict(self, sequence):
        """
        Run inference on a 7-day time-series sequence.
        sequence shape should be (7, 3) -> [weather_severity, delay, congestion]
        Returns a float between 0.0 and 1.0 representing cascading disruption risk.
        """
        if self.model is None:
            # Fallback heuristic if ML model isn't loaded
            return self._heuristic_fallback(sequence)
            
        try:
            import torch
            
            # Ensure shape is (1, sequence_length, features)
            seq_array = np.array(sequence, dtype=np.float32)
            if len(seq_array.shape) == 2:
                seq_array = np.expand_dims(seq_array, axis=0)
                
            tensor_seq = torch.tensor(seq_array).to(self.device)
            
            with torch.no_grad():
                prediction = self.model(tensor_seq)
                
            return float(prediction[0][0].cpu().item())
            
        except Exception as e:
            print(f"[ERROR] PyTorch LSTM inference failed: {e}")
            return self._heuristic_fallback(sequence)
            
    def _heuristic_fallback(self, sequence):
        """Simple rule-based fallback if model inference fails"""
        if not sequence or len(sequence) == 0:
            return 0.1
        # use the last day's metrics
        last_day = sequence[-1]
        weather, delay, congestion = last_day[0], last_day[1], last_day[2]
        
        # very basic normalization and weighting
        risk = (weather * 0.4) + (min(delay / 24, 1.0) * 0.4) + (congestion * 0.2)
        return min(max(float(risk), 0.0), 1.0)

# Instantiate singleton
lstm_predictor = LSTMPredictor()
