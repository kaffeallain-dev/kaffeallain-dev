import { ImageQualityValidator } from '../../data/processing/ImageQualityValidator';

export interface ProcessedImageResult {
  image: string; // Base64 Data URL
  width: number;
  height: number;
  orientation: number;
  quality: number;
  blurScore: number;
  brightnessScore: number;
}

export interface CameraEngineOptions {
  targetWidth?: number;
  targetHeight?: number;
  compressQuality?: number;
  checkQuality?: boolean;
}

export class CameraEngine {
  private static async resizeImage(dataUrl: string, targetWidth: number, compressQuality: number): Promise<{ uri: string, width: number, height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const resizeRatio = targetWidth / Math.max(img.width, img.height);
        const newWidth = Math.round(img.width * resizeRatio);
        const newHeight = Math.round(img.height * resizeRatio);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No canvas context");
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        const uri = canvas.toDataURL('image/jpeg', compressQuality);
        resolve({ uri, width: newWidth, height: newHeight });
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  public static async processRawImage(
    dataUrl: string,
    width: number,
    height: number,
    options?: CameraEngineOptions
  ): Promise<ProcessedImageResult> {
    const targetWidth = options?.targetWidth || 800;
    const compressQuality = options?.compressQuality || 0.7;
    const checkQuality = options?.checkQuality ?? true;

    const processedImage = await this.resizeImage(dataUrl, targetWidth, compressQuality);

    let qualityStats = { blurScore: 1000, brightnessScore: 120, quality: 1.0 };

    if (checkQuality) {
      qualityStats = await ImageQualityValidator.analyzeImage(processedImage.uri);
    }

    return {
      image: processedImage.uri,
      width: processedImage.width,
      height: processedImage.height,
      orientation: 0,
      quality: qualityStats.quality,
      blurScore: qualityStats.blurScore,
      brightnessScore: qualityStats.brightnessScore
    };
  }

  public static async captureFromVideo(
    videoEl: HTMLVideoElement,
    options?: CameraEngineOptions
  ): Promise<ProcessedImageResult> {
    if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      let attempts = 0;
      while ((videoEl.videoWidth === 0 || videoEl.videoHeight === 0) && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        throw new Error("Video has no dimensions yet, camera is still starting...");
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");
    
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    
    return this.processRawImage(dataUrl, canvas.width, canvas.height, options);
  }

  public static async pickFromGallery(
    options?: CameraEngineOptions
  ): Promise<ProcessedImageResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return resolve(null);
        
        const reader = new FileReader();
        reader.onload = async (re) => {
          const dataUrl = re.target?.result as string;
          if (!dataUrl) return resolve(null);
          
          const img = new Image();
          img.onload = async () => {
            resolve(await this.processRawImage(dataUrl, img.width, img.height, options));
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
}
