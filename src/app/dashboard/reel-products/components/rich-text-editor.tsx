"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
  Video,
} from "lucide-react";
import {
  type ClipboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
};

type ToolbarButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write the complete product description...",
  minHeight = 220,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  const [isEmpty, setIsEmpty] = useState(
    !hasVisibleContent(value)
  );

useEffect(() => {
  const editor = editorRef.current;

  if (!editor) {
    return;
  }

  const nextValue = value ?? "";

  if (editor.innerHTML !== nextValue) {
    editor.innerHTML = nextValue;
  }

  lastValueRef.current = nextValue;
  setIsEmpty(!hasVisibleContent(nextValue));
}, [value]);

  function emitChange() {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const html = normaliseHtml(editor.innerHTML);

    lastValueRef.current = html;
    setIsEmpty(!hasVisibleContent(html));
    onChange(html);
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function runCommand(
    command: string,
    commandValue?: string
  ) {
    if (disabled) {
      return;
    }

    focusEditor();

    document.execCommand(
      command,
      false,
      commandValue
    );

    emitChange();
  }

  function formatBlock(tagName: string) {
    runCommand("formatBlock", tagName);
  }

  function createLink() {
    if (disabled) {
      return;
    }

    const url = window.prompt(
      "Enter the full link URL:",
      "https://"
    );

    if (!url?.trim()) {
      return;
    }

    const trimmedUrl = url.trim();

    if (!isSafeLink(trimmedUrl)) {
      window.alert(
        "Only http, https, mailto and tel links are allowed."
      );

      return;
    }

    runCommand("createLink", trimmedUrl);
  }

  function insertVideo() {
    if (disabled) {
      return;
    }

    const url = window.prompt(
      "Enter the direct MP4, WebM, MOV or M4V video URL:",
      "https://"
    );

    if (!url?.trim()) {
      return;
    }

    const trimmedUrl = url.trim();

    if (!isSafeVideoUrl(trimmedUrl)) {
      window.alert(
        "Enter a valid direct video URL ending in MP4, WebM, MOV or M4V."
      );

      return;
    }

    insertHtml(createVideoHtml(trimmedUrl));
  }

  function insertHorizontalRule() {
    insertHtml("<hr>");
  }

  function clearFormatting() {
    if (disabled) {
      return;
    }

    runCommand("removeFormat");
    runCommand("unlink");
  }

  function insertHtml(html: string) {
    if (disabled) {
      return;
    }

    focusEditor();

    document.execCommand(
      "insertHTML",
      false,
      html
    );

    emitChange();
  }

  function handlePaste(
    event: ClipboardEvent<HTMLDivElement>
  ) {
    if (disabled) {
      return;
    }

    event.preventDefault();

    const plainText =
      event.clipboardData.getData("text/plain");

    const clipboardHtml =
      event.clipboardData.getData("text/html");

    const convertedShortcode =
      convertVideoShortcodesToHtml(plainText);

    if (convertedShortcode !== plainText) {
      insertHtml(
        convertPlainTextLineBreaks(
          convertedShortcode
        )
      );

      return;
    }

    const directVideoUrl = plainText.trim();

    if (
      isSafeVideoUrl(directVideoUrl) &&
      !directVideoUrl.includes("\n")
    ) {
      insertHtml(createVideoHtml(directVideoUrl));
      return;
    }

    if (clipboardHtml.trim()) {
      const cleanedHtml =
        sanitisePastedHtml(clipboardHtml);

      if (cleanedHtml) {
        insertHtml(cleanedHtml);
        return;
      }
    }

    insertHtml(
      convertPlainTextLineBreaks(
        escapeHtml(plainText)
      )
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition ${
        disabled
          ? "cursor-not-allowed bg-slate-50 opacity-70"
          : "focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-100"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 p-2">
        <ToolbarButton
          label="Bold"
          disabled={disabled}
          onClick={() => runCommand("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Italic"
          disabled={disabled}
          onClick={() => runCommand("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Underline"
          disabled={disabled}
          onClick={() =>
            runCommand("underline")
          }
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <ToolbarButton
          label="Heading 2"
          disabled={disabled}
          onClick={() => formatBlock("h2")}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Heading 3"
          disabled={disabled}
          onClick={() => formatBlock("h3")}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Paragraph"
          disabled={disabled}
          onClick={() => formatBlock("p")}
        >
          <span className="text-sm font-semibold">
            P
          </span>
        </ToolbarButton>

        <ToolbarButton
          label="Block quote"
          disabled={disabled}
          onClick={() =>
            formatBlock("blockquote")
          }
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <ToolbarButton
          label="Align left"
          disabled={disabled}
          onClick={() =>
            runCommand("justifyLeft")
          }
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Align centre"
          disabled={disabled}
          onClick={() =>
            runCommand("justifyCenter")
          }
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Align right"
          disabled={disabled}
          onClick={() =>
            runCommand("justifyRight")
          }
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Justify"
          disabled={disabled}
          onClick={() =>
            runCommand("justifyFull")
          }
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <ToolbarButton
          label="Bullet list"
          disabled={disabled}
          onClick={() =>
            runCommand("insertUnorderedList")
          }
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Numbered list"
          disabled={disabled}
          onClick={() =>
            runCommand("insertOrderedList")
          }
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Add link"
          disabled={disabled}
          onClick={createLink}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Insert video"
          disabled={disabled}
          onClick={insertVideo}
        >
          <Video className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Horizontal line"
          disabled={disabled}
          onClick={insertHorizontalRule}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <ToolbarButton
          label="Undo"
          disabled={disabled}
          onClick={() => runCommand("undo")}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Redo"
          disabled={disabled}
          onClick={() => runCommand("redo")}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          label="Clear formatting"
          disabled={disabled}
          onClick={clearFormatting}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty ? (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400">
            {placeholder}
          </div>
        ) : null}

        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Product description"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          onPaste={handlePaste}
          className="prose prose-sm max-w-none overflow-y-auto px-4 py-3 text-sm text-slate-800 outline-none prose-a:text-blue-600 prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:pl-4 prose-blockquote:italic prose-h2:mb-3 prose-h2:mt-5 prose-h3:mb-2 prose-h3:mt-4 prose-hr:my-5 prose-ol:pl-6 prose-ul:pl-6 prose-video:my-4 prose-video:w-full prose-video:max-w-full prose-video:rounded-xl"
          style={{
            minHeight,
            maxHeight: 520,
          }}
        />
      </div>

      <div className="border-t bg-slate-50 px-4 py-2">
        <p className="text-xs leading-5 text-slate-500">
          Supports headings, alignment, lists,
          links, quotes, horizontal lines and direct
          video URLs. WordPress video shortcodes are
          automatically converted when pasted.
        </p>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function normaliseHtml(html: string) {
  const trimmed = html.trim();

  if (
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>"
  ) {
    return "";
  }

  return trimmed;
}

function hasVisibleContent(html: string) {
  if (!html.trim()) {
    return false;
  }

  if (
    /<(img|video|iframe|hr)\b/i.test(html)
  ) {
    return true;
  }

  if (typeof document === "undefined") {
    return (
      html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim().length > 0
    );
  }

  const container =
    document.createElement("div");

  container.innerHTML = html;

  return Boolean(
    container.textContent?.trim() ||
      container.querySelector(
        "img, video, iframe, hr"
      )
  );
}

function isSafeLink(value: string) {
  return /^(https?:\/\/|mailto:|tel:)/i.test(
    value
  );
}

function isSafeVideoUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const pathname =
      url.pathname.toLowerCase();

    return /\.(mp4|webm|mov|m4v)$/i.test(
      pathname
    );
  } catch {
    return false;
  }
}

function createVideoHtml(url: string) {
  const safeUrl = escapeHtmlAttribute(url);

  return [
    '<div class="embedded-product-video">',
    '<video controls playsinline preload="metadata" style="width:100%;max-width:100%;border-radius:12px;">',
    `<source src="${safeUrl}">`,
    "Your browser does not support this video.",
    "</video>",
    "</div>",
    "<p><br></p>",
  ].join("");
}

function convertVideoShortcodesToHtml(
  text: string
) {
  const shortcodePattern =
    /\[video\b([^\]]*)\](?:[\s\S]*?)\[\/video\]/gi;

  return text.replace(
    shortcodePattern,
    (fullMatch, attributes: string) => {
      const videoUrl =
        extractVideoUrlFromAttributes(
          attributes
        );

      if (!videoUrl) {
        return fullMatch;
      }

      return createVideoHtml(videoUrl);
    }
  );
}

function extractVideoUrlFromAttributes(
  attributes: string
) {
  const supportedAttributePattern =
    /\b(?:mp4|webm|mov|m4v|src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s\]]+))/i;

  const match = attributes.match(
    supportedAttributePattern
  );

  const value =
    match?.[1] || match?.[2] || match?.[3];

  if (!value) {
    return null;
  }

  const decodedValue =
    decodeHtmlEntities(value.trim());

  return isSafeVideoUrl(decodedValue)
    ? decodedValue
    : null;
}

function sanitisePastedHtml(html: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const parser = new DOMParser();

  const parsed = parser.parseFromString(
    html,
    "text/html"
  );

  const blockedSelectors = [
    "script",
    "style",
    "link",
    "meta",
    "object",
    "embed",
    "iframe",
    "form",
    "input",
    "button",
    "textarea",
    "select",
  ];

  parsed.body
    .querySelectorAll(blockedSelectors.join(","))
    .forEach((element) => {
      element.remove();
    });

  parsed.body
    .querySelectorAll("*")
    .forEach((element) => {
      const attributes = Array.from(
        element.attributes
      );

      for (const attribute of attributes) {
        const name =
          attribute.name.toLowerCase();

        if (
          name.startsWith("on") ||
          name === "id" ||
          name === "class" ||
          name === "contenteditable"
        ) {
          element.removeAttribute(
            attribute.name
          );

          continue;
        }

        if (
          name === "style" &&
          !isAllowedStyle(
            attribute.value
          )
        ) {
          element.removeAttribute("style");
        }

        if (
          element.tagName === "A" &&
          name === "href" &&
          !isSafeLink(attribute.value)
        ) {
          element.removeAttribute("href");
        }

        if (
          element.tagName === "VIDEO" &&
          name === "src" &&
          !isSafeVideoUrl(attribute.value)
        ) {
          element.removeAttribute("src");
        }

        if (
          element.tagName === "SOURCE" &&
          name === "src" &&
          !isSafeVideoUrl(attribute.value)
        ) {
          element.removeAttribute("src");
        }
      }
    });

  parsed.body
    .querySelectorAll("a[href]")
    .forEach((element) => {
      element.setAttribute(
        "rel",
        "noopener noreferrer"
      );
    });

  return parsed.body.innerHTML.trim();
}

function isAllowedStyle(style: string) {
  const normalised =
    style.toLowerCase();

  if (
    normalised.includes("expression(") ||
    normalised.includes("javascript:") ||
    normalised.includes("url(")
  ) {
    return false;
  }

  const allowedProperties = new Set([
    "text-align",
    "font-weight",
    "font-style",
    "text-decoration",
  ]);

  const declarations = normalised
    .split(";")
    .map((declaration) =>
      declaration.trim()
    )
    .filter(Boolean);

  return declarations.every(
    (declaration) => {
      const separatorIndex =
        declaration.indexOf(":");

      if (separatorIndex === -1) {
        return false;
      }

      const property = declaration
        .slice(0, separatorIndex)
        .trim();

      return allowedProperties.has(property);
    }
  );
}

function convertPlainTextLineBreaks(
  value: string
) {
  return value.replace(/\r?\n/g, "<br>");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttribute(
  value: string
) {
  return escapeHtml(value);
}

function decodeHtmlEntities(
  value: string
) {
  if (typeof document === "undefined") {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  const textarea =
    document.createElement("textarea");

  textarea.innerHTML = value;

  return textarea.value;
}