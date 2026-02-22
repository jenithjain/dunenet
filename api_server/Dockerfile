FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install CPU-only PyTorch first, then other deps
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code and model
COPY main.py .
COPY models/ models/

# Expose port 7860 (Hugging Face Spaces default)
EXPOSE 7860

# Run the server
CMD ["python", "main.py"]
