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
  estimatedWeight: number | null; // Never invented from single-photo pixels
  portion: 'Small' | 'Medium' | 'Large' | null;
  isUnknown?: boolean;
  category?: string;
}

export interface FoodDetectionRequest {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  base64Data?: string; // Optional for cloud fallback
  mimeType?: string;
}

export interface FoodDetectionResponse {
  detections: DetectedFood[];
  processingTimeMs: number;
  source: 'LOCAL_TFLITE' | 'CLOUD_VISION';
}

export type FoodDetectionErrorCode =
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'MISSING_IMAGE';

export class FoodDetectionServiceError extends Error {
  public readonly code: FoodDetectionErrorCode;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: FoodDetectionErrorCode,
    statusCode?: number,
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'FoodDetectionServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
