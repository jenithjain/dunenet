"""
Quick test to verify model can be loaded
"""
import torch
import os

print("Testing model loading...")
print(f"Current directory: {os.getcwd()}")
print(f"Model file exists: {os.path.exists('best_model.pth')}")
print(f"Model file size: {os.path.getsize('best_model.pth') / (1024*1024):.2f} MB")

try:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    print("\nLoading model...")
    # Set weights_only=False for PyTorch 2.6+ compatibility
    model = torch.load("best_model.pth", map_location=device, weights_only=False)
    print(f"✓ Model loaded successfully!")
    print(f"Model type: {type(model)}")
    
    # Try to get model info
    if hasattr(model, 'eval'):
        model.eval()
        print("✓ Model set to eval mode")
    
    if hasattr(model, 'parameters'):
        total_params = sum(p.numel() for p in model.parameters())
        print(f"Total parameters: {total_params:,}")
    
    print("\n✓ Model is ready to use!")
    
except Exception as e:
    print(f"\n✗ Error loading model: {e}")
    import traceback
    traceback.print_exc()
