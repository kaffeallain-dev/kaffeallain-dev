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

export interface CameraEngineLifecycleCallbacks {
  onStatusChange?: (status: 'INITIAL' | 'UNAVAILABLE' | 'DENIED' | 'GRANTED', hasPermission: boolean | null) => void;
  onStream?: (stream: MediaStream | null) => void;
}

export class CameraSession {
  public status: 'INITIAL' | 'UNAVAILABLE' | 'DENIED' | 'GRANTED' = 'INITIAL';
  public hasPermission: boolean | null = null;
  public stream: MediaStream | null = null;
  public isMounted: boolean = true;
  private abortController: AbortController | null = null;
  private callbacks?: CameraEngineLifecycleCallbacks;

  constructor(callbacks?: CameraEngineLifecycleCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(facingMode: 'user' | 'environment' = 'environment'): Promise<MediaStream | null> {
    if (this.abortController) {
      this.abortController.abort();
    }
    const ac = new AbortController();
    this.abortController = ac;

    try {
      const stream = await CameraEngine.requestStream(facingMode, { signal: ac.signal });

      // Late stream resolving after unmount or cancellation:
      if (!this.isMounted || ac.signal.aborted) {
        CameraEngine.stopTracks(stream);
        return null;
      }

      if (this.stream && this.stream !== stream) {
        CameraEngine.stopTracks(this.stream);
      }
      this.stream = stream;
      this.status = 'GRANTED';
      this.hasPermission = true;
      this.callbacks?.onStatusChange?.('GRANTED', true);
      this.callbacks?.onStream?.(stream);
      return stream;
    } catch (err: any) {
      if (!this.isMounted || ac.signal.aborted) {
        return null;
      }
      this.status = CameraEngine.mapAcquisitionError(err);
      this.hasPermission = false;
      this.callbacks?.onStatusChange?.(this.status, false);
      throw err;
    }
  }

  public unmount(): void {
    this.isMounted = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.stream) {
      CameraEngine.stopTracks(this.stream);
      this.stream = null;
      this.callbacks?.onStream?.(null);
    }
  }
}

export class CameraEngine {
  public static async requestStream(
    facingMode: 'user' | 'environment' = 'environment',
    options?: { signal?: AbortSignal }
  ): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error("getUserMedia is not supported or not available in this environment.");
      (err as any).name = 'NotFoundError';
      throw err;
    }

    if (options?.signal?.aborted) {
      const err = new Error("Camera request aborted");
      (err as any).name = 'AbortError';
      throw err;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode }
    });

    if (options?.signal?.aborted) {
      this.stopTracks(stream);
      const err = new Error("Camera request aborted");
      (err as any).name = 'AbortError';
      throw err;
    }

    return stream;
  }

  public static stopTracks(stream: MediaStream | null | undefined): void {
    if (!stream) return;
    try {
      const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
      for (const track of tracks) {
        if (track && typeof track.stop === 'function') {
          track.stop();
        }
      }
    } catch (err) {
      console.warn('Error stopping media stream tracks:', err);
    }
  }

  public static mapAcquisitionError(err: any): 'DENIED' | 'UNAVAILABLE' {
    if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      return 'DENIED';
    }
    return 'UNAVAILABLE';
  }

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
