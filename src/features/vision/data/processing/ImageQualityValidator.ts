export class ImageQualityValidator {
  public static calculateBrightness(rgbaData: Uint8ClampedArray, width: number, height: number): number {
    let totalBrightness = 0;
    const pixelCount = width * height;
    
    for (let i = 0; i < rgbaData.length; i += 4) {
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    return totalBrightness / pixelCount;
  }

  public static calculateBlur(rgbaData: Uint8ClampedArray, width: number, height: number): number {
    const gray = new Float32Array(width * height);
    for (let i = 0, j = 0; i < rgbaData.length; i += 4, j++) {
      gray[j] = 0.299 * rgbaData[i] + 0.587 * rgbaData[i + 1] + 0.114 * rgbaData[i + 2];
    }

    const laplacian = new Float32Array(width * height);
    let sum = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const val = 
          gray[(y - 1) * width + x] +
          gray[(y + 1) * width + x] +
          gray[y * width + (x - 1)] +
          gray[y * width + (x + 1)] -
          4 * gray[idx];
        
        laplacian[idx] = val;
        sum += val;
      }
    }

    const mean = sum / (width * height);
    let variance = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        variance += Math.pow(laplacian[idx] - mean, 2);
      }
    }

    return variance / (width * height);
  }

  public static async analyzeImage(dataUrl: string): Promise<{ blurScore: number; brightnessScore: number; quality: number }> {
    try {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Downscale for analysis
          const targetWidth = 128;
          const ratio = targetWidth / img.width;
          canvas.width = targetWidth;
          canvas.height = img.height * ratio;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ blurScore: 500, brightnessScore: 120, quality: 1.0 });
            return;
          }
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const brightnessScore = this.calculateBrightness(imageData.data, canvas.width, canvas.height);
          const blurScore = this.calculateBlur(imageData.data, canvas.width, canvas.height);
          
          let quality = 1.0;
          if (brightnessScore < 40 || brightnessScore > 240) quality -= 0.3;
          if (blurScore < 100) quality -= 0.4;
          
          resolve({
            blurScore,
            brightnessScore,
            quality: Math.max(0, Math.min(1.0, quality))
          });
        };
        img.onerror = () => reject(new Error("Failed to load image for analysis"));
        img.src = dataUrl;
      });
    } catch (error) {
      console.warn("[ImageQualityValidator] Failed to analyze image quality:", error);
      return { blurScore: 500, brightnessScore: 120, quality: 1.0 };
    }
  }
}
