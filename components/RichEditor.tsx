"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  Unlink,
  ImageIcon,
  Table as TableIcon,
  Eraser,
  Rows3,
  Columns3,
  Trash2,
  ExternalLink,
  Pencil,
  Languages,
} from "lucide-react";

/**
 * A Word-style formatting toolbar + editable surface. Built entirely from
 * our own SVG icon set (lucide-react, MIT licensed) rather than Microsoft's
 * Office icons/branding — the ribbon *layout* is functionally equivalent
 * (font, paragraph, styles, insert groups) but nothing here is copied
 * Microsoft artwork.
 *
 * Text editing still uses the browser's contentEditable + execCommand for
 * plain formatting (bold/italic/lists/etc — these work fine natively), but
 * images, tables, links, undo/redo and bidirectional text are handled with
 * dedicated logic below because execCommand cannot do any of that reliably.
 */

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "TD", "TH"]);
const NON_TEXT_DIV_CLASSES = ["img-wrap", "table-scroll"];
const HISTORY_LIMIT = 100;

function isElement(node: Node | null): node is HTMLElement {
  return !!node && node.nodeType === Node.ELEMENT_NODE;
}

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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState("3");
  const [blockFormat, setBlockFormat] = useState("p");
  const [currentDir, setCurrentDir] = useState<"ltr" | "rtl">("ltr");
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null);
  const [imageRect, setImageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null);
  const [tableGeometry, setTableGeometry] = useState<TableGeometry | null>(null);

  const [activeLink, setActiveLink] = useState<HTMLAnchorElement | null>(null);
  const [linkPos, setLinkPos] = useState<{ left: number; top: number } | null>(null);

  // ── History (custom, since execCommand undo can't see our DOM-level edits) ──
  const history = useRef<{ stack: string[]; index: number }>({ stack: [html], index: 0 });
  const isRestoring = useRef(false);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─────────────────────────────────────────────────────────────────
  // Initial mount: set content once, normalise legacy content, never
  // let React's dangerouslySetInnerHTML fight the user while typing.
  // (Root cause of the old cursor-jump/perf issues: onChange fed
  // straight back into the `html` prop, which re-applied
  // dangerouslySetInnerHTML on every keystroke.)
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = html || "";
    normalizeContent(editorRef.current);
    history.current = { stack: [editorRef.current.innerHTML], index: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (changeTimer.current) {
        clearTimeout(changeTimer.current);
        commitChange();
      }
      if (historyTimer.current) clearTimeout(historyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitChange() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }

  // Only actually calls .focus() if the editor doesn't already have it —
  // refocusing an already-focused contenteditable can needlessly move or
  // collapse the current selection in some engines, which would make
  // toolbar actions apply to the wrong block/selection.
  function focusEditor() {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
  }

  function syncDebounced(immediate = false) {
    if (changeTimer.current) clearTimeout(changeTimer.current);
    if (immediate) commitChange();
    else changeTimer.current = setTimeout(commitChange, 350);
    scheduleHistorySnapshot(immediate);
  }

  function scheduleHistorySnapshot(immediate = false) {
    if (isRestoring.current) return;
    if (historyTimer.current) clearTimeout(historyTimer.current);
    const push = () => {
      if (!editorRef.current) return;
      const current = editorRef.current.innerHTML;
      const h = history.current;
      if (h.stack[h.index] === current) return;
      const truncated = h.stack.slice(0, h.index + 1);
      truncated.push(current);
      while (truncated.length > HISTORY_LIMIT) truncated.shift();
      history.current = { stack: truncated, index: truncated.length - 1 };
    };
    if (immediate) push();
    else historyTimer.current = setTimeout(push, 500);
  }

  function undo() {
    const h = history.current;
    if (h.index <= 0 || !editorRef.current) return;
    h.index -= 1;
    isRestoring.current = true;
    editorRef.current.innerHTML = h.stack[h.index];
    isRestoring.current = false;
    deselectAll();
    commitChange();
    requestAnimationFrame(refreshToolbarState);
  }

  function redo() {
    const h = history.current;
    if (h.index >= h.stack.length - 1 || !editorRef.current) return;
    h.index += 1;
    isRestoring.current = true;
    editorRef.current.innerHTML = h.stack[h.index];
    isRestoring.current = false;
    deselectAll();
    commitChange();
    requestAnimationFrame(refreshToolbarState);
  }

  function deselectAll() {
    setSelectedImage(null);
    setImageRect(null);
    setActiveTable(null);
    setTableGeometry(null);
    setActiveLink(null);
    setLinkPos(null);
  }

  function exec(command: string, value?: string) {
    focusEditor();
    document.execCommand(command, false, value);
    syncDebounced(true);
    requestAnimationFrame(refreshToolbarState);
  }

  // ───────────────────────────── Direction (LTR/RTL) ─────────────────────────────
  // Each block gets dir="auto" by default, which makes the browser's native
  // Unicode Bidi Algorithm pick the right direction per paragraph as you
  // type — the same mechanism Gmail/Docs use. A manual override (the
  // toolbar LTR/RTL buttons) sets an explicit dir + a data flag so
  // auto-detection stops touching that block.
  function getBlockElement(node: Node | null): HTMLElement | null {
    let el: Node | null = node;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    while (el && el !== editorRef.current) {
      if (
        isElement(el) &&
        BLOCK_TAGS.has(el.tagName) &&
        !NON_TEXT_DIV_CLASSES.some((c) => el instanceof HTMLElement && el.classList.contains(c))
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function getSelectedBlocks(): HTMLElement[] {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return [];
    const range = sel.getRangeAt(0);
    const startBlock = getBlockElement(range.startContainer) ?? editorRef.current;
    const endBlock = getBlockElement(range.endContainer) ?? editorRef.current;
    if (startBlock === endBlock) return [startBlock];
    const all = Array.from(
      editorRef.current.querySelectorAll<HTMLElement>("p,div,li,h1,h2,h3,h4,h5,h6,blockquote,td,th")
    ).filter((el) => !NON_TEXT_DIV_CLASSES.some((c) => el.classList.contains(c)));
    const startIdx = all.indexOf(startBlock);
    const endIdx = all.indexOf(endBlock);
    if (startIdx === -1 || endIdx === -1) return [startBlock, endBlock];
    const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    return all.slice(lo, hi + 1);
  }

  function ensureAutoDirection(block: HTMLElement) {
    if (block.dataset.dirManual === "true") return;
    if (!block.getAttribute("dir")) block.setAttribute("dir", "auto");
  }

  function setManualDirection(dir: "ltr" | "rtl") {
    // Read the current selection BEFORE moving focus — focusing an editor
    // that didn't already have focus can move/collapse the selection, so
    // capturing the target blocks first keeps this correct even when the
    // toolbar button is pressed without the editor already being active.
    const blocks = getSelectedBlocks();
    focusEditor();
    blocks.forEach((b) => {
      b.setAttribute("dir", dir);
      b.dataset.dirManual = "true";
    });
    // Re-anchor the selection inside the affected block: focusing can
    // otherwise leave the browser's live selection collapsed somewhere
    // else, which would make the *next* toolbar action apply to the
    // wrong block.
    if (blocks.length) placeCaretAtEnd(blocks[blocks.length - 1]);
    syncDebounced(true);
    refreshToolbarState();
  }

  function setAutoDirection() {
    const blocks = getSelectedBlocks();
    focusEditor();
    blocks.forEach((b) => {
      delete b.dataset.dirManual;
      b.setAttribute("dir", "auto");
    });
    if (blocks.length) placeCaretAtEnd(blocks[blocks.length - 1]);
    syncDebounced(true);
    refreshToolbarState();
  }

  // ───────────────────────────── Toolbar state ─────────────────────────────
  const refreshToolbarState = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) return;

    try {
      setActiveStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        justifyFull: document.queryCommandState("justifyFull"),
      });
    } catch {
      // queryCommandState can throw in rare states; ignore, non-critical
    }

    const block = getBlockElement(sel.anchorNode) ?? editorRef.current;
    const tag = block?.tagName?.toLowerCase();
    if (tag && ["h1", "h2", "h3", "p", "blockquote"].includes(tag)) setBlockFormat(tag);
    if (block) {
      const computed = getComputedStyle(block).direction;
      setCurrentDir(computed === "rtl" ? "rtl" : "ltr");
    }

    const anchor = closestWithin(sel.anchorNode, "a", editorRef.current);
    if (anchor) {
      setActiveLink(anchor as HTMLAnchorElement);
      positionLinkChip(anchor as HTMLAnchorElement);
    } else {
      setActiveLink(null);
      setLinkPos(null);
    }

    const cell = getCurrentCell();
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (table) {
      setActiveTable(table);
      refreshTableGeometry(table);
    } else {
      setActiveTable(null);
      setTableGeometry(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onSelChange() {
      requestAnimationFrame(refreshToolbarState);
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, [refreshToolbarState]);

  function positionLinkChip(anchor: HTMLAnchorElement) {
    if (!surfaceRef.current) return;
    const r = anchor.getBoundingClientRect();
    const sr = surfaceRef.current.getBoundingClientRect();
    setLinkPos({ left: r.left - sr.left, top: r.bottom - sr.top + 6 });
  }

  function closestWithin(node: Node | null, selector: string, root: HTMLElement): Element | null {
    let el: Node | null = node;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    while (el && el !== root) {
      if (isElement(el) && el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // ───────────────────────────── Input / keydown ─────────────────────────────
  function handleInput() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const block = getBlockElement(sel.anchorNode) ?? editorRef.current;
      if (block) ensureAutoDirection(block);
    }
    syncDebounced();
    requestAnimationFrame(refreshToolbarState);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.key === "Backspace" || e.key === "Delete") && selectedImage) {
      e.preventDefault();
      deleteSelectedImage();
      return;
    }
    if (e.key === "Tab") {
      const cell = getCurrentCell();
      if (cell) {
        e.preventDefault();
        moveToAdjacentCell(cell, e.shiftKey ? -1 : 1);
      }
    }
  }

  function handlePaste() {
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      normalizeContent(editorRef.current);
      syncDebounced(true);
    });
  }

  function handleBlur() {
    commitChange();
  }

  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;

    const imgWrap = target.closest?.(".img-wrap") as HTMLElement | null;
    if (imgWrap && editorRef.current?.contains(imgWrap)) {
      e.preventDefault();
      selectImage(imgWrap);
      return;
    }
    if (selectedImage) {
      setSelectedImage(null);
      setImageRect(null);
    }

    const anchor = target.closest?.("a") as HTMLAnchorElement | null;
    if (anchor && editorRef.current?.contains(anchor)) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        window.open(anchor.href, "_blank", "noopener,noreferrer");
      } else {
        // Avoid navigating away mid-edit; caret placement still happens.
        e.preventDefault();
      }
    }
  }

  // ───────────────────────────── Images ─────────────────────────────
  function insertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const probe = new Image();
        probe.onload = () => insertImageNode(src, probe.naturalWidth, probe.naturalHeight);
        probe.onerror = () => insertImageNode(src, 320, 200);
        probe.src = src;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function insertImageNode(src: string, naturalW: number, naturalH: number) {
    if (!editorRef.current) return;
    focusEditor();
    const maxWidth = Math.max(120, editorRef.current.clientWidth - 32);
    const width = Math.min(naturalW || 320, maxWidth, 480);
    const height = naturalW ? Math.round((width / naturalW) * (naturalH || width * 0.6)) : Math.round(width * 0.6);

    const wrap = document.createElement("span");
    wrap.className = "img-wrap";
    wrap.setAttribute("contenteditable", "false");
    wrap.setAttribute("data-align", "inline");
    wrap.style.display = "inline-block";
    wrap.style.position = "relative";
    wrap.style.maxWidth = "100%";
    wrap.style.verticalAlign = "bottom";
    wrap.style.lineHeight = "0";

    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.style.display = "block";
    img.style.width = width + "px";
    img.style.height = height + "px";
    img.style.maxWidth = "100%";
    img.style.borderRadius = "8px";
    wrap.appendChild(img);

    insertNodeAtSelection(wrap, true);
    syncDebounced(true);
    selectImage(wrap);
  }

  function selectImage(wrap: HTMLElement) {
    setSelectedImage(wrap);
    updateImageRect(wrap);
  }

  function updateImageRect(wrap: HTMLElement) {
    if (!surfaceRef.current) return;
    const r = wrap.getBoundingClientRect();
    const sr = surfaceRef.current.getBoundingClientRect();
    setImageRect({ left: r.left - sr.left, top: r.top - sr.top, width: r.width, height: r.height });
  }

  function deleteSelectedImage() {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    setImageRect(null);
    syncDebounced(true);
  }

  function setImageAlign(align: "left" | "center" | "right" | "inline") {
    if (!selectedImage) return;
    selectedImage.setAttribute("data-align", align);
    if (align === "left") {
      selectedImage.style.cssText = "display:inline-block;position:relative;max-width:100%;float:left;margin:4px 14px 8px 0;";
    } else if (align === "right") {
      selectedImage.style.cssText = "display:inline-block;position:relative;max-width:100%;float:right;margin:4px 0 8px 14px;";
    } else if (align === "center") {
      selectedImage.style.cssText = "display:block;position:relative;max-width:100%;margin:10px auto;float:none;text-align:center;";
    } else {
      selectedImage.style.cssText = "display:inline-block;position:relative;max-width:100%;vertical-align:bottom;float:none;margin:0 2px;";
    }
    syncDebounced(true);
    updateImageRect(selectedImage);
  }

  function startImageResize(e: React.MouseEvent | React.TouchEvent, corner: "nw" | "ne" | "sw" | "se") {
    e.preventDefault();
    e.stopPropagation();
    const wrap = selectedImage;
    const img = wrap?.querySelector("img");
    if (!wrap || !img || !editorRef.current) return;
    const start = pointerPos(e);
    const startWidth = img.getBoundingClientRect().width;
    const startHeight = img.getBoundingClientRect().height;
    const aspect = startWidth / (startHeight || 1);
    const sign = corner === "ne" || corner === "se" ? 1 : -1;
    const maxWidth = Math.max(80, editorRef.current.clientWidth - 16);

    beginDrag(
      (x) => {
        const deltaX = (x - start.x) * sign;
        const newWidth = Math.max(40, Math.min(maxWidth, startWidth + deltaX));
        const newHeight = newWidth / aspect;
        img.style.width = newWidth + "px";
        img.style.height = newHeight + "px";
        updateImageRect(wrap);
      },
      () => syncDebounced(true)
    );
  }

  // ───────────────────────────── Links ─────────────────────────────
  function normalizeUrl(raw: string): string | null {
    const url = raw.trim();
    if (!url) return null;
    if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
    if (/^www\./i.test(url)) return "https://" + url;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) return "https://" + url;
    return url;
  }

  function insertLink() {
    // Capture selection state before focusing (focusing an unfocused
    // editor can move/collapse the selection — same fix as direction).
    const sel = window.getSelection();
    const hasSelection = !!sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode);
    focusEditor();
    const raw = prompt("Link URL", "https://");
    if (!raw) return;
    const url = normalizeUrl(raw);
    if (!url) return;

    if (hasSelection) {
      document.execCommand("createLink", false, url);
    } else {
      const text = prompt("Link text", url) || url;
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${escapeAttr(url)}">${escapeHtml(text)}</a>`
      );
    }
    // Secure any anchors we just touched.
    editorRef.current?.querySelectorAll("a[href]").forEach((a) => {
      const anchor = a as HTMLAnchorElement;
      if (!anchor.target) anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    });
    syncDebounced(true);
    requestAnimationFrame(refreshToolbarState);
  }

  function editActiveLink() {
    if (!activeLink) return;
    const raw = prompt("Link URL", activeLink.getAttribute("href") || "https://");
    if (raw === null) return;
    const url = normalizeUrl(raw);
    if (!url) return;
    activeLink.setAttribute("href", url);
    activeLink.target = "_blank";
    activeLink.rel = "noopener noreferrer";
    syncDebounced(true);
  }

  function removeActiveLink() {
    if (!activeLink || !editorRef.current) return;
    focusEditor();
    const range = document.createRange();
    range.selectNodeContents(activeLink);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("unlink");
    setActiveLink(null);
    setLinkPos(null);
    syncDebounced(true);
  }

  // ───────────────────────────── Tables ─────────────────────────────
  function insertTable() {
    if (!editorRef.current) return;
    const rowsInput = prompt("Rows?", "3");
    if (rowsInput === null) return;
    const colsInput = prompt("Columns?", "3");
    if (colsInput === null) return;
    const rows = Math.max(1, Math.min(50, Math.round(Number(rowsInput)) || 3));
    const cols = Math.max(1, Math.min(12, Math.round(Number(colsInput)) || 3));
    focusEditor();

    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    wrap.style.overflowX = "auto";
    wrap.style.maxWidth = "100%";
    wrap.style.margin = "10px 0";

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.tableLayout = "fixed";

    const colgroup = document.createElement("colgroup");
    for (let c = 0; c < cols; c++) {
      const col = document.createElement("col");
      col.style.width = 100 / cols + "%";
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const tbody = document.createElement("tbody");
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        applyCellStyle(td);
        td.innerHTML = "<br>";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    insertNodeAtSelection(wrap, false);

    // Guarantee an editable line after the table so users aren't trapped.
    const p = document.createElement("p");
    p.setAttribute("dir", "auto");
    p.innerHTML = "<br>";
    wrap.after(p);
    placeCaretAtStart(p);

    syncDebounced(true);
  }

  function applyCellStyle(td: HTMLElement) {
    td.style.border = "1px solid var(--color-line, #e2e4da)";
    td.style.padding = "6px 10px";
    td.style.minWidth = "40px";
    td.style.verticalAlign = "top";
  }

  function getCurrentCell(): HTMLTableCellElement | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
    const el = closestWithin(sel.anchorNode, "td,th", editorRef.current);
    return (el as HTMLTableCellElement) ?? null;
  }

  function refreshTableGeometry(table: HTMLTableElement) {
    if (!surfaceRef.current) return;
    setTableGeometry(computeTableGeometry(table, surfaceRef.current));
  }

  function insertTableRow(offset: 0 | 1) {
    const cell = getCurrentCell();
    const row = cell?.closest("tr");
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!cell || !row || !table) return;
    const cols = row.children.length;
    const newRow = document.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = document.createElement("td");
      const template = row.children[i] as HTMLElement;
      td.style.cssText = template?.style.cssText || "";
      applyCellStyle(td);
      td.innerHTML = "<br>";
      newRow.appendChild(td);
    }
    if (offset === 0) row.before(newRow);
    else row.after(newRow);
    syncDebounced(true);
    refreshTableGeometry(table);
  }

  function deleteTableRow() {
    const cell = getCurrentCell();
    const row = cell?.closest("tr");
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!row || !table) return;
    const rowCount = table.querySelectorAll("tr").length;
    if (rowCount <= 1) return;
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    syncDebounced(true);
    const nextCell = next?.querySelector("td,th");
    if (nextCell) placeCaretAtStart(nextCell);
    refreshTableGeometry(table);
  }

  function insertTableColumn(offset: 0 | 1) {
    const cell = getCurrentCell();
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!cell || !table) return;
    const row = cell.closest("tr")!;
    const idx = Array.from(row.children).indexOf(cell);
    const insertAt = idx + offset;
    table.querySelectorAll("tr").forEach((tr) => {
      const ref = tr.children[insertAt] as HTMLElement | undefined;
      const templateCell = tr.children[idx] as HTMLElement;
      const td = document.createElement(templateCell?.tagName === "TH" ? "th" : "td");
      td.style.cssText = templateCell?.style.cssText || "";
      applyCellStyle(td);
      td.innerHTML = "<br>";
      if (ref) tr.insertBefore(td, ref);
      else tr.appendChild(td);
    });
    const colgroup = table.querySelector("colgroup");
    if (colgroup) {
      const cols = Array.from(colgroup.children) as HTMLElement[];
      const width = 100 / (cols.length + 1);
      cols.forEach((c) => (c.style.width = width + "%"));
      const newCol = document.createElement("col");
      newCol.style.width = width + "%";
      const refCol = colgroup.children[insertAt];
      if (refCol) colgroup.insertBefore(newCol, refCol);
      else colgroup.appendChild(newCol);
    }
    syncDebounced(true);
    refreshTableGeometry(table);
  }

  function deleteTableColumn() {
    const cell = getCurrentCell();
    const table = cell?.closest("table") as HTMLTableElement | null;
    if (!cell || !table) return;
    const row = cell.closest("tr")!;
    const idx = Array.from(row.children).indexOf(cell);
    if (row.children.length <= 1) return;
    table.querySelectorAll("tr").forEach((tr) => {
      tr.children[idx]?.remove();
    });
    const colgroup = table.querySelector("colgroup");
    if (colgroup) {
      colgroup.children[idx]?.remove();
      const remaining = Array.from(colgroup.children) as HTMLElement[];
      const width = 100 / Math.max(1, remaining.length);
      remaining.forEach((c) => (c.style.width = width + "%"));
    }
    syncDebounced(true);
    refreshTableGeometry(table);
  }

  function moveToAdjacentCell(cell: HTMLTableCellElement, dir: 1 | -1) {
    const table = cell.closest("table");
    if (!table) return;
    const cells = Array.from(table.querySelectorAll("td,th"));
    const idx = cells.indexOf(cell);
    const nextIdx = idx + dir;
    if (nextIdx < 0) return;
    if (nextIdx >= cells.length) {
      insertTableRow(1);
      const newCells = Array.from(table.querySelectorAll("td,th"));
      const target = newCells[cells.length];
      if (target) placeCaretAtStart(target);
      return;
    }
    placeCaretAtStart(cells[nextIdx]);
  }

  function startColumnResize(e: React.MouseEvent | React.TouchEvent, table: HTMLTableElement, colIndex: number) {
    e.preventDefault();
    const colgroup = table.querySelector("colgroup");
    if (!colgroup) return;
    const cols = Array.from(colgroup.children) as HTMLElement[];
    const tableWidth = table.getBoundingClientRect().width;
    const start = pointerPos(e);
    const startLeftPct = parseFloat(cols[colIndex]?.style.width || "0");
    const startRightPct = parseFloat(cols[colIndex + 1]?.style.width || "0");
    const MIN = 6;

    beginDrag(
      (x) => {
        const deltaPct = ((x - start.x) / tableWidth) * 100;
        let newLeft = startLeftPct + deltaPct;
        let newRight = startRightPct - deltaPct;
        if (newLeft < MIN) {
          newRight -= MIN - newLeft;
          newLeft = MIN;
        }
        if (newRight < MIN) {
          newLeft -= MIN - newRight;
          newRight = MIN;
        }
        cols[colIndex].style.width = newLeft + "%";
        cols[colIndex + 1].style.width = newRight + "%";
        refreshTableGeometry(table);
      },
      () => syncDebounced(true)
    );
  }

  function startRowResize(e: React.MouseEvent | React.TouchEvent, table: HTMLTableElement, rowIndex: number) {
    e.preventDefault();
    const rows = Array.from(table.querySelectorAll("tr"));
    const row = rows[rowIndex] as HTMLElement;
    if (!row) return;
    const start = pointerPos(e);
    const startHeight = row.getBoundingClientRect().height;

    beginDrag(
      (_x, y) => {
        const newHeight = Math.max(24, startHeight + (y - start.y));
        Array.from(row.children).forEach((c) => ((c as HTMLElement).style.height = newHeight + "px"));
        refreshTableGeometry(table);
      },
      () => syncDebounced(true)
    );
  }

  // ───────────────────────────── Shared helpers ─────────────────────────────
  function insertNodeAtSelection(node: HTMLElement, placeCaretAfter: boolean) {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(node);
    if (placeCaretAfter) {
      const after = document.createRange();
      after.setStartAfter(node);
      after.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(after);
    }
  }

  return (
    <div>
      {/* ── Ribbon ── */}
      <div className="card-surface flex flex-wrap items-center gap-1 rounded-b-none border-b-0 p-2">
        <Group>
          <ToolButton icon={Undo2} label="Undo" onClick={undo} />
          <ToolButton icon={Redo2} label="Redo" onClick={redo} />
        </Group>

        <Divider />

        <Group>
          <select
            className="toolbar-select"
            value={blockFormat}
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
          <ToolButton icon={Bold} label="Bold" active={activeStates.bold} onClick={() => exec("bold")} />
          <ToolButton icon={Italic} label="Italic" active={activeStates.italic} onClick={() => exec("italic")} />
          <ToolButton icon={Underline} label="Underline" active={activeStates.underline} onClick={() => exec("underline")} />
          <ToolButton icon={Strikethrough} label="Strikethrough" active={activeStates.strikeThrough} onClick={() => exec("strikeThrough")} />
        </Group>

        <Divider />

        <Group>
          <ColorButton icon={Palette} label="Text colour" onPick={(c) => exec("foreColor", c)} />
          <ColorButton icon={Highlighter} label="Highlight" onPick={(c) => exec("hiliteColor", c)} />
          <ToolButton icon={Eraser} label="Clear formatting" onClick={() => exec("removeFormat")} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={AlignLeft} label="Align left" active={activeStates.justifyLeft} onClick={() => exec("justifyLeft")} />
          <ToolButton icon={AlignCenter} label="Align centre" active={activeStates.justifyCenter} onClick={() => exec("justifyCenter")} />
          <ToolButton icon={AlignRight} label="Align right" active={activeStates.justifyRight} onClick={() => exec("justifyRight")} />
          <ToolButton icon={AlignJustify} label="Justify" active={activeStates.justifyFull} onClick={() => exec("justifyFull")} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={List} label="Bullet list" active={activeStates.insertUnorderedList} onClick={() => exec("insertUnorderedList")} />
          <ToolButton icon={ListOrdered} label="Numbered list" active={activeStates.insertOrderedList} onClick={() => exec("insertOrderedList")} />
          <ToolButton
            icon={ListChecks}
            label="Checklist"
            onClick={() =>
              exec(
                "insertHTML",
                '<div style="display:flex;align-items:center;gap:8px;margin:2px 0;"><input type="checkbox" /><span>To-do item</span></div><p dir="auto"><br></p>'
              )
            }
          />
          <ToolButton icon={IndentDecrease} label="Decrease indent" onClick={() => exec("outdent")} />
          <ToolButton icon={IndentIncrease} label="Increase indent" onClick={() => exec("indent")} />
        </Group>

        <Divider />

        <Group>
          <DirButton label="LTR" active={currentDir === "ltr"} onClick={() => setManualDirection("ltr")} />
          <DirButton label="RTL" active={currentDir === "rtl"} onClick={() => setManualDirection("rtl")} />
          <ToolButton icon={Languages} label="Auto-detect direction" onClick={setAutoDirection} />
        </Group>

        <Divider />

        <Group>
          <ToolButton icon={Link2} label="Insert link" onClick={insertLink} />
          <ToolButton icon={ImageIcon} label="Insert image" onClick={insertImage} />
          <ToolButton icon={TableIcon} label="Insert table" onClick={insertTable} />
        </Group>
      </div>

      {/* ── Editable surface + floating overlays ── */}
      <div ref={surfaceRef} style={{ position: "relative" }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir="auto"
          data-placeholder={placeholder}
          className="thin-scroll rich-editor overflow-y-auto rounded-b-xl rounded-t-none border border-[var(--color-line)] p-4 text-[15px] leading-relaxed outline-none"
          style={{ minHeight }}
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleEditorClick}
        />

        {selectedImage && imageRect && (
          <ImageOverlay
            rect={imageRect}
            align={(selectedImage.getAttribute("data-align") as "left" | "center" | "right" | "inline") || "inline"}
            onResizeStart={startImageResize}
            onAlign={setImageAlign}
            onDelete={deleteSelectedImage}
          />
        )}

        {activeTable && tableGeometry && (
          <TableResizeOverlay
            geometry={tableGeometry}
            onColumnDragStart={(e, i) => startColumnResize(e, activeTable, i)}
            onRowDragStart={(e, i) => startRowResize(e, activeTable, i)}
            onInsertRowAbove={() => insertTableRow(0)}
            onInsertRowBelow={() => insertTableRow(1)}
            onDeleteRow={deleteTableRow}
            onInsertColLeft={() => insertTableColumn(0)}
            onInsertColRight={() => insertTableColumn(1)}
            onDeleteCol={deleteTableColumn}
          />
        )}

        {activeLink && linkPos && (
          <LinkChip
            pos={linkPos}
            href={activeLink.getAttribute("href") || ""}
            onOpen={() => window.open(activeLink.href, "_blank", "noopener,noreferrer")}
            onEdit={editActiveLink}
            onRemove={removeActiveLink}
          />
        )}
      </div>

      <style jsx global>{`
        .toolbar-select {
          border: 1px solid var(--color-line);
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 12.5px;
          background: white;
          color: var(--color-ink);
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
          border-inline-start: 3px solid var(--color-primary);
          padding-inline-start: 12px;
          color: var(--color-ink-soft);
          margin: 0.5em 0;
        }
        .rich-editor ul,
        .rich-editor ol {
          padding-inline-start: 1.4em;
        }
        .rich-editor img {
          max-width: 100%;
          border-radius: 8px;
          user-select: none;
          -webkit-user-drag: none;
        }
        .rich-editor .img-wrap.selected img {
          outline: 2px solid var(--color-primary);
          outline-offset: 2px;
        }
        .rich-editor table {
          border-collapse: collapse;
        }
        .rich-editor table td,
        .rich-editor table th {
          vertical-align: top;
        }
        .rich-editor a {
          color: var(--color-primary);
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .rich-editor a:hover {
          color: var(--color-primary-light);
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Content normalisation — upgrades legacy/pasted content (bare <img>,
// plain <table>) so it gains the same resize/alignment capability, and
// keeps links safe. Runs once on mount and after paste.
// ─────────────────────────────────────────────────────────────────────────
function normalizeContent(root: HTMLElement) {
  root.querySelectorAll("img").forEach((imgEl) => {
    const img = imgEl as HTMLImageElement;
    const parent = img.parentElement;
    if (parent && parent.classList.contains("img-wrap")) return;
    const wrap = document.createElement("span");
    wrap.className = "img-wrap";
    wrap.setAttribute("contenteditable", "false");
    wrap.setAttribute("data-align", "inline");
    wrap.style.cssText = "display:inline-block;position:relative;max-width:100%;vertical-align:bottom;line-height:0;";
    img.replaceWith(wrap);
    wrap.appendChild(img);
    img.draggable = false;
    img.style.display = "block";
    if (!img.style.width) {
      const w = Math.min(img.naturalWidth || 320, 480);
      img.style.width = w + "px";
      img.style.height = "auto";
    }
    img.style.maxWidth = "100%";
    if (!img.style.borderRadius) img.style.borderRadius = "8px";
  });

  root.querySelectorAll("table").forEach((tableEl) => {
    const table = tableEl as HTMLTableElement;
    table.style.tableLayout = "fixed";
    table.style.width = table.style.width || "100%";
    table.style.borderCollapse = "collapse";

    const firstRow = table.querySelector("tr");
    const colCount = firstRow ? firstRow.children.length : 0;
    let colgroup = table.querySelector("colgroup");
    if (!colgroup && colCount > 0) {
      colgroup = document.createElement("colgroup");
      for (let i = 0; i < colCount; i++) {
        const col = document.createElement("col");
        col.style.width = 100 / colCount + "%";
        colgroup.appendChild(col);
      }
      table.insertBefore(colgroup, table.firstChild);
    }

    const parent = table.parentElement;
    if (!parent || !parent.classList.contains("table-scroll")) {
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      wrap.style.cssText = "overflow-x:auto;max-width:100%;margin:10px 0;";
      table.replaceWith(wrap);
      wrap.appendChild(table);
    }
  });

  root.querySelectorAll("a[href]").forEach((a) => {
    const anchor = a as HTMLAnchorElement;
    if (!anchor.target) anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  });

  // Give every top-level block a direction so auto bidi applies immediately.
  root.querySelectorAll<HTMLElement>("p,div,li,h1,h2,h3,h4,h5,h6,blockquote,td,th").forEach((el) => {
    if (el.classList.contains("img-wrap") || el.classList.contains("table-scroll")) return;
    if (!el.getAttribute("dir")) el.setAttribute("dir", "auto");
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}

function placeCaretAtStart(el: Element) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function placeCaretAtEnd(el: Element) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function pointerPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
  if ("touches" in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  const me = e as React.MouseEvent;
  return { x: me.clientX, y: me.clientY };
}

function beginDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
  function moveHandler(ev: MouseEvent | TouchEvent) {
    if ("touches" in ev) {
      if (ev.touches[0]) {
        ev.preventDefault();
        onMove(ev.touches[0].clientX, ev.touches[0].clientY);
      }
    } else {
      onMove(ev.clientX, ev.clientY);
    }
  }
  function upHandler() {
    window.removeEventListener("mousemove", moveHandler as EventListener);
    window.removeEventListener("touchmove", moveHandler as EventListener);
    window.removeEventListener("mouseup", upHandler);
    window.removeEventListener("touchend", upHandler);
    onEnd();
  }
  window.addEventListener("mousemove", moveHandler as EventListener);
  window.addEventListener("touchmove", moveHandler as EventListener, { passive: false });
  window.addEventListener("mouseup", upHandler);
  window.addEventListener("touchend", upHandler);
}

interface TableGeometry {
  table: HTMLTableElement;
  left: number;
  top: number;
  width: number;
  height: number;
  colBoundaries: number[]; // x offsets (relative to surface) of internal column borders
  rowBoundaries: number[]; // y offsets of internal row borders
}

function computeTableGeometry(table: HTMLTableElement, surface: HTMLElement): TableGeometry {
  const tableRect = table.getBoundingClientRect();
  const surfaceRect = surface.getBoundingClientRect();
  const firstRowCells = Array.from(table.querySelectorAll("tr:first-child > td, tr:first-child > th"));
  const colBoundaries: number[] = [];
  firstRowCells.forEach((cellEl, i) => {
    if (i === firstRowCells.length - 1) return; // no boundary after the last column
    const r = (cellEl as HTMLElement).getBoundingClientRect();
    colBoundaries.push(r.right - surfaceRect.left);
  });
  const rows = Array.from(table.querySelectorAll("tr"));
  const rowBoundaries: number[] = [];
  rows.forEach((rowEl, i) => {
    if (i === rows.length - 1) return;
    const r = (rowEl as HTMLElement).getBoundingClientRect();
    rowBoundaries.push(r.bottom - surfaceRect.top);
  });
  return {
    table,
    left: tableRect.left - surfaceRect.left,
    top: tableRect.top - surfaceRect.top,
    width: tableRect.width,
    height: tableRect.height,
    colBoundaries,
    rowBoundaries,
  };
}

// ───────────────────────────── Sub-components ─────────────────────────────

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
  active,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep selection/focus in the editor
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)] ${
        active ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : ""
      }`}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

function DirButton({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label === "LTR" ? "Left-to-right" : "Right-to-left"}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold tracking-wide text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)] ${
        active ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : ""
      }`}
    >
      {label}
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

function ImageOverlay({
  rect,
  align,
  onResizeStart,
  onAlign,
  onDelete,
}: {
  rect: { left: number; top: number; width: number; height: number };
  align: "left" | "center" | "right" | "inline";
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, corner: "nw" | "ne" | "sw" | "se") => void;
  onAlign: (align: "left" | "center" | "right" | "inline") => void;
  onDelete: () => void;
}) {
  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    background: "var(--color-primary)",
    border: "2px solid white",
    borderRadius: 3,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  };
  const corners: { key: "nw" | "ne" | "sw" | "se"; style: React.CSSProperties; cursor: string }[] = [
    { key: "nw", style: { left: -6, top: -6 }, cursor: "nwse-resize" },
    { key: "ne", style: { left: rect.width - 6, top: -6 }, cursor: "nesw-resize" },
    { key: "sw", style: { left: -6, top: rect.height - 6 }, cursor: "nesw-resize" },
    { key: "se", style: { left: rect.width - 6, top: rect.height - 6 }, cursor: "nwse-resize" },
  ];

  return (
    <div style={{ position: "absolute", left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: -14,
          top: -40,
          display: "flex",
          gap: 2,
          background: "white",
          border: "1px solid var(--color-line)",
          borderRadius: 8,
          padding: 3,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          pointerEvents: "auto",
        }}
      >
        <MiniButton icon={AlignLeft} active={align === "left"} onClick={() => onAlign("left")} label="Align left" />
        <MiniButton icon={AlignCenter} active={align === "center"} onClick={() => onAlign("center")} label="Align centre" />
        <MiniButton icon={AlignRight} active={align === "right"} onClick={() => onAlign("right")} label="Align right" />
        <MiniButton icon={AlignJustify} active={align === "inline"} onClick={() => onAlign("inline")} label="Inline with text" />
        <div style={{ width: 1, background: "var(--color-line)", margin: "2px 1px" }} />
        <MiniButton icon={Trash2} onClick={onDelete} label="Delete image" />
      </div>
      {corners.map((c) => (
        <div
          key={c.key}
          onMouseDown={(e) => onResizeStart(e, c.key)}
          onTouchStart={(e) => onResizeStart(e, c.key)}
          style={{ ...handleStyle, ...c.style, cursor: c.cursor, pointerEvents: "auto" }}
        />
      ))}
    </div>
  );
}

function MiniButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)] ${
        active ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : ""
      }`}
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}

function TableResizeOverlay({
  geometry,
  onColumnDragStart,
  onRowDragStart,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRow,
  onInsertColLeft,
  onInsertColRight,
  onDeleteCol,
}: {
  geometry: TableGeometry;
  onColumnDragStart: (e: React.MouseEvent | React.TouchEvent, colIndex: number) => void;
  onRowDragStart: (e: React.MouseEvent | React.TouchEvent, rowIndex: number) => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteRow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDeleteCol: () => void;
}) {
  const { left, top, width, height, colBoundaries, rowBoundaries } = geometry;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          left,
          top: top - 36,
          display: "flex",
          gap: 2,
          background: "white",
          border: "1px solid var(--color-line)",
          borderRadius: 8,
          padding: 3,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <MiniButton icon={Rows3} onClick={onInsertRowAbove} label="Insert row above" />
        <MiniButton icon={Rows3} onClick={onInsertRowBelow} label="Insert row below" />
        <MiniButton icon={Trash2} onClick={onDeleteRow} label="Delete row" />
        <div style={{ width: 1, background: "var(--color-line)", margin: "2px 1px" }} />
        <MiniButton icon={Columns3} onClick={onInsertColLeft} label="Insert column left" />
        <MiniButton icon={Columns3} onClick={onInsertColRight} label="Insert column right" />
        <MiniButton icon={Trash2} onClick={onDeleteCol} label="Delete column" />
      </div>

      {colBoundaries.map((x, i) => (
        <div
          key={`col-${i}`}
          onMouseDown={(e) => onColumnDragStart(e, i)}
          onTouchStart={(e) => onColumnDragStart(e, i)}
          style={{
            position: "absolute",
            left: x - 3,
            top,
            width: 6,
            height,
            cursor: "col-resize",
            background: "transparent",
          }}
        />
      ))}
      {rowBoundaries.map((y, i) => (
        <div
          key={`row-${i}`}
          onMouseDown={(e) => onRowDragStart(e, i)}
          onTouchStart={(e) => onRowDragStart(e, i)}
          style={{
            position: "absolute",
            left,
            top: y - 3,
            width,
            height: 6,
            cursor: "row-resize",
            background: "transparent",
          }}
        />
      ))}
    </div>
  );
}

function LinkChip({
  pos,
  href,
  onOpen,
  onEdit,
  onRemove,
}: {
  pos: { left: number; top: number };
  href: string;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: pos.left,
        top: pos.top,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "white",
        border: "1px solid var(--color-line)",
        borderRadius: 8,
        padding: "4px 6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        maxWidth: 320,
        zIndex: 5,
      }}
    >
      <span className="truncate text-xs text-[var(--color-ink-soft)]" style={{ maxWidth: 160 }}>
        {href}
      </span>
      <MiniButton icon={ExternalLink} onClick={onOpen} label="Open link" />
      <MiniButton icon={Pencil} onClick={onEdit} label="Edit link" />
      <MiniButton icon={Unlink} onClick={onRemove} label="Remove link" />
    </div>
  );
}
