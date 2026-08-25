"use client";

import { useRef, useState } from "react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  IndentIncrease,
  IndentDecrease,
  Palette,
  Highlighter,
  Link2,
  ImageIcon,
  Table as TableIcon,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";

/**
 * A Word-style formatting toolbar + editable surface. Built entirely from
 * our own SVG icon set (lucide-react, MIT licensed) rather than Microsoft's
 * Office icons/branding — the ribbon *layout* is functionally equivalent
 * (font, paragraph, styles, insert groups) but nothing here is copied
 * Microsoft artwork. Uses the browser's built-in rich-text editing commands,
 * same as most lightweight web editors.
 */
export function RichEditor({
  html,
  onChange,
  placeholder,
  minHeight = 320,
}: {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState("3");

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  function sync() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function insertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => exec("insertImage", reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function insertTable() {
    const rows = Number(prompt("Rows?", "2")) || 2;
    const cols = Number(prompt("Columns?", "2")) || 2;
    let tableHtml = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
    for (let r = 0; r < rows; r++) {
      tableHtml += "<tr>";
      for (let c = 0; c < cols; c++) {
        tableHtml += '<td style="border:1px solid var(--color-line, #e2e4da);padding:6px 10px;min-width:60px;">&nbsp;</td>';
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</table><p><br></p>";
    exec("insertHTML", tableHtml);
  }

  function insertChecklist() {
    exec(
      "insertHTML",
      '<div style="display:flex;align-items:center;gap:8px;margin:2px 0;"><input type="checkbox" /><span>To-do item</span></div><p><br></p>'
    );
  }

  function insertLink() {
    const url = prompt("Link URL?", "https://");
    if (url) exec("createLink", url);
  }

  return (
    <div>
      {/* ── Ribbon ── */}
      <div className="card-surface flex flex-wrap items-center gap-1 rounded-b-none border-b-0 p-2">
        <Group>
          <ToolButton icon={Undo2} label="Undo" onClick={() => exec("undo")} />
          <ToolButton icon={Redo2} label="Redo" onClick={() => exec("redo")} />
        </Group>

        <Divider />

        <Group>
          <select
            className="toolbar-select"
            defaultValue="p"
            onChange={(e) => exec("formatBlock", e.target.value)}
            aria-label="Paragraph style"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
          </select>
          <select
            className="toolbar-select w-16"
            value={fontSize}
            onChange={(e) => {
              setFontSize(e.target.value);
              exec("fontSize", e.target.value);
            }}
            aria-label="Font size"
          >
            {["1", "2", "3", "4", "5", "6", "7"].map((s) => (
              <option key={s} value={s}>
                {[10, 12, 14, 16, 20, 24, 32][Number(s) - 1]}pt
              </option>
            ))}
          </select>
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={Bold} label="Bold" onClick={() => exec("bold")} />
          <ToolButton icon={Italic} label="Italic" onClick={() => exec("italic")} />
          <ToolButton icon={Underline} label="Underline" onClick={() => exec("underline")} />
          <ToolButton icon={Strikethrough} label="Strikethrough" onClick={() => exec("strikeThrough")} />
        </Group>

        <Divider />

        <Group>
          <ColorButton icon={Palette} label="Text colour" onPick={(c) => exec("foreColor", c)} />
          <ColorButton icon={Highlighter} label="Highlight" onPick={(c) => exec("hiliteColor", c)} />
          <ToolButton icon={Eraser} label="Clear formatting" onClick={() => exec("removeFormat")} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={AlignLeft} label="Align left" onClick={() => exec("justifyLeft")} />
          <ToolButton icon={AlignCenter} label="Align centre" onClick={() => exec("justifyCenter")} />
          <ToolButton icon={AlignRight} label="Align right" onClick={() => exec("justifyRight")} />
          <ToolButton icon={AlignJustify} label="Justify" onClick={() => exec("justifyFull")} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={List} label="Bullet list" onClick={() => exec("insertUnorderedList")} />
          <ToolButton icon={ListOrdered} label="Numbered list" onClick={() => exec("insertOrderedList")} />
          <ToolButton icon={ListChecks} label="Checklist" onClick={insertChecklist} />
          <ToolButton icon={IndentDecrease} label="Decrease indent" onClick={() => exec("outdent")} />
          <ToolButton icon={IndentIncrease} label="Increase indent" onClick={() => exec("indent")} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={Link2} label="Insert link" onClick={insertLink} />
          <ToolButton icon={ImageIcon} label="Insert image" onClick={insertImage} />
          <ToolButton icon={TableIcon} label="Insert table" onClick={insertTable} />
        </Group>
      </div>

      {/* ── Editable surface ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        data-placeholder={placeholder}
        className="thin-scroll rich-editor overflow-y-auto rounded-b-xl rounded-t-none border border-[var(--color-line)] p-4 text-[15px] leading-relaxed outline-none"
        style={{ minHeight, direction: "ltr", unicodeBidi: "normal" }}
        onInput={sync}
        onBlur={sync}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style jsx global>{`
        .toolbar-select {
          border: 1px solid var(--color-line);
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 12.5px;
          background: white;
          color: var(--color-ink);
        }
        .rich-editor {
          direction: ltr;
        }
        .rich-editor,
        .rich-editor * {
          unicode-bidi: normal;
        }
        .rich-editor:empty::before {
          content: attr(data-placeholder);
          color: var(--color-ink-faint);
        }
        .rich-editor h1 {
          font-family: var(--font-display);
          font-size: 1.6em;
          font-weight: 600;
          margin: 0.4em 0;
        }
        .rich-editor h2 {
          font-family: var(--font-display);
          font-size: 1.3em;
          font-weight: 600;
          margin: 0.4em 0;
        }
        .rich-editor h3 {
          font-weight: 600;
          margin: 0.4em 0;
        }
        .rich-editor blockquote {
          border-left: 3px solid var(--color-primary);
          padding-left: 12px;
          color: var(--color-ink-soft);
          margin: 0.5em 0;
        }
        .rich-editor ul,
        .rich-editor ol {
          padding-left: 1.4em;
        }
        .rich-editor img {
          max-width: 100%;
          border-radius: 8px;
        }
        .rich-editor table td {
          vertical-align: top;
        }
      `}</style>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="mx-1.5 h-6 w-px bg-[var(--color-line)]" />;
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep selection/focus in the editor
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)]"
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

function ColorButton({
  icon: Icon,
  label,
  onPick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onPick: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)]"
      >
        <Icon size={16} strokeWidth={2} />
      </button>
      <input
        ref={inputRef}
        type="color"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        onChange={(e) => onPick(e.target.value)}
      />
    </div>
  );
}
