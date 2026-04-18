import os
import numpy as np

def generate_sequences(num_samples=10000, sequence_length=7):
    print(f"Generating {num_samples} synthetic sequences of length {sequence_length}...")
    
    # Features per timestep: [weather_severity, historical_delay, node_congestion]
    num_features = 3
    
    X = np.zeros((num_samples, sequence_length, num_features))
    y = np.zeros((num_samples, 1))
    
    for i in range(num_samples):
        # We simulate two patterns:
        # 1. Normal/low risk pattern
        # 2. High risk / escalating pattern
        
        is_high_risk = np.random.rand() > 0.7
        
        if is_high_risk:
            # Escalating pattern
            base_weather = np.random.uniform(0.4, 0.9)
            base_delay = np.random.uniform(2.0, 10.0)
            base_congestion = np.random.uniform(0.5, 0.9)
            
            for t in range(sequence_length):
                # trend goes up over time
                trend = (t / sequence_length) * 0.3
                X[i, t, 0] = min(1.0, base_weather + np.random.normal(0, 0.1) + trend)
                X[i, t, 1] = min(24.0, max(0.0, base_delay + np.random.normal(0, 2) + (trend * 10)))
                X[i, t, 2] = min(1.0, base_congestion + np.random.normal(0, 0.1) + trend)
            
            # Risk is high
            y[i, 0] = np.random.uniform(0.7, 1.0)
            
        else:
            # Normal pattern
            base_weather = np.random.uniform(0.0, 0.4)
            base_delay = np.random.uniform(0.0, 3.0)
            base_congestion = np.random.uniform(0.1, 0.5)
            
            for t in range(sequence_length):
                X[i, t, 0] = max(0.0, min(1.0, base_weather + np.random.normal(0, 0.1)))
                X[i, t, 1] = max(0.0, base_delay + np.random.normal(0, 1.0))
                X[i, t, 2] = max(0.0, min(1.0, base_congestion + np.random.normal(0, 0.1)))
                
            # Risk is low
            y[i, 0] = np.random.uniform(0.0, 0.3)
            
    # Save the arrays
    save_dir = os.path.dirname(os.path.abspath(__file__))
    np.save(os.path.join(save_dir, "X_train.npy"), X)
    np.save(os.path.join(save_dir, "y_train.npy"), y)
    
    print(f"Saved synthetic data to {save_dir}/X_train.npy and y_train.npy")
    print(f"X shape: {X.shape}, y shape: {y.shape}")

if __name__ == "__main__":
    generate_sequences()
