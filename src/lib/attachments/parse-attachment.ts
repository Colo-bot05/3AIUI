import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import {
  MAX_ATTACHMENT_EXCERPT_LENGTH,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TEXT_LENGTH,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from "@/features/attachments/types";
import type {
  ParsedAttachmentResponse,
} from "@/features/attachments/types";
import type {
  MeetingAttachment,
  SupportedAttachmentExtension,
} from "@/features/meeting/types";

const XML_TEXT_PATTERN = /<(?:\w+:)?t\b[^>]*>(.*?)<\/(?:\w+:)?t>/g;
const SHEET_FILE_PATTERN = /^xl\/worksheets\/sheet\d+\.xml$/;
const SLIDE_FILE_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;
const READABLE_TEXT_PATTERN =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9]/gu;
const SUSPICIOUS_TEXT_PATTERN =
  /[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9\s.,:;!?()[\]'"\-_/]/gu;

function escapeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}\n\n[truncated]`;
}

function isLowQualityExtractedText(value: string) {
  const normalizedValue = normalizeExtractedText(value);
  const compactValue = normalizedValue.replace(/\s/g, "");

  if (compactValue.length < 8) {
    return true;
  }

  const readableCharacters =
    normalizedValue.match(READABLE_TEXT_PATTERN)?.length ?? 0;
  const suspiciousCharacters =
    normalizedValue.match(SUSPICIOUS_TEXT_PATTERN)?.length ?? 0;
  const readableRatio = readableCharacters / Math.max(compactValue.length, 1);
  const suspiciousRatio = suspiciousCharacters / Math.max(compactValue.length, 1);

  return readableRatio < 0.45 || suspiciousRatio > 0.2;
}

function buildAttachmentId() {
  return `attachment-${Math.random().toString(36).slice(2, 10)}`;
}

function getExtension(filename: string): SupportedAttachmentExtension | null {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) {
    return null;
  }

  return SUPPORTED_ATTACHMENT_EXTENSIONS.includes(
    extension as SupportedAttachmentExtension,
  )
    ? (extension as SupportedAttachmentExtension)
    : null;
}

function extractXmlText(xmlText: string) {
  const values: string[] = [];

  for (const match of xmlText.matchAll(XML_TEXT_PATTERN)) {
    if (match[1]) {
      values.push(escapeXml(match[1]));
    }
  }

  return values;
}

async function parseTextFile(file: File) {
  return normalizeExtractedText(await file.text());
}

async function parseDocxFile(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value);
}

async function parsePdfFile(buffer: Buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const normalizedText = normalizeExtractedText(result.text);
    return isLowQualityExtractedText(normalizedText) ? "" : normalizedText;
  } catch {
    const printableText = buffer
      .toString("latin1")
      .match(/\(([^\)]{2,})\)/g)
      ?.map((value) => value.slice(1, -1))
      .join(" ");

    const normalizedText = normalizeExtractedText(printableText ?? "");
    return isLowQualityExtractedText(normalizedText) ? "" : normalizedText;
  }
}

async function parsePptxFile(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => SLIDE_FILE_PATTERN.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const slides = await Promise.all(
    slideNames.map(async (name, index) => {
      const xml = await zip.file(name)?.async("text");
      if (!xml) {
        return "";
      }

      const text = extractXmlText(xml).join(" ");
      return text ? `Slide ${index + 1}: ${text}` : "";
    }),
  );

  return normalizeExtractedText(slides.filter(Boolean).join("\n\n"));
}

async function parseXlsxFile(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedStringsXml ? extractXmlText(sharedStringsXml) : [];

  const sheetNames = Object.keys(zip.files)
    .filter((name) => SHEET_FILE_PATTERN.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const sheets = await Promise.all(
    sheetNames.map(async (name, index) => {
      const xml = await zip.file(name)?.async("text");
      if (!xml) {
        return "";
      }

      const values: string[] = [];

      for (const sharedMatch of xml.matchAll(/<c[^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/g)) {
        const stringIndex = Number(sharedMatch[1]);
        if (!Number.isNaN(stringIndex) && sharedStrings[stringIndex]) {
          values.push(sharedStrings[stringIndex]);
        }
      }

      for (const inlineMatch of xml.matchAll(/<c[^>]*t="inlineStr"[^>]*>.*?<is>\s*<(?:\w+:)?t\b[^>]*>(.*?)<\/(?:\w+:)?t>\s*<\/is>.*?<\/c>/g)) {
        if (inlineMatch[1]) {
          values.push(escapeXml(inlineMatch[1]));
        }
      }

      for (const rawMatch of xml.matchAll(/<c(?![^>]*t="s")(?![^>]*t="inlineStr")[^>]*>\s*<v>(.*?)<\/v>\s*<\/c>/g)) {
        const rawValue = rawMatch[1]?.trim();
        if (rawValue) {
          values.push(escapeXml(rawValue));
        }
      }

      const dedupedValues = values.filter((value, valueIndex) => values.indexOf(value) === valueIndex);
      return dedupedValues.length > 0
        ? `Sheet ${index + 1}: ${dedupedValues.join(" | ")}`
        : "";
    }),
  );

  return normalizeExtractedText(sheets.filter(Boolean).join("\n\n"));
}

async function extractAttachmentText(
  extension: SupportedAttachmentExtension,
  file: File,
  buffer: Buffer,
) {
  switch (extension) {
    case "txt":
    case "md":
      return parseTextFile(file);
    case "docx":
      return parseDocxFile(buffer);
    case "pdf":
      return parsePdfFile(buffer);
    case "pptx":
      return parsePptxFile(buffer);
    case "xlsx":
      return parseXlsxFile(buffer);
  }
}

export async function parseAttachmentFile(file: File): Promise<ParsedAttachmentResponse> {
  const extension = getExtension(file.name);

  if (!extension) {
    return {
      error: {
        filename: file.name,
        message: "対応していないファイル形式です。",
      },
    };
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      error: {
        filename: file.name,
        message: "ファイルサイズが上限を超えています。",
      },
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extractedText = await extractAttachmentText(extension, file, buffer);

  if (!extractedText) {
    return {
      error: {
        filename: file.name,
        message: "テキストを抽出できませんでした。",
      },
    };
  }

  const normalizedText = truncateText(extractedText, MAX_ATTACHMENT_TEXT_LENGTH);
  const attachment: MeetingAttachment = {
    id: buildAttachmentId(),
    filename: file.name,
    extension,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    extractedText: normalizedText,
    excerpt: truncateText(normalizedText, MAX_ATTACHMENT_EXCERPT_LENGTH),
  };

  return { attachment };
}
