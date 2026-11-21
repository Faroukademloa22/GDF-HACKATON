export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'text';

export interface ClientAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  previewUrl?: string;
  base64Data?: string;
  textContent?: string;
}

export interface ApiMediaAttachment {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES_PER_MESSAGE = 4;

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.log'];
const AUDIO_EXTENSIONS = ['.ogg', '.opus', '.mp3', '.wav', '.m4a', '.aac', '.webm'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'text/plain';
  return 'application/octet-stream';
}

function classifyKind(mimeType: string, fileName: string): AttachmentKind | null {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.some((e) => lower.endsWith(e))) {
    return 'image';
  }
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    return 'pdf';
  }
  if (mimeType.startsWith('audio/') || AUDIO_EXTENSIONS.some((e) => lower.endsWith(e))) {
    return 'audio';
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    TEXT_EXTENSIONS.some((e) => lower.endsWith(e))
  ) {
    return 'text';
  }
  return null;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function readFilesAsAttachments(
  files: FileList | File[],
  existingCount = 0
): Promise<{ attachments: ClientAttachment[]; error: string | null }> {
  const fileArray = Array.from(files);
  const availableSlots = Math.max(0, MAX_FILES_PER_MESSAGE - existingCount);
  if (availableSlots === 0) {
    return {
      attachments: [],
      error: `Maximum of ${MAX_FILES_PER_MESSAGE} attachments per message reached.`,
    };
  }

  const selected = fileArray.slice(0, availableSlots);
  const attachments: ClientAttachment[] = [];
  const errors: string[] = [];

  for (const file of selected) {
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name} exceeds 10 MB limit.`);
      continue;
    }

    const mimeType = inferMimeType(file);
    const kind = classifyKind(mimeType, file.name);
    if (!kind) {
      errors.push(`${file.name} is not a supported image, PDF, audio, or text file.`);
      continue;
    }

    const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    if (kind === 'text') {
      const textContent = (await readAsText(file)).slice(0, 48000);
      attachments.push({
        id,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        kind,
        textContent,
      });
    } else {
      const dataUrl = await readAsDataUrl(file);
      const commaIdx = dataUrl.indexOf(',');
      const base64Data = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      attachments.push({
        id,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        kind,
        previewUrl: kind === 'image' ? dataUrl : undefined,
        base64Data,
      });
    }
  }

  if (fileArray.length > availableSlots) {
    errors.push(`Only ${MAX_FILES_PER_MESSAGE} files can be attached at once.`);
  }

  return {
    attachments,
    error: errors.length > 0 ? errors.join(' ') : null,
  };
}

export function toApiAttachments(attachments: ClientAttachment[]): ApiMediaAttachment[] {
  return attachments.map((att) => ({
    name: att.name,
    mimeType: att.mimeType,
    base64Data: att.base64Data,
    textContent: att.textContent,
  }));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
