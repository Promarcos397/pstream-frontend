/**
 * Minimal EBML / Matroska byte parser
 * Works entirely in the browser with ArrayBuffers from fetch Range requests.
 */

export const ID_SEGMENT = 0x18538067;
export const ID_TRACKS = 0x1654AE6B;
export const ID_TRACK_ENTRY = 0xAE;
export const ID_TRACK_NUMBER = 0xD7;
export const ID_TRACK_TYPE = 0x83;
export const ID_CODEC_ID = 0x86;
export const ID_LANGUAGE = 0x22B59C;
export const ID_CLUSTER = 0x1F43B675;
export const ID_SIMPLE_BLOCK = 0xA3;
export const ID_TIME_CODE = 0xE7;
export const ID_CUES = 0x1C53BB6B;
export const ID_CUE_POINT = 0xBB;
export const ID_CUE_TIME = 0xB3;
export const ID_CUE_TRACK_POSITIONS = 0xB7;
export const ID_CUE_CLUSTER_POSITION = 0xF1;
export const ID_INFO = 0x1549A966;
export const ID_TIMECODE_SCALE = 0x2AD7B1;

/** Read EBML Variable Length Integer */
export function readVint(data: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= data.length) return null;
  const first = data[offset];
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || offset + length > data.length) return null;

  let value = first & ((1 << (8 - length)) - 1);
  for (let i = 1; i < length; i++) {
    value = (value << 8) | data[offset + i];
  }
  return { value, length };
}

export interface EbmlElement {
  id: number;
  dataOffset: number;
  endOffset: number;
}

/** Read next EBML element at offset. Returns null if incomplete. */
export function readElement(data: Uint8Array, offset: number): EbmlElement | null {
  const idVint = readVint(data, offset);
  if (!idVint) return null;
  const sizeVint = readVint(data, offset + idVint.length);
  if (!sizeVint) return null;
  const dataOffset = offset + idVint.length + sizeVint.length;
  const endOffset = dataOffset + sizeVint.value;
  if (endOffset > data.length) return null;
  return { id: idVint.value, dataOffset, endOffset };
}

export function readString(data: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) str += String.fromCharCode(data[offset + i]);
  return str.replace(/\0/g, '');
}

export function readUint(data: Uint8Array, offset: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length; i++) val = (val << 8) | data[offset + i];
  return val;
}

export function readInt16(data: Uint8Array, offset: number): number {
  const val = (data[offset] << 8) | data[offset + 1];
  return val >= 0x8000 ? val - 0x10000 : val;
}

/** Scan for first occurrence of an element ID within bounds */
export function findElement(
  data: Uint8Array,
  start: number,
  end: number,
  targetId: number
): EbmlElement | null {
  let pos = start;
  while (pos < end) {
    const el = readElement(data, pos);
    if (!el) break;
    if (el.id === targetId) return el;
    pos = el.endOffset;
  }
  return null;
}
