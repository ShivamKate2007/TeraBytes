import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

class DisruptionLSTM(nn.Module):
    def __init__(self, input_size=3, hidden_size=64, num_layers=2):
        super(DisruptionLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc1 = nn.Linear(hidden_size, 16)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(16, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # x shape: (batch, seq_len, input_size)
        out, _ = self.lstm(x)
        # We only need the output from the last time step
        out = out[:, -1, :]
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out)
        out = self.sigmoid(out)
        return out

def train_model():
    print("Loading synthetic training data...")
    save_dir = os.path.dirname(os.path.abspath(__file__))
    X_path = os.path.join(save_dir, "X_train.npy")
    y_path = os.path.join(save_dir, "y_train.npy")
    
    if not os.path.exists(X_path) or not os.path.exists(y_path):
        print("Data files not found. Run generate_training_data.py first.")
        return
        
    X_np = np.load(X_path)
    y_np = np.load(y_path)
    
    print(f"Loaded X with shape {X_np.shape} and y with shape {y_np.shape}")
    
    # 80/20 train/val split
    split_idx = int(len(X_np) * 0.8)
    X_train, X_val = X_np[:split_idx], X_np[split_idx:]
    y_train, y_val = y_np[:split_idx], y_np[split_idx:]
    
    # Convert numpy arrays to PyTorch tensors
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_train_tensor = torch.tensor(y_train, dtype=torch.float32)
    X_val_tensor = torch.tensor(X_val, dtype=torch.float32)
    y_val_tensor = torch.tensor(y_val, dtype=torch.float32)
    
    # Create DataLoaders
    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    val_dataset = TensorDataset(X_val_tensor, y_val_tensor)
    
    batch_size = 64
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # Set device (GPU if available)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Initialize the model, criterion, and optimizer
    sequence_length = X_np.shape[1]
    num_features = X_np.shape[2]
    
    model = DisruptionLSTM(input_size=num_features).to(device)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    print("Training model with Early Stopping...")
    num_epochs = 100
    patience = 5
    best_val_loss = float('inf')
    epochs_no_improve = 0
    best_model_state = None

    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * inputs.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        val_loss = 0.0
        val_mae = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * inputs.size(0)
                val_mae += torch.sum(torch.abs(outputs - targets)).item()
                
        val_loss /= len(val_loader.dataset)
        val_mae /= len(val_loader.dataset)
        
        print(f"Epoch [{epoch+1}/{num_epochs}] | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val MAE: {val_mae:.4f}")

        # Early Stopping Logic
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            epochs_no_improve = 0
            # Clone best dict so we can save it later
            best_model_state = model.state_dict().copy()
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                print(f"[EARLY STOPPING] Validation loss stopped improving for {patience} epochs. Stopping early at epoch {epoch+1}!")
                break

    # Save the absolute best model
    model_path = os.path.join(save_dir, "disruption_lstm.pt")
    if best_model_state:
        torch.save(best_model_state, model_path)
    else:
        torch.save(model.state_dict(), model_path)
    print(f"Best model saved successfully to {model_path} with Val Loss: {best_val_loss:.4f}")

if __name__ == "__main__":
    train_model()
