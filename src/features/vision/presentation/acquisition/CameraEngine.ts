import { ImageQualityValidator } from '../../data/processing/ImageQualityValidator';

export interface ProcessedImageResult {
  image: string;
  width: number;
  height: number;
  orientation: number;
  quality: number;
  blurScore: number;
  brightnessScore: number;
}

type CameraStatus = 'INITIAL' | 'STARTING' | 'UNAVAILABLE' | 'DENIED' | 'GRANTED';
type Lens = 'user' | 'environment';

interface CameraEngineLifecycleCallbacks {
  onStatusChange?: (status: CameraStatus, hasPermission: boolean | null) => void;
  onStream?: (stream: MediaStream | null) => void;
}

export class CameraSession {
  public status: CameraStatus = 'INITIAL';
  public hasPermission: boolean | null = null;
  public stream: MediaStream | null = null;
  public isMounted = true;
  private request: AbortController | null = null;

  constructor(private callbacks?: CameraEngineLifecycleCallbacks) {}

  public async start(facingMode: Lens = 'environment'): Promise<MediaStream | null> {
    if (!this.isMounted) return null;
    this.stop();
    const request = new AbortController();
    this.request = request;
    this.setStatus('STARTING', null);

    try {
      const stream = await CameraEngine.requestStream(facingMode, { signal: request.signal });
      if (request.signal.aborted) {
        CameraEngine.stopTracks(stream);
        return null;
      }
      this.stream = stream;
      this.setStatus('GRANTED', true);
      this.callbacks?.onStream?.(stream);
      return stream;
    } catch (error) {
      if (request.signal.aborted) return null;
      this.setStatus(CameraEngine.mapAcquisitionError(error), false);
      throw error;
    }
  }

  public stop() {
    this.request?.abort();
    this.request = null;
    if (this.stream) {
      CameraEngine.stopTracks(this.stream);
      this.stream = null;
      this.callbacks?.onStream?.(null);
    }
    this.setStatus('INITIAL', null);
  }

  public unmount() {
    this.isMounted = false;
    this.stop();
  }

  private setStatus(status: CameraStatus, hasPermission: boolean | null) {
    this.status = status;
    this.hasPermission = hasPermission;
    this.callbacks?.onStatusChange?.(status, hasPermission);
  }
}

export class CameraEngine {
  public static async requestStream(facingMode: Lens = 'environment', options?: { signal?: AbortSignal }): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('getUserMedia is not supported or not available in this environment.', 'NotFoundError');
    }
    if (options?.signal?.aborted) throw new DOMException('Camera request aborted', 'AbortError');

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (options?.signal?.aborted) {
      this.stopTracks(stream);
      throw new DOMException('Camera request aborted', 'AbortError');
    }

    return stream;
  }

  public static stopTracks(stream: MediaStream | null | undefined): void {
    for (const track of stream?.getTracks() ?? []) track.stop();
  }

  public static mapAcquisitionError(error: unknown): 'DENIED' | 'UNAVAILABLE' {
    const name = (error as { name?: string } | null)?.name;
    return name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'DENIED' : 'UNAVAILABLE';
  }

  private static async prepareImage(source: CanvasImageSource, width: number, height: number): Promise<ProcessedImageResult> {
    if (width <= 0 || height <= 0) throw new Error('Photo not ready');
    const ratio = Math.min(1, 800 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing unavailable');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.75);
    return {
      image,
      width: canvas.width,
      height: canvas.height,
      orientation: 0,
      ...await ImageQualityValidator.analyzeImage(image),
    };
  }

  public static async captureFromVideo(video: HTMLVideoElement): Promise<ProcessedImageResult> {
    if (video.readyState < 2) throw new Error('Photo not ready');
    return this.prepareImage(video, video.videoWidth, video.videoHeight);
  }

  public static async processFile(file: File): Promise<ProcessedImageResult> {
    if (!file.size || file.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPEG, PNG or WebP photo up to 12 MB');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return await this.prepareImage(image, image.naturalWidth, image.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
