"""
Inference Pipeline — Desert Semantic Segmentation
Takes an image (or folder of images) and outputs segmented mask with colored overlay + class labels.

Usage:
    conda activate seg
    python inference_pipeline.py --image path/to/image.png
    python inference_pipeline.py --folder path/to/images/
    python inference_pipeline.py --image path/to/image.png --checkpoint latest_model_ft.pth
"""

import os
import sys
import argparse
import numpy as np
from pathlib import Path
from PIL import Image

import torch
import torch.nn.functional as F

import albumentations as A
from albumentations.pytorch import ToTensorV2
from transformers import SegformerConfig, SegformerForSemanticSegmentation, SegformerModel

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# ============================================================
# CONFIG
# ============================================================
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

# Device selection
if torch.cuda.is_available():
    DEVICE = torch.device('cuda')
elif torch.backends.mps.is_available():
    DEVICE = torch.device('mps')
else:
    DEVICE = torch.device('cpu')


# ============================================================
# MODEL
# ============================================================
def build_model():
    config = SegformerConfig.from_pretrained(MODEL_NAME)
    config.num_labels = NUM_CLASSES
    model = SegformerForSemanticSegmentation(config)
    return model


def load_checkpoint(model, checkpoint_path):
    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    model.load_state_dict(ckpt['model_state_dict'])
    miou = ckpt.get('miou', 0)
    epoch = ckpt.get('epoch', '?')
    print(f'Loaded: {checkpoint_path}')
    print(f'  Epoch: {epoch}, Val mIoU: {miou:.4f}')
    return model


# ============================================================
# INFERENCE
# ============================================================
def get_val_transform():
    return A.Compose([
        A.Resize(height=IMG_SIZE, width=IMG_SIZE),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2(),
    ])


@torch.no_grad()
def predict(model, image_np, use_tta=True):
    """Run inference on a single numpy RGB image. Returns class mask at original resolution."""
    model.eval()
    orig_h, orig_w = image_np.shape[:2]

    if use_tta:
        probs = tta_predict(model, image_np)
    else:
        probs = single_predict(model, image_np)

    # Resize prediction to original image size
    pred = np.argmax(probs, axis=0).astype(np.uint8)
    pred_orig = np.array(Image.fromarray(pred).resize((orig_w, orig_h), Image.NEAREST))

    # Also resize probs for confidence
    confidence = np.max(probs, axis=0)
    conf_orig = np.array(Image.fromarray(confidence).resize((orig_w, orig_h), Image.BILINEAR))

    return pred_orig, conf_orig


def single_predict(model, image_np):
    transform = get_val_transform()
    aug = transform(image=image_np)
    tensor = aug['image'].unsqueeze(0).to(DEVICE)

    use_fp16 = DEVICE.type == 'cuda'
    with torch.amp.autocast(device_type=DEVICE.type, enabled=use_fp16):
        out = model(pixel_values=tensor)

    logits = F.interpolate(out.logits, size=(IMG_SIZE, IMG_SIZE),
                           mode='bilinear', align_corners=False)
    probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
    return probs


def tta_predict(model, image_np, scales=[0.75, 1.0, 1.25], flips=[False, True]):
    accum = np.zeros((NUM_CLASSES, IMG_SIZE, IMG_SIZE), dtype=np.float32)
    count = 0

    use_fp16 = DEVICE.type == 'cuda'

    for scale in scales:
        sh, sw = int(IMG_SIZE * scale), int(IMG_SIZE * scale)
        for flip in flips:
            tfm = A.Compose([
                A.Resize(height=sh, width=sw),
                A.HorizontalFlip(p=1.0 if flip else 0.0),
                A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ToTensorV2(),
            ])
            aug = tfm(image=image_np)
            tensor = aug['image'].unsqueeze(0).to(DEVICE)

            with torch.amp.autocast(device_type=DEVICE.type, enabled=use_fp16):
                out = model(pixel_values=tensor)

            logits = F.interpolate(out.logits, size=(IMG_SIZE, IMG_SIZE),
                                   mode='bilinear', align_corners=False)
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()

            if flip:
                probs = probs[:, :, ::-1].copy()

            accum += probs
            count += 1

    return accum / count


# ============================================================
# VISUALIZATION
# ============================================================
def colorize_mask(class_mask):
    h, w = class_mask.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for c in range(NUM_CLASSES):
        rgb[class_mask == c] = CLASS_COLORS[c]
    return rgb


def create_overlay(image, class_mask, alpha=0.5):
    """Blend original image with colored segmentation mask."""
    colored = colorize_mask(class_mask)
    overlay = (image.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha)
    return overlay.astype(np.uint8)


def add_labels_to_mask(image, class_mask):
    """Find connected regions and place class labels at their centroids."""
    from scipy import ndimage

    labeled_regions = {}
    for c in range(NUM_CLASSES):
        binary = (class_mask == c).astype(np.uint8)
        if binary.sum() == 0:
            continue
        # Find connected components
        labeled, num_features = ndimage.label(binary)
        for region_id in range(1, num_features + 1):
            region = (labeled == region_id)
            area = region.sum()
            if area < 500:  # skip tiny regions
                continue
            # Centroid
            ys, xs = np.where(region)
            cy, cx = int(ys.mean()), int(xs.mean())
            if c not in labeled_regions:
                labeled_regions[c] = []
            labeled_regions[c].append((cx, cy, area))

    return labeled_regions


def save_result(image_np, class_mask, confidence, output_path, filename):
    """Save a complete visualization: original | overlay | mask | confidence."""
    h, w = image_np.shape[:2]

    # Detect which classes are present
    present_classes = np.unique(class_mask)
    present_names = [CLASS_NAMES[c] for c in present_classes]
    present_pcts = [(class_mask == c).sum() / class_mask.size * 100 for c in present_classes]

    fig, axes = plt.subplots(1, 4, figsize=(24, 6))

    # 1. Original
    axes[0].imshow(image_np)
    axes[0].set_title('Original', fontsize=14, fontweight='bold')
    axes[0].axis('off')

    # 2. Overlay (image + mask blend)
    overlay = create_overlay(image_np, class_mask, alpha=0.55)
    axes[1].imshow(overlay)
    axes[1].set_title('Segmentation Overlay', fontsize=14, fontweight='bold')
    axes[1].axis('off')

    # Add class labels on overlay
    try:
        regions = add_labels_to_mask(image_np, class_mask)
        for c, centroids in regions.items():
            # Only label the largest region per class
            centroids.sort(key=lambda x: x[2], reverse=True)
            cx, cy, area = centroids[0]
            axes[1].text(cx, cy, CLASS_NAMES[c], fontsize=8, fontweight='bold',
                        color='white', ha='center', va='center',
                        bbox=dict(boxstyle='round,pad=0.2', facecolor=CLASS_COLORS[c]/255.0,
                                  edgecolor='white', linewidth=1.5, alpha=0.85))
    except ImportError:
        pass  # scipy not available, skip labels

    # 3. Pure segmentation mask
    colored_mask = colorize_mask(class_mask)
    axes[2].imshow(colored_mask)
    axes[2].set_title('Segmentation Mask', fontsize=14, fontweight='bold')
    axes[2].axis('off')

    # 4. Confidence map
    im = axes[3].imshow(confidence, cmap='RdYlGn', vmin=0, vmax=1)
    axes[3].set_title(f'Confidence (mean: {confidence.mean():.2f})', fontsize=14, fontweight='bold')
    axes[3].axis('off')
    plt.colorbar(im, ax=axes[3], fraction=0.046, pad=0.04)

    # Legend with percentages
    patches = []
    for c, name, pct in zip(present_classes, present_names, present_pcts):
        patches.append(mpatches.Patch(
            color=CLASS_COLORS[c] / 255.0,
            label=f'{name}: {pct:.1f}%'
        ))
    fig.legend(handles=patches, loc='lower center', ncol=min(5, len(patches)),
               fontsize=10, frameon=True, fancybox=True, shadow=True)

    plt.suptitle(filename, fontsize=12, y=0.98)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.12)

    out_file = os.path.join(output_path, f'{Path(filename).stem}_segmented.png')
    plt.savefig(out_file, dpi=150, bbox_inches='tight')
    plt.close()

    # --- Also save traversability map ---
    trav_file = save_traversability_map(image_np, class_mask, output_path, filename)

    return out_file, trav_file


# ============================================================
# TRAVERSABILITY MAP — Can the rover drive here?
# ============================================================

# Traversability categories for each class
#   'go'      = safe to drive (flat, open ground)
#   'caution' = possible but risky (uneven, small obstacles)
#   'no_go'   = cannot drive (solid obstacles, vegetation)
#   'sky'     = not ground (ignore)

TRAVERSABILITY = {
    0: 'no_go',    # Trees — solid obstacle
    1: 'no_go',    # Lush Bushes — dense vegetation
    2: 'go',       # Dry Grass — flat, driveable
    3: 'caution',  # Dry Bushes — small shrubs, risky
    4: 'caution',  # Ground Clutter — debris, uneven
    5: 'go',       # Flowers — low vegetation, passable
    6: 'no_go',    # Logs — solid obstacle
    7: 'caution',  # Rocks — depends on size, risky
    8: 'go',       # Landscape — open terrain, best for driving
    9: 'sky',      # Sky — not ground
}

TRAV_COLORS = {
    'go':      [0, 200, 0],      # Green — safe
    'caution': [255, 180, 0],    # Orange — caution
    'no_go':   [220, 30, 30],    # Red — blocked
    'sky':     [180, 210, 240],  # Light blue — sky (not ground)
}

TRAV_LABELS = {
    'go':      'SAFE — Rover CAN drive',
    'caution': 'CAUTION — Drive with care',
    'no_go':   'BLOCKED — Rover CANNOT drive',
    'sky':     'Sky (not ground)',
}


def save_traversability_map(image_np, class_mask, output_path, filename):
    """Generate and save a traversability map: go / caution / no-go zones."""
    h, w = class_mask.shape

    # Build traversability mask
    trav_mask = np.zeros((h, w, 3), dtype=np.uint8)
    trav_category = np.empty((h, w), dtype='<U7')

    for class_id, category in TRAVERSABILITY.items():
        region = (class_mask == class_id)
        trav_mask[region] = TRAV_COLORS[category]
        trav_category[region] = category

    # Compute stats
    total_ground = np.sum(trav_category != 'sky')  # exclude sky
    if total_ground > 0:
        go_pct = np.sum(trav_category == 'go') / total_ground * 100
        caution_pct = np.sum(trav_category == 'caution') / total_ground * 100
        nogo_pct = np.sum(trav_category == 'no_go') / total_ground * 100
    else:
        go_pct = caution_pct = nogo_pct = 0

    # Create overlay: image blended with traversability colors
    trav_overlay = (image_np.astype(np.float32) * 0.4 + trav_mask.astype(np.float32) * 0.6)
    trav_overlay = trav_overlay.astype(np.uint8)

    # Plot: Original | Traversability Overlay | Pure Trav Map
    fig, axes = plt.subplots(1, 3, figsize=(21, 7))

    # 1. Original
    axes[0].imshow(image_np)
    axes[0].set_title('Original Scene', fontsize=14, fontweight='bold')
    axes[0].axis('off')

    # 2. Traversability overlay with labels
    axes[1].imshow(trav_overlay)
    axes[1].set_title('Rover Traversability Overlay', fontsize=14, fontweight='bold')
    axes[1].axis('off')

    # Add traversability labels on regions
    try:
        regions = add_labels_to_mask(image_np, class_mask)
        for c, centroids in regions.items():
            cat = TRAVERSABILITY[c]
            if cat == 'sky':
                continue
            centroids.sort(key=lambda x: x[2], reverse=True)
            cx, cy, area = centroids[0]
            icon = {'go': 'SAFE', 'caution': 'CAUTION', 'no_go': 'BLOCKED'}[cat]
            bg_color = np.array(TRAV_COLORS[cat]) / 255.0
            axes[1].text(cx, cy, f'{icon}\n{CLASS_NAMES[c]}', fontsize=7, fontweight='bold',
                        color='white', ha='center', va='center',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor=bg_color,
                                  edgecolor='white', linewidth=1.5, alpha=0.9))
    except ImportError:
        pass

    # 3. Pure traversability map
    axes[2].imshow(trav_mask)
    axes[2].set_title('Traversability Map', fontsize=14, fontweight='bold')
    axes[2].axis('off')

    # Legend
    patches = [
        mpatches.Patch(color=np.array(TRAV_COLORS['go'])/255.0,
                       label=f'{TRAV_LABELS["go"]} ({go_pct:.1f}%)'),
        mpatches.Patch(color=np.array(TRAV_COLORS['caution'])/255.0,
                       label=f'{TRAV_LABELS["caution"]} ({caution_pct:.1f}%)'),
        mpatches.Patch(color=np.array(TRAV_COLORS['no_go'])/255.0,
                       label=f'{TRAV_LABELS["no_go"]} ({nogo_pct:.1f}%)'),
        mpatches.Patch(color=np.array(TRAV_COLORS['sky'])/255.0,
                       label=TRAV_LABELS['sky']),
    ]
    fig.legend(handles=patches, loc='lower center', ncol=4,
               fontsize=11, frameon=True, fancybox=True, shadow=True,
               bbox_to_anchor=(0.5, 0.02))

    plt.suptitle(f'UGV Traversability Analysis — {filename}\n'
                 f'Ground: {go_pct:.0f}% safe | {caution_pct:.0f}% caution | {nogo_pct:.0f}% blocked',
                 fontsize=13, fontweight='bold', y=0.98)
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.14, top=0.88)

    out_file = os.path.join(output_path, f'{Path(filename).stem}_traversability.png')
    plt.savefig(out_file, dpi=150, bbox_inches='tight')
    plt.close()

    return out_file


def print_class_breakdown(class_mask, filename):
    """Print class breakdown for a single image."""
    total = class_mask.size
    print(f'\n  {filename}')
    print(f'  {"Class":<20} {"Pixels":>10} {"Coverage":>10}')
    print(f'  {"-"*42}')
    for c in range(NUM_CLASSES):
        count = (class_mask == c).sum()
        if count > 0:
            pct = count / total * 100
            print(f'  {CLASS_NAMES[c]:<20} {count:>10,} {pct:>9.1f}%')


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='Desert Segmentation Inference Pipeline')
    parser.add_argument('--image', type=str, help='Path to a single image')
    parser.add_argument('--folder', type=str, help='Path to folder of images')
    parser.add_argument('--checkpoint', type=str, default='latest_model_ft.pth',
                        help='Checkpoint filename (looked up in hackthon folder)')
    parser.add_argument('--output', type=str, default='inference_output',
                        help='Output directory for results')
    parser.add_argument('--no-tta', action='store_true', help='Disable TTA (faster)')
    parser.add_argument('--alpha', type=float, default=0.55, help='Overlay alpha (0-1)')
    args = parser.parse_args()

    if not args.image and not args.folder:
        parser.error('Provide --image or --folder')

    # Find checkpoint
    script_dir = Path(__file__).parent
    ckpt_candidates = [
        script_dir / args.checkpoint,
        script_dir / 'best_model.pth',
        script_dir / 'latest_model_ft.pth',
        script_dir / 'best_model_ft.pth',
    ]

    ckpt_path = None
    for c in ckpt_candidates:
        if c.exists():
            ckpt_path = c
            break

    if ckpt_path is None:
        print(f'ERROR: No checkpoint found. Tried: {[str(c) for c in ckpt_candidates]}')
        sys.exit(1)

    # Build and load model
    print(f'Device: {DEVICE}')
    print('Loading model...')
    model = build_model()
    model = load_checkpoint(model, str(ckpt_path))
    model = model.to(DEVICE)
    model.eval()

    # Output dir
    output_dir = script_dir / args.output
    output_dir.mkdir(exist_ok=True)

    # Gather images
    image_paths = []
    if args.image:
        image_paths.append(Path(args.image))
    if args.folder:
        folder = Path(args.folder)
        image_paths.extend(sorted(
            list(folder.glob('*.png')) + list(folder.glob('*.jpg')) + list(folder.glob('*.jpeg'))
        ))

    print(f'\nProcessing {len(image_paths)} images (TTA={"off" if args.no_tta else "on"})...\n')

    for img_path in image_paths:
        print(f'Processing: {img_path.name}', end='', flush=True)

        img = np.array(Image.open(img_path).convert('RGB'))
        pred, conf = predict(model, img, use_tta=not args.no_tta)

        seg_file, trav_file = save_result(img, pred, conf, str(output_dir), img_path.name)
        print(f' -> {seg_file}')
        print(f'    -> {trav_file}')

        print_class_breakdown(pred, img_path.name)

    print(f'\nDone! Results saved to: {output_dir}/')


if __name__ == '__main__':
    main()
