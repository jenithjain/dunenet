from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from PIL import Image
import io
import base64
import numpy as np
from typing import Optional
import uvicorn
import albumentations as A
from albumentations.pytorch import ToTensorV2
from transformers import SegformerConfig, SegformerForSemanticSegmentation

app = FastAPI(title="DuneNet Model API", version="1.0.0")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
NUM_CLASSES = 10
IMG_SIZE = 512
MODEL_NAME = 'nvidia/mit-b4'

CLASS_NAMES = [
    'Trees', 'Lush Bushes', 'Dry Grass', 'Dry Bushes', 'Ground Clutter',
    'Flowers', 'Logs', 'Rocks', 'Landscape', 'Sky'
]

CLASS_COLORS = np.array([
    [34, 139, 34],    # Trees
    [0, 255, 127],    # Lush Bushes
    [189, 183, 107],  # Dry Grass
    [139, 119, 101],  # Dry Bushes
    [160, 82, 45],    # Ground Clutter
    [255, 105, 180],  # Flowers
    [139, 69, 19],    # Logs
    [128, 128, 128],  # Rocks
    [210, 180, 140],  # Landscape
    [135, 206, 235],  # Sky
], dtype=np.uint8)

# Traversability mapping
TRAVERSABILITY = {
    0: 'no_go',    # Trees
    1: 'no_go',    # Lush Bushes
    2: 'go',       # Dry Grass
    3: 'caution',  # Dry Bushes
    4: 'caution',  # Ground Clutter
    5: 'go',       # Flowers
    6: 'no_go',    # Logs
    7: 'caution',  # Rocks
    8: 'go',       # Landscape
    9: 'sky',      # Sky
}

TRAV_COLORS = {
    'go':      np.array([0, 200, 0], dtype=np.uint8),      # Green
    'caution': np.array([255, 180, 0], dtype=np.uint8),    # Orange
    'no_go':   np.array([220, 30, 30], dtype=np.uint8),    # Red
    'sky':     np.array([180, 210, 240], dtype=np.uint8),  # Light blue
}

# Global model variable
model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class PredictionResponse(BaseModel):
    prediction: int
    class_name: str
    confidence: float
    device_used: str
    class_distribution: dict
    segmentation_mask: str  # base64 encoded image
    overlay_image: str  # base64 encoded overlay
    traversability_map: str  # base64 encoded traversability
    traversability_overlay: str  # base64 encoded traversability overlay
    traversability_stats: dict  # safe, caution, blocked percentages

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str

@app.on_event("startup")
async def load_model():
    """Load the Segformer model on startup"""
    global model
    try:
        import os
        possible_paths = [
            "models/latest_model_ft.pth",
            "api_server/models/latest_model_ft.pth",
            os.path.join(os.path.dirname(__file__), "models/latest_model_ft.pth"),
        ]
        
        model_path = None
        for path in possible_paths:
            if os.path.exists(path):
                model_path = path
                break
        
        if model_path is None:
            raise FileNotFoundError("latest_model_ft.pth not found in api_server/models/")
        
        print(f"Loading Segformer model from: {os.path.abspath(model_path)}")
        
        # Build Segformer model
        config = SegformerConfig.from_pretrained(MODEL_NAME)
        config.num_labels = NUM_CLASSES
        model = SegformerForSemanticSegmentation(config)
        
        # Load checkpoint
        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        
        model = model.to(device)
        model.eval()
        
        miou = checkpoint.get('miou', 0)
        epoch = checkpoint.get('epoch', '?')
        
        print(f"✓ Segformer model loaded successfully on {device}")
        print(f"  Epoch: {epoch}, Val mIoU: {miou:.4f}")
        print(f"  Classes: {NUM_CLASSES}")
        print(f"  Model: {MODEL_NAME}")
        
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        model = None

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "running",
        "model_loaded": model is not None,
        "device": str(device)
    }

def colorize_mask(class_mask):
    """Convert class mask to RGB colored image"""
    h, w = class_mask.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for c in range(NUM_CLASSES):
        rgb[class_mask == c] = CLASS_COLORS[c]
    return rgb


def create_overlay(image_np, class_mask, alpha=0.5):
    """Blend original image with colored segmentation mask"""
    colored = colorize_mask(class_mask)
    overlay = (image_np.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha)
    return overlay.astype(np.uint8)


def create_traversability_map(class_mask):
    """Generate traversability map from segmentation mask"""
    h, w = class_mask.shape
    trav_mask = np.zeros((h, w, 3), dtype=np.uint8)
    
    for class_id, category in TRAVERSABILITY.items():
        region = (class_mask == class_id)
        trav_mask[region] = TRAV_COLORS[category]
    
    return trav_mask


def calculate_traversability_stats(class_mask):
    """Calculate traversability statistics"""
    total_pixels = class_mask.size
    sky_pixels = (class_mask == 9).sum()  # Sky class
    ground_pixels = total_pixels - sky_pixels
    
    if ground_pixels == 0:
        return {'safe': '0%', 'caution': '0%', 'blocked': '0%'}
    
    safe_pixels = 0
    caution_pixels = 0
    blocked_pixels = 0
    
    for class_id, category in TRAVERSABILITY.items():
        if category == 'sky':
            continue
        count = (class_mask == class_id).sum()
        if category == 'go':
            safe_pixels += count
        elif category == 'caution':
            caution_pixels += count
        elif category == 'no_go':
            blocked_pixels += count
    
    return {
        'safe': f"{(safe_pixels / ground_pixels * 100):.1f}%",
        'caution': f"{(caution_pixels / ground_pixels * 100):.1f}%",
        'blocked': f"{(blocked_pixels / ground_pixels * 100):.1f}%"
    }


def numpy_to_base64(image_np):
    """Convert numpy array to base64 string"""
    img = Image.fromarray(image_np)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """Make prediction on uploaded image using Segformer"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        image_np = np.array(image)
        orig_h, orig_w = image_np.shape[:2]
        
        # Preprocessing with albumentations
        transform = A.Compose([
            A.Resize(height=IMG_SIZE, width=IMG_SIZE),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ])
        
        aug = transform(image=image_np)
        tensor = aug['image'].unsqueeze(0).to(device)
        
        # Inference
        with torch.no_grad():
            use_fp16 = device.type == 'cuda'
            with torch.amp.autocast(device_type=device.type, enabled=use_fp16):
                outputs = model(pixel_values=tensor)
            
            # Get logits and resize
            logits = F.interpolate(
                outputs.logits,
                size=(IMG_SIZE, IMG_SIZE),
                mode='bilinear',
                align_corners=False
            )
            
            # Get probabilities
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
            
            # Get prediction mask
            pred_mask = np.argmax(probs, axis=0).astype(np.uint8)
            
            # Resize prediction to original image size
            pred_mask_orig = np.array(
                Image.fromarray(pred_mask).resize((orig_w, orig_h), Image.NEAREST)
            )
            
            # Calculate class distribution
            class_dist = {}
            total_pixels = pred_mask_orig.size
            for c in range(NUM_CLASSES):
                count = (pred_mask_orig == c).sum()
                if count > 0:
                    class_dist[CLASS_NAMES[c]] = f"{(count / total_pixels * 100):.1f}%"
            
            # Get dominant class
            dominant_class = np.bincount(pred_mask_orig.flatten()).argmax()
            confidence = probs[dominant_class].mean()
            
            # Generate visualizations
            colored_mask = colorize_mask(pred_mask_orig)
            overlay = create_overlay(image_np, pred_mask_orig, alpha=0.5)
            
            # Generate traversability map
            print(f"Generating traversability map...")
            trav_map = create_traversability_map(pred_mask_orig)
            print(f"Traversability map shape: {trav_map.shape}")
            
            trav_overlay = create_overlay(image_np, pred_mask_orig, alpha=0.6)
            # Replace with traversability colors
            for class_id, category in TRAVERSABILITY.items():
                region = (pred_mask_orig == class_id)
                trav_overlay[region] = (
                    image_np[region].astype(np.float32) * 0.4 + 
                    TRAV_COLORS[category].astype(np.float32) * 0.6
                ).astype(np.uint8)
            
            trav_stats = calculate_traversability_stats(pred_mask_orig)
            print(f"Traversability stats: {trav_stats}")
            
            # Convert to base64
            mask_base64 = numpy_to_base64(colored_mask)
            overlay_base64 = numpy_to_base64(overlay)
            trav_map_base64 = numpy_to_base64(trav_map)
            trav_overlay_base64 = numpy_to_base64(trav_overlay)
            print(f"All images converted to base64 successfully")
        
        return {
            "prediction": int(dominant_class),
            "class_name": CLASS_NAMES[dominant_class],
            "confidence": float(confidence),
            "device_used": str(device),
            "class_distribution": class_dist,
            "segmentation_mask": mask_base64,
            "overlay_image": overlay_base64,
            "traversability_map": trav_map_base64,
            "traversability_overlay": trav_overlay_base64,
            "traversability_stats": trav_stats
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# ═══════════════════════════════════════════════════════════════
#  Simulation Live Inference
# ═══════════════════════════════════════════════════════════════

class SimPredictionResponse(BaseModel):
    segmentation_mask: str
    traversability_map: str
    traversability_overlay: str
    traversability_stats: dict
    traversability_grid: list
    class_distribution: dict
    inference_time_ms: float
    dominant_class: str
    confidence: float


def create_traversability_grid(class_mask, grid_cols=12, grid_rows=8):
    """Create a coarse traversability grid from the prediction mask.
    Uses the bottom 65 % of the image (ground portion, excluding sky).
    Returns 2-D list of costmap values: 0 = go, 5 = caution, 10 = no_go.
    """
    h, w = class_mask.shape
    ground_start = int(h * 0.35)
    ground_mask = class_mask[ground_start:, :]
    gh, gw = ground_mask.shape

    cell_h = max(1, gh // grid_rows)
    cell_w = max(1, gw // grid_cols)

    grid = []
    for r in range(grid_rows):
        row = []
        for c in range(grid_cols):
            y0 = r * cell_h
            y1 = min((r + 1) * cell_h, gh)
            x0 = c * cell_w
            x1 = min((c + 1) * cell_w, gw)

            cell = ground_mask[y0:y1, x0:x1]
            if cell.size == 0:
                row.append(0)
                continue

            go_count = caution_count = no_go_count = 0
            for cid in range(NUM_CLASSES):
                cnt = int((cell == cid).sum())
                cat = TRAVERSABILITY[cid]
                if cat == 'go':
                    go_count += cnt
                elif cat == 'caution':
                    caution_count += cnt
                elif cat == 'no_go':
                    no_go_count += cnt

            total = go_count + caution_count + no_go_count
            if total == 0:
                row.append(0)
            elif no_go_count / total > 0.3:
                row.append(10)
            elif caution_count / total > 0.3:
                row.append(5)
            else:
                row.append(0)
        grid.append(row)
    return grid


@app.post("/predict/sim", response_model=SimPredictionResponse)
async def predict_sim(file: UploadFile = File(...)):
    """Prediction endpoint optimised for simulation live inference.
    Returns a traversability grid suitable for direct costmap updates."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    import time
    t0 = time.time()

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        image_np = np.array(image)
        orig_h, orig_w = image_np.shape[:2]

        transform = A.Compose([
            A.Resize(height=IMG_SIZE, width=IMG_SIZE),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ])

        aug = transform(image=image_np)
        tensor = aug['image'].unsqueeze(0).to(device)

        with torch.no_grad():
            use_fp16 = device.type == 'cuda'
            with torch.amp.autocast(device_type=device.type, enabled=use_fp16):
                outputs = model(pixel_values=tensor)

            logits = F.interpolate(
                outputs.logits,
                size=(IMG_SIZE, IMG_SIZE),
                mode='bilinear',
                align_corners=False,
            )

            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
            pred_mask = np.argmax(probs, axis=0).astype(np.uint8)
            pred_mask_orig = np.array(
                Image.fromarray(pred_mask).resize((orig_w, orig_h), Image.NEAREST)
            )

        # Visualisations
        colored_mask = colorize_mask(pred_mask_orig)
        trav_map = create_traversability_map(pred_mask_orig)

        trav_overlay_img = image_np.copy()
        for cid, category in TRAVERSABILITY.items():
            region = (pred_mask_orig == cid)
            trav_overlay_img[region] = (
                image_np[region].astype(np.float32) * 0.4
                + TRAV_COLORS[category].astype(np.float32) * 0.6
            ).astype(np.uint8)

        trav_stats = calculate_traversability_stats(pred_mask_orig)
        trav_grid = create_traversability_grid(pred_mask_orig)

        class_dist = {}
        total_pixels = pred_mask_orig.size
        for cid in range(NUM_CLASSES):
            cnt = int((pred_mask_orig == cid).sum())
            if cnt > 0:
                class_dist[CLASS_NAMES[cid]] = f"{cnt / total_pixels * 100:.1f}%"

        dominant = int(np.bincount(pred_mask_orig.flatten()).argmax())
        conf = float(probs[dominant].mean())
        elapsed = (time.time() - t0) * 1000

        return {
            "segmentation_mask": numpy_to_base64(colored_mask),
            "traversability_map": numpy_to_base64(trav_map),
            "traversability_overlay": numpy_to_base64(trav_overlay_img),
            "traversability_stats": trav_stats,
            "traversability_grid": trav_grid,
            "class_distribution": class_dist,
            "inference_time_ms": round(elapsed, 1),
            "dominant_class": CLASS_NAMES[dominant],
            "confidence": conf,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Sim prediction error: {str(e)}")


@app.get("/model/info")
async def model_info():
    """Get model information"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return {
        "model_type": str(type(model).__name__),
        "device": str(device),
        "parameters": sum(p.numel() for p in model.parameters() if hasattr(model, 'parameters'))
    }

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
