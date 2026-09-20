# MboaFit Food Recognition AI - Engineering Architecture

## Core Architectural Principles
- **Target Platform**: React Native (Expo)
- **Paradigm**: Clean Architecture (Presentation, Domain, Data)
- **Execution Strategy**: Offline-first (On-device ML via TensorFlow Lite for React Native), falling back to Cloud ML for low-confidence or unknown foods.

---

## 1. Image Acquisition Module (Camera & Gallery)
**Purpose**: Securely and efficiently capture high-quality images of food from the device camera or photo gallery using Expo Camera and Expo Image Picker.
**Folder Structure**: `src/features/vision/presentation/acquisition/`

**Input**: User interaction (Shutter press or Gallery selection).
**Output**: Raw Image URI (`file://...`).

**TypeScript Interfaces**:
```typescript
export interface ImageAcquisitionRequest {
  source: 'CAMERA' | 'GALLERY';
  highResolution: boolean;
}

export interface RawImageResult {
  uri: string;
  width: number;
  height: number;
  timestamp: string;
}
```

**Data Flow**: User -> UI -> Acquisition Controller -> Expo Camera / Image Picker -> RawImageResult
**Performance Considerations**: Use async non-blocking calls. Limit camera preview resolution to maintain high FPS.
**Error Handling**: Handle missing camera/gallery permissions gracefully. Handle out-of-memory crashes on older Android devices.

---

## 2. Image Processing Module (Compression & Preprocessing)
**Purpose**: Prepare the raw image for the ML model by resizing, compressing, and normalizing tensor data to reduce inference time and memory footprint.
**Folder Structure**: `src/features/vision/data/processing/`

**Input**: `RawImageResult`
**Output**: Processed Image Buffer/Tensor (`ProcessedImage`)

**TypeScript Interfaces**:
```typescript
export interface ProcessedImage {
  uri: string;
  base64?: string;
  tensorData?: Float32Array;
  dimensions: { width: number; height: number };
}

export interface ProcessingConfig {
  targetWidth: number;
  targetHeight: number;
  compressionQuality: number; // 0.0 to 1.0
}
```

**Data Flow**: RawImageResult -> Expo Image Manipulator (Resize/Compress) -> Tensor Normalization -> ProcessedImage
**Performance Considerations**: Use native bindings for image manipulation. Avoid large base64 string passing across the React Native bridge when possible.
**Error Handling**: Catch file read errors and unsupported image formats.

---

## 3. Vision Detection Engine (Multi-food, Bounding Boxes, Confidence, Unknowns)
**Purpose**: Analyze the processed image to detect one or multiple food items, draw bounding boxes, calculate confidence scores, and flag unknown foods. Runs on-device first, falls back to cloud if confidence is too low.
**Folder Structure**: `src/features/vision/domain/detection/`

**Input**: `ProcessedImage`
**Output**: List of `DetectedFood` entities.

**TypeScript Interfaces**:
```typescript
export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface DetectedFood {
  detectionId: string;
  label: string; // e.g., 'ndole', 'unknown'
  confidenceScore: number; // 0.0 to 1.0
  boundingBox: BoundingBox;
  isUnknown: boolean;
  needsCloudFallback: boolean;
}
```

**Data Flow**: ProcessedImage -> Local TFLite Object Detection Model -> NMS (Non-Maximum Suppression) -> Array of DetectedFood -> Check if max confidence < threshold -> (Optional) Cloud Vision API.
**Performance Considerations**: Run inference on a background thread (e.g., using React Native Reanimated worklets or Vision Camera frame processors) to prevent UI freezing.
**Error Handling**: Handle model load failures by falling back to Cloud API entirely. Handle timeout errors during inference.

---

## 4. Portion Estimation Module
**Purpose**: Estimate the serving size (Small, Medium, Large) or volume based on the bounding box size relative to the frame, reference objects, or depth data if available.
**Folder Structure**: `src/features/vision/domain/estimation/`

**Input**: `DetectedFood` and `ProcessedImage.dimensions`
**Output**: `EstimatedPortion`

**TypeScript Interfaces**:
```typescript
export interface EstimatedPortion {
  detectionId: string;
  estimatedSizeCategory: 'Small' | 'Medium' | 'Large';
  estimatedGrams: number;
  estimationConfidence: number;
}
```

**Data Flow**: DetectedFood -> Bounding Box Area Calculation -> Scale against typical plate size -> EstimatedPortion
**Performance Considerations**: Purely mathematical operation; execution time is negligible.
**Error Handling**: Handle edge cases where the bounding box covers the entire frame (too close) or is too small (too far).

---

## 5. Knowledge Base Integration (Local Matching & Nutrition Lookup)
**Purpose**: Match detected food labels against the offline MboaFit Nutrition Knowledge Base (SQLite/WatermelonDB) to retrieve full nutritional profiles.
**Folder Structure**: `src/features/nutrition/data/repositories/`

**Input**: `DetectedFood` and `EstimatedPortion`
**Output**: `FoodKnowledge` (from MboaFit KB) mapped to `LoggedMeal`.

**TypeScript Interfaces**:
```typescript
export interface MatchRequest {
  label: string;
  portion: EstimatedPortion;
}

export interface NutritionLookupResult {
  foodKnowledge: FoodKnowledge; // Uses existing FoodKnowledge schema
  calculatedCalories: number;
  calculatedMacros: { protein: number; carbs: number; fat: number };
}
```

**Data Flow**: label -> Local SQLite Query (Alias matching) -> Retrieve FoodKnowledge -> Scale Nutrition by EstimatedPortion -> NutritionLookupResult.
**Performance Considerations**: Ensure the `aliasIndex` in the local DB is heavily indexed for fast text resolution.
**Error Handling**: Handle "Food Not Found" by triggering the "Unknown Food Detection" flow, prompting the user to manually enter or cloud-search the item.

---

## 6. Recommendation Engine Integration
**Purpose**: Feed the parsed nutritional data directly into the MboaFit Recommendation Engine to update daily tracking, trigger AI Coaching Tips, and analyze meal goals.
**Folder Structure**: `src/features/recommendation/domain/integration/`

**Input**: `NutritionLookupResult`
**Output**: `MealAnalysisResult` and `AiCoachingTip[]`

**TypeScript Interfaces**:
```typescript
export interface VisionMealSubmission {
  timestamp: string;
  mealCategory: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  items: NutritionLookupResult[];
}

export interface VisionFeedback {
  logSuccess: boolean;
  dailyProgressUpdate: any;
  coachingTriggers: AiCoachingTip[];
}
```

**Data Flow**: VisionMealSubmission -> RecommendationEngine.analyzeMeals() -> Update Local Storage -> VisionFeedback -> UI Overlay.
**Performance Considerations**: Batch process multiple detected foods in a single transaction to prevent multiple UI re-renders.
**Error Handling**: Handle invalid nutritional scaling or missing goal configurations gracefully without crashing the app.
