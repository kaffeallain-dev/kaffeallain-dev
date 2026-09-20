export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface DetectedFood {
  detectionId: string;
  foodName: string;
  confidence: number;
  boundingBox: BoundingBox;
  estimatedWeight: number; // in grams
  portion: 'Small' | 'Medium' | 'Large';
  isUnknown?: boolean;
  category?: string;
}

export interface FoodDetectionRequest {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  base64Data?: string; // Optional for cloud fallback
}

export interface FoodDetectionResponse {
  detections: DetectedFood[];
  processingTimeMs: number;
  source: 'LOCAL_TFLITE' | 'CLOUD_VISION';
}
